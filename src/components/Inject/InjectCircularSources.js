import { m } from "../m/m"
import { clone, complement, isNil, omit, pick, set, tryCatch } from 'ramda'
import { assertContract, isFunction, isOptional, isRecordE, isString } from "../../../contracts/src"
import { EVENT_TYPE } from "../../../tracing/src/properties"
import Rx from "rx"
import { combinatorNameInSettings, reconstructComponentTree } from "../../../tracing/src/helpers"
import { noop } from "../../../utils/src"

const $ = Rx.Observable
const injectLocalStateSettingsError = `InjectLocalState : Invalid settings !`
const isInjectLocalStateSettings = isRecordE({
  behaviour: isOptional(isRecordE({ behaviourSourceName: isString, processingBehaviourFn: isFunction, initialBehaviorValue: complement(isNil), finalizeBehaviourSource: isFunction })),
  event: isOptional(isRecordE({eventSourceName : isString, processingEventFn : isFunction, finalizeEventSource :isFunction}))
});

/**
 * @typedef {{behaviourSourceName: String, processingBehaviourFn: Function, initialBehaviorValue: *, finalizeBehaviourSource?: Function}} BehaviourConfig
 */
/**
 * @typedef {{eventSourceName : String, processingEventFn : Function, finalizeEventSource :Function}} EventConfig
 */
/**
 * @typedef {{behaviour : BehaviourConfig, event : EventConfig}} InjectLocalStateSettings
 */
/**
 * Similar to drivers for the whole app. This allows to have an inner loop delimiting a scope
 * within which sources are visible, and outside of which they can no longer be seen nor manipulated.
 * For behaviour sources, note that it is recommended to SAMPLE them rather than combineLatest them
 * DOC : subscribing to circular sources occur **before** subscribing to upstream sources, so one has to be careful
 * about possible initialization issues.
 * DOC : State update commands are executed and **propagated synchronously**. It is recommended to sample that
 * state, so no (synchronous) actions is taken on change propagation (it would if `combineLatest` was used). But
 * then again, for DOM which is a behaviour, it will be next to impossible not to use combineLatest...
 * TODO : add an option to run on a specific scheduler??
 * @param {InjectLocalStateSettings} injectLocalStateSettings
 * @param {ComponentTree} componentTree
 */
export function InjectCircularSources(injectLocalStateSettings, componentTree) {
  assertContract(isInjectLocalStateSettings, [injectLocalStateSettings], injectLocalStateSettingsError);

  // TODO : Map is not cloneable, ramda returns the same object!! also Map will not work with json patch
  // DOC : initialBehaviorValue can be object or constructor factory i.e. function returning constructor
  const {behaviourSourceName, processingBehaviourFn, initialBehaviorValue} = injectLocalStateSettings.behaviour;
  const finalizeBehaviourSource = injectLocalStateSettings.behaviour[3] || noop;
  let behaviourCache= isFunction(initialBehaviorValue) ? new (initialBehaviorValue()) : clone(initialBehaviorValue);
  const behaviourSource = new Rx.BehaviorSubject(behaviourCache);

  const {eventSourceName, processingEventFn, finalizeEventSource} = injectLocalStateSettings.event;
  const eventSource = new Rx.Subject();

  function computeSinks(parentComponent, childrenComponents, sources, settings) {
    const reducedSinks = m(
      {},
      set(combinatorNameInSettings, 'InjectCircularSources|Inner', {}),
      reconstructComponentTree(parentComponent, childrenComponents)
    )(sources, settings);

    const reducedSinksWithoutCircularSinks = omit([behaviourSourceName, eventSourceName], reducedSinks);
    const reducedSinksWithOnlyCircularSinks = pick([behaviourSourceName, eventSourceName], reducedSinks);

    const behaviourSink = reducedSinks[behaviourSourceName];

    // We subscribe the behaviour first as we give priority to state over events (events might use state, so it
    // needs to preexist).
    // We subscribe the behaviour **synchronously** as the initial state must precede every other events/behaviours
    // of the related branch of the component tree. Also the behaviour update must take precedence over other
    // behaviours update downsream.
    behaviourSink && behaviourSink.subscribe(
      command => {
        const newBehaviourValue = tryCatch(processingBehaviourFn, processingBehaviourFnErrorHandler)(command, behaviourCache);
        // CONTRACT : processingBehaviourFn must not mutate the value of the behaviour received, i.e. behaviourCache
        // It could cause that different observers at the same time `n` see different values for the behaviour!!
        // TODO NOW : add my own json update functions with ramda!!
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
        finalizeBehaviourSource(behaviourCache);
        behaviourSource.onCompleted();
      }
    );

    const eventSink = reducedSinks[eventSourceName];
    // We subscribe the event source **synchronously** as any possible initial event must precede every other
    // events/behaviours of the related branch of the component tree. This allows to have an init event, would
    // that be necessary, which is guaranteed to be processed before any other event in the branch of the component tree
    eventSink && eventSink.subscribe(
      command => {
        // NOTE : there are two possibilities for error :
        // 1. processingFn throws or passes an error **notification** on its output stream : that is passed to the
        // event source, which will not admit any further notification, i.e. the error notification is final
        // 2. processingFn passes an error **code** through its output stream : the actual format for this error
        // code will be specific to the function at hand. For instance, if processingFn is an HTTP request handler,
        // it can choose to pass HTTP errors through a specific channel, emitting {error : httpCode}. The format of
        // the response is also left unspecified. I however think it is a good idea to include the request with the
        // response for matching purposes.
        // NOTE : as of now (31.3.2018), on error, the event source ends, so all branches of the component tree are
        // interrupted!
        // TODO : pass an error handler in parameter?
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
        finalizeEventSource();
        eventSource.onCompleted();
      }
    );

    return reducedSinksWithoutCircularSinks
  }

// Spec
  const injectlocalStateSpec = {
    makeLocalSources: _ => ({ [eventSourceName]: eventSource, [behaviourSourceName]: behaviourSource }),
    computeSinks: computeSinks,
  };

  // Here we chose to not have the settings inherited down the component tree, as this information is of exclusive
  // usage at this level
  const cleanedSettings = omit(['behaviour', 'event'], injectLocalStateSettings);
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


// TODO : DOC
// InjectCircularSources({behaviour : nameString, event : nameString})
// - inject sources[nameString] in the component tree
// - behaviour will issue json patch commands on eponym sinks
// - event will receive events labelled with the event source first, i.e. :: Event<Label, *>
// - the receive events on sink will be passed up as responses thourhg the event source.
// - event and behaviour do not go up the tree
// - behaviour MUST be initialized
// - typing info set on both observable (cf. default trace functions) (obj.type, BEHAVIOUR_TYPE, EVENT_TYPE)
//   - that way, no tracing config. is necessary for each behaviour/event...
//   - TODO : test it!
// ADRs :
// we have one behaviour because several behaviours are reducible to one b : {b1, b2} eq. to (b1,b2)
// We have JSON patch as update to better trace modifications, and also allow differential update, and to ensure no
// destructive update
// We have single event source because ...well by solidarity with the behaviour and because we can. Several events
// can be mixed in one event source by prefixing (multiplexing basically)
// ACHTUNG
// The behaviour should be SAMPLED, not combined, to avoid glitches, i.e. multiple non-atomic updates.
