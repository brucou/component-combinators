import {
  assertContract, isArrayOf, isBoolean, isComponent
} from "../../../contracts/src/index"
import { m } from '../m/m'
import { intersection, keys, merge, set } from 'ramda'
import { combinatorNameInSettings } from "../../../tracing/src/helpers"

function isPipeSettings(sources, settings) {
  if ('overwrite' in settings) {
    return isBoolean(settings.overwrite)
  }
  else {
    return true
  }
}

function isNonEmptyArrayComponent(obj) {
  return obj && obj.length && isArrayOf(isComponent)(obj)
}

function isColliding(sources, sinks) {
  return Boolean(intersection(keys(sources), keys(sinks)).length)
}

function computeSinks(parentComponent, childrenComponents, sources, settings) {
  // NOTE : parentComponent is undefined by construction
  const throwIfSinkSourceConflict = settings && settings.Pipe && settings.Pipe.throwIfSinkSourceConflict;

  const acc = childrenComponents.reduce((acc, component) => {
    const sinks = component(acc.sources, acc.settings);

    if ((throwIfSinkSourceConflict) && isColliding(sources, sinks)) {
      throw `Pipe : Error when merging sinks of component ${component.name} with Pipe sources! A sink may override a source, check source/sink : ${intersection(keys(sources), keys(sinks))}`
    }

    acc.sources = merge(sources, sinks);
    acc.sinks = sinks;

    return acc
  }, { sources, settings, sinks: {} });

  return acc.sinks
}

// Spec
const pipeSpec = {
  computeSinks: computeSinks,
  checkPreConditions: isPipeSettings
};

export function Pipe(pipeSettings, componentArray) {
  assertContract(isPipeSettings, [null, pipeSettings], `Pipe : Pipe combinator may have 'overwrite' settings property. If that is the case, it must be a boolean!`);
  assertContract(isNonEmptyArrayComponent, [componentArray], `Pipe : Pipe combinator must be passed an array of components!`);

  return m(pipeSpec, set(combinatorNameInSettings, 'Pipe', pipeSettings), componentArray)
}
