import * as Rx from "rx"
import { assoc, complement, isNil, tryCatch } from 'ramda';
import { assertContract, isFunction, isObservable, isPromise } from '../../../contracts/src/index'
import { decorateWithAdvice } from "../../../utils/src"
import { deconstructTraceFromSettings, makeSourceNotificationMessage } from "../../../tracing/src/helpers"

const $ = Rx.Observable;

// Helper functions
function errorHandler(e, repository, params) {
  void repository;

  console.error('makeDomainQueryDriver: an error occured', e);
  console.warn('extra info: params', params);

  return Promise.reject(e);
}

/**
 * Driver factory which takes a configuration object and returns a driver.
 * This drivers runs live query on a repository fetching data about bounded contexts.
 * The configuration object maps a context to a function which receives a query and
 * returns a stream of data matching that query.
 * @param repository
 * @param config
 * @returns
 */
export function makeDomainQueryDriver(repository, config) {
  return function (sink) {
    // not used, this is a read-only driver
    void sink;

    return {
      getCurrent: function query(context, payload) {
        assertContract(complement(isNil), [config[context]],
          `makeDomainQueryDriver > getCurrent : Context ${context} not found in config object!`);
        assertContract(isFunction, [config[context].get],
          `makeDomainQueryDriver > getCurrent : Context ${context} has a get property which is not a function!`);

        const fnToExec = config[context].get;
        const wrappedFn = tryCatch(fnToExec, errorHandler);

        // NOTE : This will recompute the `get` for every call, we don't use caching here
        // and we should not : there is no reason why the same call should return the same value!
        // If this should be implementing a live query, then the API user should cache at the `get` level not to
        // recompute the live query. The live query already automatically pushes updates
        // In all cases, the value returned is akin to a behaviour. In the case of live query, the stream returned
        // will be a behaviour also acting as an event source, as this is how Rxjs operates. When used as an event
        // source, that live stream should be turned into a solo event source with `share()`. If used as a
        // behaviour, it should be sampled as much as possible instead of using `combineLatest`, which comes with
        // glitches. Unfortunately that is not always possible.
        const output = wrappedFn(repository, context, payload);
        const outputToObservable = isPromise(output)
          ? $.fromPromise(output)
          : isObservable(output)
            ? output
            : $.of(output);

        // Force it to a behavior
        return outputToObservable.shareReplay(1)
        // TODO : test demo still works after that change
      }
    }
  }
}

export function traceQueryDriverSource(sourceFactory, sourceName, settings) {
  // ADR
  // We want to get trace information for each result of action passing through the source
  // There are two possibilities :
  // 1. Let the default tracing system insert trace information in `responseSource$`
  //    This will work, as `eventEmitters[context]` emittimg implies `responseSource$` emits
  //    However this is not an equivalence, meaning that `responseSource$` will also emit when another event emitter
  //    for another context will emit, possibly creating confusion when reading traces.
  // 2. Insert trace information individually for each emitter ocntext and leave `responseSource$` untraced
  //    While slightly more complex, this seems to be the most API-user-friendly solution

  if ((!'getCurrent' in sourceFactory)) {
    throw `traceQueryDriverSource > well, are you really using the right query driver? Can't find a 'getCurrent' property in the query source!`
  }

  const { traceSpecs, defaultTraceSpecs, combinatorName, componentName, sendMessage, path } = deconstructTraceFromSettings(settings);

  sourceFactory.getCurrent = decorateWithAdvice({
    around: function (joinpoint, fnToDecorate) {
      const { args } = joinpoint;
      const [context, payload] = args;

      return fnToDecorate(context, payload)
        .materialize()
        .tap(notification => sendMessage(makeQuerySourceNotificationMessage(
          { sourceName, settings, notification },
          { context, payload }
        )))
        .dematerialize()
        // Needless to say, query driver is behaviour-based, so replay it is
        .shareReplay(1)
    }
  }, sourceFactory.getCurrent);

  return sourceFactory
}

function makeQuerySourceNotificationMessage({ sourceName, settings, notification }, { context, payload }) {
  const message = makeSourceNotificationMessage({ sourceName, settings, notification });

  return assoc('details', { context, payload }, message)
}
