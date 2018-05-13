import { assoc, isNil, mapObjIndexed, tryCatch, values } from 'ramda';
import * as Rx from "rx"
import { assertContract, isError, isPromise } from "../../../contracts/src/index"
import { format } from "../../../utils/src/index"
import { decorateWithAdvice } from "../../../utils/src"
import { deconstructTraceFromSettings, makeSourceNotificationMessage } from "../../../tracing/src/helpers"

const $ = Rx.Observable;

// Helper functions
function errorHandler(e, repository, context, params) {
  console.error('makeDomainActionDriver: an error occured', e);
  console.warn('extra info: repository, context, params', repository, context, params);

  return e;
}

function isDomainAction(action) {
  return Boolean(!(isNil(action) || isNil(action.context) || isNil(action.command)))
}

function eventEmitterFactory(_, context, __) {
  void _, context, __;

  return new Rx.Subject()
}

/**
 * Driver factory which takes a configuration object and returns a driver.
 * The returned driver will be handling action requests arriving on its input stream (sink) :
 * - the context and command parameters of the action request are matched to a action handler
 * function
 * - that function is executed on incoming input from the sink and additional useful values
 *   + repository : enclose API allowing to use a specific data repository
 *   + context : passed back for reference to the callback function
 * @param repository
 * @param config
 */
export function makeDomainActionDriver(repository, config) {
  // Create a subject for each context defined in config
  const eventEmitters = mapObjIndexed(eventEmitterFactory, config);

  return function (sink$) {
    const source$ = sink$.map(function executeAction(action) {
      assertContract(isDomainAction, [action], `actionDriver > Invalid action ! Expecting {context:truthy, command : truthy, payload : any} ; received ${format(action)}`);
      console.info('DOMAIN ACTION | ', action);

      const { context, command, payload } = action;
      const fnToExec = config[context][command];
      const wrappedFn = tryCatch(fnToExec, errorHandler);
      const actionResult = wrappedFn(repository, context, payload);

      if (isPromise(actionResult)) {
        actionResult
          .then((result) => ({
            request: action,
            err: null,
            response: result
          }))
          .catch((e) => ({
            request: action,
            err: e,
            response: null
          }))
          .then((actionReponse) => {
            // NOTE : we emit out of the current function to avoid possible re-entry issues
            setTimeout(function () {eventEmitters[context].onNext(actionReponse);}, 0)
          })
      }
      else {
        // not a promise, hence synchronously returned value or exception from tryCatch
        // TODO : replace with Rx scheduler currentThread
        if (isError(actionResult)) {
          setTimeout(function () {eventEmitters[context].onError(actionResult)}, 0)
        }
        else {
          setTimeout(function () {
            eventEmitters[context].onNext({
              request: action,
              err: null,
              response: actionResult
            })
          }, 0)
        }
      }
    });

    // TODO : add an error handler
    // TODO : unsubscribe flows to think about (when app is exited willingly or forcefully)
    source$.subscribe(function (x) {console.log(`makeDomainActionDriver`, x)});

    // DOC : responseSource$ will emit responses for any of the action request
    //     : for use cases when one wants to filter per context, `getResponse` property is added
    //     : returns the subject from which one can listen for responses of a given context
    const responseSource$ = $.merge(values(eventEmitters));
    responseSource$.getResponse = function getResponse(context) {
      return eventEmitters[context]
    };

    return responseSource$;
  }
}

export function traceActionDriverSource(responseSource$, sourceName, settings) {
  // ADR
  // We want to get trace information for each result of action passing through the source
  // There are two possibilities :
  // 1. Let the default tracing system insert trace information in `responseSource$`
  //    This will work, as `eventEmitters[context]` emittimg implies `responseSource$` emits
  //    However this is not an equivalence, meaning that `responseSource$` will also emit when another event emitter
  //    for another context will emit, possibly creating confusion when reading traces.
  // 2. Insert trace information individually for each emitter ocntext and leave `responseSource$` untraced
  //    While slightly more complex, this seems to be the most API-user-friendly solution

  if ((!'getResponse' in responseSource$)) {
    throw `traceActionDriverSource > well, are you really using the right action driver? Can't find a 'getResponse' property in the action source!`
  }

  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);

  responseSource$.getResponse = decorateWithAdvice({
    after: function (joinpoint, App) {
      const { args, returnedValue } = joinpoint;
      const [context] = args;

      return returnedValue
        .materialize()
        .tap(notification => sendMessage(makeActionSourceNotificationMessage(
          { sourceName, settings, notification },
          context
        )))
        .dematerialize()
        // Needless to say, action driver is event-based, so share it is
        .share()
    }
  }, responseSource$.getResponse);

  return responseSource$
}

function makeActionSourceNotificationMessage({ sourceName, settings, notification }, context) {
  const message = makeSourceNotificationMessage({ sourceName, settings, notification });

  return assoc('details', {context}, message)
}

// TODO : test
