import { m } from "../m/m"
import { clone, complement, isNil, omit, pick, set, tryCatch, T, merge } from 'ramda'
import { assertContract, isFunction, isOptional, isRecordE, isString } from "../../../contracts/src"
import { EVENT_TYPE } from "../../../tracing/src/properties"
import Rx from "rx"
import { combinatorNameInSettings, reconstructComponentTree } from "../../../tracing/src/helpers"
import { noop } from "../../../utils/src"

const $ = Rx.Observable
const injectCircularSourcesError = `InjectCircularSources : Invalid settings !`
const isCircularSourcesSettings = isRecordE({
  behaviour: isOptional(isRecordE({
    behaviourSourceName: isString,
    processingBehaviourFn: isFunction,
    initialBehaviorValue: T,
    finalizeBehaviourSource: isOptional(isFunction )})),
  event: isOptional(isRecordE({
    eventSourceName : isString,
    processingEventFn : isFunction,
    finalizeEventSource :isOptional(isFunction)}))
});

function parseBehaviourSetting(behaviourSetting){
  if (behaviourSetting){
    return behaviourSetting
  }
  else {
    return {
      behaviourSourceName : '', processingBehaviourFn : undefined, initialBehaviorValue : undefined, finalizeBehaviourSource : undefined
    }
  }
}

function parseEventSetting(eventSetting){
  if (eventSetting){
    return eventSetting
  }
  else {
    return {
      eventSourceName : '', processingEventFn : undefined,  finalizeEventSource : undefined
    }
  }
}

export function computeInjectSpec(settings){
  const {behaviourSourceName, processingBehaviourFn, initialBehaviorValue, finalizeBehaviourSource} =
    parseBehaviourSetting(settings.behaviour);
  let behaviourCache= isFunction(initialBehaviorValue)
    ? new (initialBehaviorValue())
    : clone(initialBehaviorValue);
  const behaviourSource = behaviourSourceName ? new Rx.BehaviorSubject(behaviourCache) : undefined;

  const {eventSourceName, processingEventFn, finalizeEventSource} =
    parseEventSetting(settings.event);
  const eventSource = eventSourceName ?  new Rx.Subject() : undefined;

  const localSources = merge(
    behaviourSourceName ? { [behaviourSourceName]: behaviourSource} : {},
    eventSourceName ? { [eventSourceName]: eventSource} : {},
  );

  // NOTE : this implementation features eager connection of event and behaviour source!
  // This might cause problem if some sources are not ready yet to be connected to? We should get better control of
  // ordering : TODO add a control$ source at global level? give an id to circularSources and have control$ use that to
  // start/stop that circular app?

  function computeSinks(parentComponent, childrenComponents, sources, settings) {
    const reducedSinks = m(
      {},
      set(combinatorNameInSettings, 'InjectCircularSources|Inner', {}),
      reconstructComponentTree(parentComponent, childrenComponents)
    )(sources, settings);

    const reducedSinksWithoutCircularSinks = omit([behaviourSourceName, eventSourceName], reducedSinks);

    if (behaviourSourceName) {
      const behaviourSink = reducedSinks[behaviourSourceName];

      // We subscribe the behaviour first (i.e. before the event source) as we give priority to state over events (events
      // might use state, so it needs to preexist).
      // We subscribe the behaviour **synchronously** as the initial state must precede every other events/behaviours
      // of the related branch of the component tree. Also the behaviour update must take precedence over other
      // behaviours update downsream.
      behaviourSink && behaviourSink.subscribe(
        command => {
          const newBehaviourValue = tryCatch(processingBehaviourFn, processingBehaviourFnErrorHandler)(command, behaviourCache);
          // CONTRACT : processingBehaviourFn must not mutate the value of the behaviour received, i.e. behaviourCache
          // It could cause that different observers at the same time `n` see different values for the behaviour!!
          // NOTE : we want the 'clock' to step forward, so we schedule the emission after all planned tasks are executed
          // Invariant is `(state_n+1, action_n) = f(event_n, state_n)` for the active set of reactive subsystems
          // This ensure `state_n+1` is acted upon after all the `event_n` have been processed, with `state_n` as
          // state value. Doing otherwise might lead to some `event_n` processed with `state_n+1` value, or an
          // action_n+1 occuring before action_n, which both violate the invariant.
          // That is what happens for example wih infinite loops provoked by syncronous update of state which
          // synchronously triggers another synchronous update of state.
          // NOTE : Error might happen while computing the behaviour value. This may be intentional to signal the
          // impossibility to compute that value. In any case, that error will be processed by the default error
          // handler, and passed on as a normal value back in the source stream. i.e. we transform an exception into
          // an error code, in the absence of a convenient `Maybe` type.
          // TODO : pass an error handler in parameter?
          // NOTE : I can also behaviourSink.observeOn(Rx.Scheduler.currentThread), but I prefer this for now for tracing
          // cf. https://github.com/Reactive-Extensions/RxJS/blob/master/doc/api/schedulers/scheduler.md
          // TODO : pass onNext{value : x, update : command}? command could be delta(x), and it could be easier in
          // some cases to react on delta than on x
          const disposable = Rx.Scheduler.currentThread.schedule(
            newBehaviourValue,
            function emit(scheduler, x) { behaviourCache = newBehaviourValue, behaviourSource.onNext(x); }
          );
        },
        // This happens if an error is produced while computing state sinks. That should NOT happen... and should
        // very much deserve a catastrophic exception. For now, just logging and ignoring as the idea is to not
        // interrupt the program with an exception, so we don't pass the error on the subject
        // TODO : think over alternative strategies for error handling
        // NOTE : on error, the behaviourSink ends, but not the behaviour source, which means other branches of the
        // component tree should continue to work
        error => console.error(`InjectCircularSources/behaviour : error!`, error),
        completed => {
          console.debug(`InjectCircularSources/behaviour : completed!`);
          finalizeBehaviourSource && finalizeBehaviourSource(behaviourCache);
          behaviourSource.onCompleted();
        }
      );
    }

    if (eventSourceName){
      const eventSink = reducedSinks[eventSourceName];
      // We subscribe the event source **synchronously** as any possible initial event must precede every other
      // events/behaviours of the related branch of the component tree. This allows to have an init event, would
      // that be necessary, which is guaranteed to be processed before any other event in the branch of the component tree
      eventSink && eventSink.subscribe(
        command => {
          // DOC : there are two possibilities for error :
          // 1. processingFn throws or passes an error **notification** on its output stream : that is passed to the
          // event source, which will not admit any further notification, i.e. the error notification is final
          // 2. processingFn passes an error **code** through its output stream : the actual format for this error
          // code will be specific to the function at hand. For instance, if processingFn is an HTTP request handler,
          // it can choose to pass HTTP errors through a specific channel, emitting {error : httpCode}. The format of
          // the response is also left unspecified. I however think it is a good idea to include the request with the
          // response for matching purposes.
          // ADR : pass an error handler in parameter? NO. `processingEventFn` should be written not to emit errors
          // though... so any errors passing is a real bug, so processingEventFnErrorHandler should not be part of the
          // API
          const labelledEventResponse$ = tryCatch(processingEventFn, processingEventFnErrorHandler)(command);
          labelledEventResponse$.observeOn(Rx.Scheduler.currentThread).subscribe(
            function processEventSinkOnNext(x) {eventSource.onNext(x);},
            function processEventSinkOnError(err) {eventSource.onError(err);},
            function processEventSinkOnCompleted() {
              // NOTE: DO NOT send complete notification to `eventSource`, it will complete too and won' be usable!!
              console.debug(`InjectCircularSources > computeSinks > eventSink > command result processing > completed!`)
            },
          )
        },
        // cf. notes for behaviour. The same applies
        error => console.error(`InjectCircularSources/event : error!`, error),
        completed => {
          console.debug(`InjectCircularSources > computeSinks > eventSink > completed!`)
          finalizeEventSource && finalizeEventSource();
          eventSource.onCompleted();
        }
      );
    }

    return reducedSinksWithoutCircularSinks
  }

// Spec
  const injectlocalStateSpec = {
    makeLocalSources: _ => localSources,
    computeSinks: computeSinks,
  };

  return injectlocalStateSpec
}

/**
 * @typedef {{behaviourSourceName: String, processingBehaviourFn: Function, initialBehaviorValue: *, finalizeBehaviourSource?: Function}} BehaviourConfig
 */
/**
 * @typedef {{eventSourceName : String, processingEventFn : Function, finalizeEventSource :Function}} EventConfig
 */
/**
 * @typedef {{behaviour : BehaviourConfig, event : EventConfig}} InjectCircularSourcesSettings
 */
/**
 * Similar to drivers for the whole app. This allows to have an inner loop delimiting a scope
 * within which sources are visible, and outside of which they can no longer be seen nor manipulated.
 * For behaviour sources, note that it is recommended to SAMPLE them rather than combineLatest them
 * TODO : event sink could be passed as observable, that would make it easier to implement concurrency control, for
 * instance concatMap, mergeMaxConcurrently etc.
 * @param {InjectCircularSourcesSettings} injectCircularSourcesSettings
 * @param {ComponentTree} componentTree
 */
export function InjectCircularSources(injectCircularSourcesSettings, componentTree) {
  assertContract(isCircularSourcesSettings, [injectCircularSourcesSettings], injectCircularSourcesError);

  const injectlocalStateSpec = computeInjectSpec(injectCircularSourcesSettings);

  // Here we chose to not have the settings inherited down the component tree, as this information is of exclusive
  // usage at this level
  const cleanedSettings = omit(['behaviour', 'event'], injectCircularSourcesSettings);
  return m(injectlocalStateSpec, set(combinatorNameInSettings, 'InjectCircularSources', cleanedSettings), componentTree)
}

/**
 * An error while processing the command to execute is considered a fatal error. It is the onus of the processing
 * function to handle any recoverable error at its level.
 * @param {Error} err
 * @param {Command} command
 */
function processingEventFnErrorHandler(err, command) {
  console.error(`InjectCircularSources > computeSinks > eventSink > processingFn : error (${err}) raised while processing command`, command);
  return $.throw(err)
}

function processingBehaviourFnErrorHandler(err, command) {
  console.error(`InjectCircularSources > computeSinks > behaviourSink > processingFn : error (${err}) raised while processing command`, command);
  return err
}

// ADRs :
// We have one behaviour because :
// - several behaviours are reducible to one b : {b1, b2} eq. to (b1,b2), so we don' loose expressiveness
// - in case decentralized state is necessary, another `InjectCircularSources` or `InjectSources` can always be inserted
// We have JSON patch as update to better trace modifications, and also allow differential update, and to ensure no
// destructive update
// We have single event source because ...well by solidarity with the behaviour and because we can. Several events
// can be mixed in one event source by prefixing (multiplexing basically)

// TODO : rename InjectCircularSources in InjectInterpreter? ou attendre un peu? TEST!!
