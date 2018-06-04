import {
  combinatorNameInSettings, componentNameInSettings, containerFlagInSettings, deconstructTraceFromSettings,
  defaultTraceSinkFn, defaultTraceSourceFn, getId, getIsTraceEnabled, getLeafComponentName, getPathForNthChild,
  iframeIdInTraceDef, iframeSourceInTraceDef, isLeafComponent, leafFlagInSettings, mapOverComponentTree, pathInSettings,
  traceSinks, traceSources
} from './helpers'
import {
  defaultIFrameId, defaultIFrameSource, GRAPH_STRUCTURE, IS_TRACE_ENABLED_DEFAULT, PATH_ROOT, READY,
  TRACE_BOOTSTRAP_NAME
} from './properties'
import { Combine } from "../../src/components/Combine"
import { decorateWithAdvice, getFunctionName, isAdvised, vLift } from "../../utils/src"
import { iframe } from "cycle-snabbdom"
import { path, pathOr, set, view } from 'ramda'
import { assertContract } from "../../contracts/src"
import { isTraceDefSpecs } from "./contracts"

export * from './helpers'
export * from './properties'
export * from './contracts'

const maxBufferSize = 40960;
const WAIT_FOR_READY = 'WAIT_FOR_READY';
const EMIT_NOW = 'EMIT_NOW';
const IFRAME_MSG = 'iframeMsg';
const EMIT_ME_MSG = 'emitMeMsg';

let graphCounter = 0;

function getGraphCounter() { return graphCounter++}

export function resetGraphCounter() { graphCounter = 0}

function receiveMessageFromIFrame(IFrameReceivingEndSubject) {
  return function receiveMessageFromIFrame(event) {
    const { origin, source, data } = event;

    // NOTE : no filtering of origin, in spite of potential security issues : use only in DEV!
    // Send the ready message
    if (data.type === READY) {
      IFrameReceivingEndSubject.onNext(origin);
      return
    }
    else {
      // Ignore other messages for now
      return
    }
  }
}

function passToBufferStateMachine(acc, iframeReadyOrMsgToEmit) {
  const event = Object.keys(iframeReadyOrMsgToEmit)[0];

  switch (acc.controlState) {
    case WAIT_FOR_READY :
      switch (event) {
        case IFRAME_MSG :
          acc.shouldEmit = true;
          acc.controlState = EMIT_NOW;
          // Keeping track of the iframe origin to avoid security pitfall with iframe communication
          acc.origin = iframeReadyOrMsgToEmit[IFRAME_MSG];
          break;
        case EMIT_ME_MSG :
          if (acc.buffer.length > maxBufferSize) throw `makeIFrameMessenger : buffer overflow!!`
          acc.buffer.push(iframeReadyOrMsgToEmit[EMIT_ME_MSG]);
          acc.shouldEmit = false;
          acc.controlState = WAIT_FOR_READY;
          break;
        default :
          throw `makeIFrameMessenger > incoming message received has unknown type! ${event}`
      }
      break;
    case EMIT_NOW :
      switch (event) {
        case IFRAME_MSG :
          // Should not happen : only one READY message expected from iframe
          throw `received iframe msg while awaiting only for trace messages to emit to iframe!`
          break;
        case EMIT_ME_MSG :
          acc.buffer = [iframeReadyOrMsgToEmit[EMIT_ME_MSG]];
          acc.shouldEmit = true;
          acc.controlState = EMIT_NOW;
          break;
        default :
          throw `makeIFrameMessenger > incoming message received has unknown type! ${event}`
      }
      break;
    default :
      throw `makeIFrameMessenger > incoming message received while in unknown control state : ${acc.controlState}`
  }

  return acc
}

export function makeIFrameMessenger(iframeId) {
  /**
   * Sends a message to the devtool iframe
   * @param {*} msg Anything which can be JSON.stringified
   */
  const iFrameId = iframeId || defaultIFrameId;
  const iframeReceivingEnd = new Rx.Subject();
  const parentWindowEmittingEnd = new Rx.Subject();

  // Adds the event listerner
  // NOTE : adding the same listener several times is fine, subsequent additions will be discarded
  // cf. https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
  // In any case, that function will only be executed at most once per `run` execution, so we are good anyways
  window.addEventListener("message", receiveMessageFromIFrame(iframeReceivingEnd), false);

  iframeReceivingEnd.map(x => ({ [IFRAME_MSG]: x }))
    .merge(parentWindowEmittingEnd.map(x => ({ [EMIT_ME_MSG]: x })))
    .scan(passToBufferStateMachine, { buffer: [], shouldEmit: false, origin: '*', controlState: WAIT_FOR_READY })
    .filter(x => x.shouldEmit)
    .subscribe(
      x => {
        const iframeEl = document.querySelector(iFrameId);
        postMessages(iframeEl.contentWindow, x.origin, x.buffer)
      },
      err => {throw `makeIFrameMessenger > Encountered err while processing iframe and parent messaging !?`},
      () => {}
    );

  return function sendMessage(msg) {
    parentWindowEmittingEnd.onNext(msg)
  }
}

function postMessages(window, origin, msgs) {
  msgs.forEach(msg => window.postMessage(JSON.stringify(msg), origin));
}

// onMessage
function onMessage(msg) {
  console && console.warn(`received message : %s`, JSON.stringify(msg))
}

/**
 * Curried function which adds trace info (path, flags...) in the settings for a component. If the processed
 * component is a leaf component, its input and output must be directly traced. If not, they will be traced in the
 * invocation of the next combinator layer.
 * @param {Array<Number>} path
 * @returns {function(Component, Boolean, Number):Component} advised component
 */
function addTraceInfoToComponent(path) {
  return function addTraceInfoToComponent(component, isContainerComponent, index) {
    // Note that we trace the leaf component ahead of its execution. This can generate double logging with
    // combinators like ForEach which may execute the leaf components wrapped into a m() call
    // We hence add a guard against advising twice leaf components.
    // This duplication may also affects non leaf components
    if (isAdvised(component)) {
      return component
    }
    else {
      const advisedComponent = decorateWithAdvice({
        around: function decorateComponentWithTraceInfo(joinpoint, component) {
          const { args, fnToDecorateName } = joinpoint;
          const [sources, childComponentSettings] = args;
          const { sendMessage } = deconstructTraceFromSettings(childComponentSettings);
          let updatedChildComponentSettings = set(pathInSettings, getPathForNthChild(index, path), childComponentSettings);
          updatedChildComponentSettings = set(containerFlagInSettings, isContainerComponent, updatedChildComponentSettings);
          const isLeaf = isLeafComponent(component);

          // Edge case : I have to also log those component from the component tree which are leaf components as they
          // won't log themselves
          if (isLeaf) {
            // If the component is a leaf component :
            // - logs the corresponding portion of the tree structure
            // - add its name to settings for tracing purposes
            // - tap its sources and sinks here and now
            sendMessage({
              logType: GRAPH_STRUCTURE,
              componentName: getFunctionName(component),
              combinatorName: undefined,
              isContainerComponent: isContainerComponent,
              when: +Date.now(),
              path: path.concat([index]),
              id: getGraphCounter()
            });

            // TODO : could be written with `pipe` pipe(set(componentNameInSettings, getLeafComponentName(component))...
            updatedChildComponentSettings = set(componentNameInSettings, getLeafComponentName(component), updatedChildComponentSettings);
            updatedChildComponentSettings = set(leafFlagInSettings, isLeaf, updatedChildComponentSettings);
            updatedChildComponentSettings = set(combinatorNameInSettings, undefined, updatedChildComponentSettings);
            const tracedSources = traceSources(sources, updatedChildComponentSettings);
            const sinks = component(tracedSources, updatedChildComponentSettings);
            const tracedSinks = traceSinks(sinks, updatedChildComponentSettings);

            return tracedSinks
          }
          else {
            // If the component is a `m` component, i.e. obtained from m(...), let it be
            // It will be traced at the `m` level
            return component(sources, updatedChildComponentSettings);
          }
        }
      }, component);
      return advisedComponent
    }
  }
}

/**
 * @typedef [Array<Component> | [Component, Array<Component>]] ComponentTree
 */
/**
 * - Receives the same inputs as `m` and adapt those inputs to include the trace aspect to the `m` FACTORY
 *   - Adds `path` to settings, so that it corresponds to the location of the component in the component tree
 *   - Logs out the corresponding information
 * - Adds path also to CHILDREN components settings, together with miscellaneous info (isLeaf, etc.)
 * - Adds the trace aspect to leaf COMPONENTS if any
 * @param componentDef
 * @param {Sources} sources
 * @param {Settings} settings
 * @param {ComponentTree} componentTree
 * @returns {Settings}
 */
function preprocessInput(componentDef, sources, settings, componentTree) {
  if (!getIsTraceEnabled(settings)) {
    return { componentDef, settings, componentTree }
  }
  else {
    const { path, combinatorName, componentName, sendMessage } = deconstructTraceFromSettings(settings);

    // set root path if no path is set
    let updatedSettings = set(pathInSettings, path || PATH_ROOT, settings);

    // Trace the sources
    const tracedSources = traceSources(sources, settings);

    // Inject path in every child component, misc. info and special trace treatment for leaf components
    const advisedComponentTree = mapOverComponentTree(addTraceInfoToComponent(path), componentTree);

    sendMessage({
      logType: GRAPH_STRUCTURE,
      componentName,
      combinatorName,
      isContainerComponent: view(containerFlagInSettings, settings),
      when: +Date.now(),
      path,
      id: getGraphCounter()
    });

    return { componentDef, sources: tracedSources, settings: updatedSettings, componentTree: advisedComponentTree }
  }
}

/**
 * Traces sinks
 * NOTE : this really is only a m-generated component. Leaf component are traced in preprocessOutput
 * @param  {Sinks} sinks
 * @param  {Settings} settings
 * @returns {Sinks}
 */
function postprocessOutput(sinks, settings) {
  // NOTE : settings are passed here as all the trace specifications in included there, and I need it for tracing
  const tracedSinks = traceSinks(sinks, settings);
  return tracedSinks
}

const TraceIframe = (iframeSource, iframeId) => vLift(
  iframe(iframeId || defaultIFrameId, {
    attrs: {
      src: iframeSource || defaultIFrameSource,
    },
    style: {
      width: '1000px',
      height: '400px'
    }
  }, [])
);

function adviseApp(traceDef, App) {
  return decorateWithAdvice({
    around: function (joinpoint, App) {
      const { args } = joinpoint;
      const [sources, settings] = args;
      const iframeSource = view(iframeSourceInTraceDef, traceDef);
      const iframeId = view(iframeIdInTraceDef, traceDef);

      const tracedApp = Combine({}, [
        TraceIframe(iframeSource, iframeId),
        Combine(traceDef, [App])
      ]);

      return tracedApp(sources, settings)
    }
  }, App);
}

/**
 * @param {TraceDef} traceDefSpecs
 * @param {Component} App
 * @return Component Component whose inputs and outputs (i.e. sources and sinks) are traced
 */
export function traceApp(traceDefSpecs, App) {
  assertContract(isTraceDefSpecs, [traceDefSpecs], `traceApp : Fails contract isTraceDefSpecs!`);

  const traceDef = {
    _hooks: pathOr({ preprocessInput, postprocessOutput }, ['_hooks'], traceDefSpecs),
    _helpers: pathOr({ getId }, ['_helpers'], traceDefSpecs),
    _trace: {
      componentName: TRACE_BOOTSTRAP_NAME,
      isTraceEnabled: pathOr(IS_TRACE_ENABLED_DEFAULT, ['_trace', 'isTraceEnabled'], traceDefSpecs),
      isContainerComponent: pathOr(false, ['_trace', 'isContainerComponent'], traceDefSpecs),
      isLeaf: pathOr(false, ['_trace', 'isLeaf'], traceDefSpecs),
      path: pathOr([0], ['_trace', 'path'], traceDefSpecs),
      iframeSource: pathOr(defaultIFrameSource, ['_trace', 'iframeSource'], traceDefSpecs),
      iframeId: pathOr(defaultIFrameId, ['_trace', 'iframeId'], traceDefSpecs),
      sendMessage: pathOr(
        makeIFrameMessenger(path(['_trace', 'iframeId'], traceDefSpecs)),
        ['_trace', 'sendMessage'], traceDefSpecs
      ),
      onMessage: null, // not used for now
      traceSpecs: traceDefSpecs._trace.traceSpecs,
      defaultTraceSpecs: pathOr([defaultTraceSourceFn, defaultTraceSinkFn], ['_trace', 'defaultTraceSpecs'], traceDefSpecs),
    }
  };

  return adviseApp(traceDef, App)
}

/**
 * @typedef {function(source:Source, sourceName:String, settings:Settings):Source} TraceSourceFn
 * function taking a source and returning a traced source
 */
/**
 * @typedef {function(sink:Sink, sinkName:String, settings:Settings):Sink} TraceSinkFn
 * function taking a sink and returning a traced sink
 */
/**
 * @typedef {[TraceSourceFn, TraceSinkFn]} TraceSpec
 */
/**
 * @typedef {HashMap<DriverName, TraceSpec>} TraceSpecs
 */
/**
 * @typedef {Object} TraceDef
 * @property {{traceSpecs:TraceSpecs, defaultTraceSpecs:[], combinatorName, componentName, sendMessage,
 *   onMessage, isTraceEnabled, isContainerComponent, isLeaf, path:Array<Number>}} _trace
 * @property {{getId : function()}} _helpers
 */

// TODO : trace the DOM source?? possible nightmare! same for document... think about it
// could impose to declare all DOM events in separate source through an Events combinator, then trace as usual
// because cyclejs DOM.select.event is recursive, this could be the simplest way. To think about, maybe it is not
// that hard?
// DOC : mandatory for every source, sink to explicity pass a traceSpecs :/
// ADR :
// For tracing sources or sinks, the best strategy is to impose an interface contract on those sources and sinks.
// Traceability for a source or sink hence means providing a `traceSource` and `traceSink` function with the
// responsibility to do the job.
// Studied alternatives were unpractical or outright failing :
// - guessing nature of source/sink from rxjs type introduced coupling with rxjs v4, and was in general more britle
// - introducing a behaviour/event abstraction on top of rxjs is not easy to do properly without modifying rxjs
// internals, i.e. we would start coding to an implementation when we want to code to an interface
// - Naive duck typing for behaviour/event distinction does not propagate easily to derived source/sinks (cf. point
// above)
// - We need a solution which depends as little as possible on the programmer, as he is the most unreliable piece in
// the system.
