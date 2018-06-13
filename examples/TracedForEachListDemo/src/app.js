import * as Rx from "rx";
import { ForEach, InjectSources, ListOf } from "@rxcc/components"
import { DOM_SINK, EmptyComponent } from "@rxcc/utils"
import { AspirationalPageHeader } from "./AspirationalPageHeader"
import { Card } from "./Card"
import { CARDS, PAGE } from "./domain/index"
import { Pagination } from "./Pagination"
import { path } from 'ramda'
import {
  defaultIFrameSource, defaultIFrameId, makeIFrameMessenger, traceApp, traceDOMsinkFn, getIdFactory
} from "../../../tracing/src"
import { traceBehaviourSourceFn, traceEventSinkFn, traceEventSourceFn } from "../../../tracing/src/helpers"
import { traceActionDriverSource } from "../../../drivers/src/actionDriver"
import { traceQueryDriverSource } from "../../../drivers/src/queryDriver"

const $ = Rx.Observable;
const identity = x => x;

function fetchCardsInfo(sources, settings) {
  return fetchPageNumber(sources, settings)
    .flatMapLatest(page => sources.domainQuery.getCurrent(CARDS, { page }))
    // NOTE : this is a behaviour
    .shareReplay(1)
    .tap(x => console.debug(`fetchCardsInfo > domainQuery > CARDS :`, x))
}

function fetchPageNumber(sources, settings) {
  return sources.domainQuery.getCurrent(PAGE)
  // NOTE : building a live query by fetching the current page number and adding page number
  // change notifications resulting from actions affecting the page
    .concat(sources.domainAction$.getResponse(PAGE).map(path(['response', 'page'])))
    // NOTE : this is a behaviour
    .shareReplay(1)
    .tap(x => console.debug(`fetchPageNumber > domainQuery > PAGE :`, x))
}

export const App = InjectSources({
  fetchedCardsInfo$: fetchCardsInfo,
  fetchedPageNumber$: fetchPageNumber
}, [
  ForEach({
      from: 'fetchedCardsInfo$',
      as: 'items',
      sinkNames: [DOM_SINK],
      trace: 'ForEach card'
    }, [AspirationalPageHeader, [
      ListOf({ list: 'items', as: 'cardInfo', trace: 'ForEach card > ListOf' }, [
        EmptyComponent,
        Card,
      ])
    ]]
  ),
  ForEach({
    from: 'fetchedPageNumber$',
    as: 'pageNumber',
    sinkNames: [DOM_SINK, 'domainAction$']
  }, [
    Pagination
  ])
]);

const traceConfig = {
  _trace: {
    traceSpecs: {
      // TODO : maybe use [identity, identity] for sources whose trace functions are not specified
      // or modify spces for injectSources to specify if behaviour or events, that is the best... but then I would
      // have to somehow propagate nature of the source or sink? or modify _trace
      // and what about those sinks? inject sources a priori there is no corresponding sinks, so always use identity
      // this should figure in contract : no sink can exist with the name of an injected source
      'document' : [identity, identity],
      'domainQuery': [traceQueryDriverSource, identity],
      'domainAction$': [traceActionDriverSource, traceEventSinkFn],
      'fetchedCardsInfo$' : [traceBehaviourSourceFn, identity],
      'fetchedPageNumber$' : [traceBehaviourSourceFn, identity],
      [DOM_SINK]: [identity, traceDOMsinkFn],
    },
    // sendMessage: ..., // not set : will use default which is to emit in iframe with contentWindow.postMessage
    iframeId : defaultIFrameId,
    // NOTE TO SELF: this is with respect to index.html
    iframeSource : '../../devtool/devtool.html'
  },
  _helpers: { getId: getIdFactory() }
};

function getId(start) {
  let counter = start;
  return function () {
    return counter++
  }
}

export const tracedApp = traceApp(traceConfig, App);
