import {
  checkAndGatherErrors, eitherE, getSinkNamesFromSinksArray, isFunction, isHashMap, isStrictRecord,
  isStrictRecordE, isHashMapE,
  isString, preventDefault, removeNullsFromArray
} from "../utils"
import { defaultMergeSinkFn, m } from "./m"
import { intersection, flatten, either, isNil, keys, reduce, T } from "ramda"
import { isEventName } from "./types"

// No further argument type checking here
const isEventFactoryFunction = isFunction

// Could be checking among the list of events from the DOM but I dont, I am lazy
const isDomEventName = isString
const isSelectorString = isString
const isSelectorDescription = T
const isSelector = isHashMapE(isSelectorDescription, isSelectorString)

// TODO : change isStrictRecord to isNonStrictRecord as there might be extra property inherited??
// check it, as this is in the `m` it should have the highest priority, question is how the
// merge is done... if recursive then yes, some extra properties might find their way there...
// TODO: think : change the merge?? no more deep merge??
function isEventFactoryEventSettings(sources, settings) {
  return eitherE(
    [isNil, `isEventFactoryEventSettings > settings.events is not null`],
    [isStrictRecordE({
      custom: eitherE([isNil], [isHashMapE(isEventName, isEventFactoryFunction)]),
      DOM: eitherE([isNil], [isHashMapE(isDomEventName, isSelector)])
    }), `isEventFactoryEventSettings > BUT settings.events does not have the expected type`]
  )(settings.events)
}

function hasEventsProperty(sources, settings) {
  return Boolean(settings && settings.events)
}

const checkEventFactoryPreConditions = checkAndGatherErrors([
    [hasEventsProperty, `Settings parameter must have an events property!`],
    [isEventFactoryEventSettings, `settings' events property has unexpected shape!`]
  ], `checkEventFactoryPreConditions : fails!`
)

/////
// Utility functions
export function makeEventNameFromSelectorAndEvent(selector, eventName) {
  return [selector, eventName].join('_')
}

function log(x) {
  return function (y) {
    console.log(`${x}`, y)
  }
}

/////
// Core
/*
 ###  EventFactorySettings
 - `{`
 - `events : {`
 -   `custom : {eventName : (sources, settings) =>  event$},`
 -   `DOM : { eventName : {selectorDesc : 'selector}}`
 -   `}`
 - `}`
 */
function makeEventFactorySinks(sources, settings) {
  const { events: { custom, DOM } } = settings

  const customEvents = reduce((acc, customEventName) => {
    acc[customEventName] = custom[customEventName](sources, settings)
    return acc
  }, {}, keys(custom))

  const createdEvents = reduce((acc, DomEventName) => {
    // We dont test if this update is destructive, it is not in our contract
    // This means DOM events have priority over custom events in case of event name conflicts
    const selectors = DOM[DomEventName]

    return reduce((innerAcc, selectorDesc) => {
      const selector = selectors[selectorDesc]
      const eventName = makeEventNameFromSelectorAndEvent(selector, DomEventName);

      innerAcc[eventName] = sources.DOM.select(selector).events(DomEventName).tap(preventDefault)
        .tap(log(`${eventName}:`))

      return innerAcc
    }, acc, keys(selectors))

  }, customEvents, keys(DOM))

  return createdEvents
}

function mergeEventFactorySinksWithChildrenSinks(eventSinks, childrenSinks, localSettings) {
  const childrenSinksArray = flatten(removeNullsFromArray([childrenSinks]))
  const allSinks = flatten(removeNullsFromArray([eventSinks, childrenSinks]))
  const eventSinkNames = keys(eventSinks)
  const childrenSinkNames = getSinkNamesFromSinksArray(childrenSinksArray)
  const sinkNames = getSinkNamesFromSinksArray(allSinks)

  // throw error in the case of children sinks with the same sink name as event sinks
  if (intersection(eventSinkNames, childrenSinkNames).length !== 0) {
    throw `mEventFactory > mergeEventFactorySinksWithChildrenSinks : found children sinks with 
           at least one sink name conflicting with an event sink : 
           ${eventSinkNames} vs. ${childrenSinkNames}`
  }

  // otherwise apply default merge functions
  return defaultMergeSinkFn(eventSinks, childrenSinks, localSettings, sinkNames)
}

const eventFactorySpec = {
  // No extra sources
  makeLocalSources: null,
  // No extra settings
  makeLocalSettings: null,
  // We check that the settings have the appropriate shape
  checkPreConditions: checkEventFactoryPreConditions,
  checkPostConditions: null,
  // Create the event sinks from the specifications
  makeOwnSinks: makeEventFactorySinks,
  // We merge children sinks with the by-default merge functions
  mergeSinks: mergeEventFactorySinksWithChildrenSinks
}

export function mEventFactory(eventFactorySettings, childrenComponents) {
  // returns a component which default-merges sinks coming from the children
  // and adds its events sinks to it

  // NOTE : we could test against eventFactorySettings here, before doing it in `m` too
  // (fails fast). We will not.
  // Instead, we will wait for the settings passed to `mEventFactory` at
  // call time to be merged with the settings passed at creation time. This opens the
  // possibility to have a factory with some events, and adding some events at call time via
  // settings
//  debugger
  return m(eventFactorySpec, eventFactorySettings, childrenComponents)
}
