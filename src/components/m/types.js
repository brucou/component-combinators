import {
  checkAndGatherErrors, eitherE, isArray, isArrayOf, isComponent, isEmptyArray, isFunction,
  isHashMap, isObject, isString
} from "../../../utils/contracts/src/index"
import { both, complement, either, isNil, pipe, prop, uniq } from 'ramda'

function hasValidComponentDefProperty(componentDef, _settings, children) {
  return eitherE(
    [isNil, `m > hasMsignature > hasValidComponentDefProperty : there is no component definition`],
    [isNonNilComponentDef, `m > hasMsignature > hasValidComponentDefProperty : there is a component definition but it is not valid!`],
    ``
  )(componentDef)
}

function hasValidSettingsProperty(componentDef, _settings, children) {
  return either(isNil, isObject)(_settings)
}

const isSinkName = isString;

const isCombineGenericSpecs = checkAndGatherErrors([
    [pipe(prop('computeSinks'),
      either(isNil, both(isFunction, complement(prop('mergeSinks'))))),
      `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef > isCombineGenericSpecs : 'computeSinks' if not null must be  a function and in that case 'mergeSinks cannot be defined' !`],
    [pipe(prop('makeOwnSinks'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef > isCombineGenericSpecs : makeOwnSinks must be either null or a function!`]
  ],
  `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef > isCombineGenericSpecs : invalid combine generic definition!`);

const isCombineSinksSpecs = eitherE(
  [pipe(prop('mergeSinks'), either(isNil, isFunction)), ``],
  [pipe(prop('mergeSinks'), either(isNil, isHashMap(isSinkName, isFunction))), ``],
  `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef > isCombineGenericSpecs : invalid combine sinks definition! : must be a hash of functions, or a function`);

const isNonNilComponentDef = checkAndGatherErrors([
  [pipe(prop('makeLocalSources'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid 'makeLocalSources', should be null or a function!`],
  [pipe(prop('makeLocalSettings'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid 'makeLocalSettings', should be null or a function!`],
  [pipe(prop('checkPreConditions'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid 'checkPreConditions', should be null or a function!`],
  [pipe(prop('checkPostConditions'), either(isNil, isFunction)), `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid 'checkPostConditions', should be null or a function!`],
  [eitherE(
    [isCombineGenericSpecs, `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid generic merge!`],
    [isCombineSinksSpecs, `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid per sink merge!`],
    `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid component definition - must have either generic merge, or per sinks merge!`
  )]
], `m > hasMsignature > hasValidComponentDefProperty > isNonNilComponentDef : invalid component definition!`);

function isParentAndComponentArray(children) {
  if (isNil(children) || !isArray(children)) return false

  const parentCandidate = children[0];
  const childrenCandidate = children[1];

  if (isNil(parentCandidate) && isEmptyArray(childrenCandidate)) {
    return `m > hasMsignature > hasValidChildrenProperty > isParentAndComponentArray : 'm' component requires sinks to merge. That means both parent and children cannot be null at the same time!`
  }

  return either(isNil, isComponent)(parentCandidate) && isArray(childrenCandidate)
    && (
      childrenCandidate.length === 0
      || isArrayOf(isComponent)(childrenCandidate)
    )
}

function hasValidChildrenProperty(componentDef, _settings, children) {
  if (isEmptyArray(children)) {
    return `m > hasMsignature > hasValidChildrenProperty : 'children' parameter cannot be empty array, there has to be a component emitting sinks`
  }

  return eitherE(
    [isArrayOf(isComponent), `m > hasMsignature > hasValidChildrenProperty : 'children' parameter is not an array of components`],
    [isParentAndComponentArray, `m > hasMsignature > hasValidChildrenProperty : 'children' parameter does not have the shape [Parent, [Child]]`],
    ``
  )(children)
}

export const hasMsignature = checkAndGatherErrors([
  [hasValidComponentDefProperty, `m > hasMsignature > hasValidComponentDefProperty : invalid component definition !`],
  [hasValidSettingsProperty, `m > hasMsignature > hasValidSettingsProperty : invalid settings parameter !`],
  [hasValidChildrenProperty, `m > hasMsignature > hasValidChildrenProperty : children components must be an array of components!`]
], `hasMsignature : fails!`);

export function hasNoTwoSlotsSameName(slotHoles, slotNames) {
  return uniq(slotNames).length === slotHoles.length
}
