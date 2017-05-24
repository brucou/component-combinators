import {
  either, isNil, allPass, complement, isEmpty, where, pipe, values, any, propEq, tap, both, flatten,
  map, prop, flip, all, identity, filter, equals, cond, T
} from "ramda"
import { isFunction, isString } from "../utils"

export const isNotEmpty = complement(isEmpty);
export const isComponent = isFunction;
export const isSettings = T;
// dont want to go through the trouble of typing this as it is notoriously shapeshifting
export const isSources = T;
export const isEventName = both(isString, isNotEmpty);
