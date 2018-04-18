import {
  combinatorNameInSettings,
  componentNameInSettings, containerFlagInSettings, deconstructTraceFromSettings, defaultTraceSinkFn,
  defaultTraceSourceFn, getId, getIsTraceEnabled, getLeafComponentName, getPathForNthChild,
  isLeafComponent, leafFlagInSettings, mapOverComponentTree, pathInSettings, traceSinks, traceSources
} from './helpers'
import {
  GRAPH_STRUCTURE, iframeId, iframeSource, IS_TRACE_ENABLED_DEFAULT, PATH_ROOT, TRACE_BOOTSTRAP_NAME
} from './properties'
import { Combine } from "../../src/components/Combine"
import { decorateWithAdvice, getFunctionName, isAdvised, vLift } from "../../utils/src"
import { iframe } from "cycle-snabbdom"
import { pathOr, set, view } from 'ramda'
import { assertContract } from "../../contracts/src"
import { isTraceDefSpecs } from "./contracts"

export * from './helpers'
export * from './properties'
export * from './contracts'

let graphCounter = 0;

function getGraphCounter() { return graphCounter++}

export function resetGraphCounter() { graphCounter = 0}

/**
 * Sends a message to the devtool iframe
 * @param {*} msg Anything which can be JSON.stringified
 */
function sendMessage(msg) {
  // Make sure you are sending a string, and to stringify JSON
  // NOTE : also possible to pass a sequence of Transferable objects with the message
  const iframeEl = document.getElementById(iframeId);
  iframeEl.contentWindow.postMessage(JSON.stringify(msg), '*');
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

          // Edge case : I have to also log those component from the component tree which are leaf components as they won't
          // log themselves
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

const TraceIframe = vLift(
  iframe(iframeId, {
    props: {
      src: iframeSource,
    },
    style: {
      width: '450px',
      height: '200px'
    }
  }, [])
);

const adviseApp = (traceDef, App) => decorateWithAdvice({
  around: function (joinpoint, App) {
    const { args } = joinpoint;
    const [sources, settings] = args;

    const tracedApp = Combine({}, [
      TraceIframe,
      Combine(traceDef, [App])
    ]);

    // That does not work, as App will receive `traceDef` settings through local settings, and we need with
    // mSettings
    // const tracedApp = Combine({}, [
    //   TraceIframe,
    //   InjectSourcesAndSettings({
    //     settings: () => traceDef
    //   }, [
    //     App
    //   ])
    // ]);

    return tracedApp(sources, settings)
  }
}, App);

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
      sendMessage: pathOr(sendMessage, ['_trace', 'sendMessage'], traceDefSpecs),
      onMessage: null, // not used for now
      traceSpecs: traceDefSpecs._trace.traceSpecs,
      defaultTraceSpecs: pathOr([defaultTraceSourceFn, defaultTraceSinkFn], ['_trace', 'defaultTraceSpecs'], traceDefSpecs),
    }
  };

  return adviseApp(traceDef, App)
}

/**
 * @param {TraceSpecs} traceSpecs
 * @param {Component} App
 * @return Component Component whose inputs and outputs (i.e. sources and sinks) are traced
 */
export function traceAppBasic(traceSpecs, App) {
  // will inject _traceSpecs and _helpers (that should be merged without stomping) and _hooks (also merging as much
  // as possible). So for now we will do it so that traceDef actually include those helpers and so on.
  // We will think about hook overriding and composition when that problem happens
  /** @type TraceDef*/
  const traceDef = {
    _hooks: { preprocessInput, postprocessOutput },
    _helpers: { getId },
    _trace: {
      componentName: TRACE_BOOTSTRAP_NAME,
      isTraceEnabled: IS_TRACE_ENABLED_DEFAULT,
      isContainerComponent: false,
      isLeaf: false,
      path: [0],
      sendMessage: sendMessage,
      onMessage: null, // not used for now
      traceSpecs: traceSpecs,
      defaultTraceSpecs: [defaultTraceSourceFn, defaultTraceSinkFn]
    }
  };

  return adviseApp(traceDef, App)
}

// TODO : test the window messaging and iframe add
// TODO : write the iframe message reception

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

// TODO : how to trace the DOM source??, I have to intervene the dom OBJECT! same for document thing about it
// TODO : add in GRAOH_STRUCTURE alos sources and sinks for each component
// This will allow to detect when a component is terminated (i.e. when all its sinks are terminated), and also trace the
// sources available for // each // component
// DOC : mandatory for every source, sink to explicity pass a traceSpecs :/
// Not good idea to guess from rxjs type (coupled to rxjs v4, and britle)
// Naive type implementation does not propagate easily to derived source/sinks
// Not practical to ask the programmr to, all the time, explicitly indicate behaviour or event...
// Because he will forget, and there will be nasty bugs there. Or else, we put severe type controls in place.
