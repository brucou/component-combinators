import { DOM_SINK, } from "../../utils/src/index"
import { m } from "./m"
import { combinatorNameInSettings } from "../../tracing/src/helpers"
import { set } from 'ramda'
import { isArray } from "../../contracts/src"

// NOTE ADR: we use `m` here, we have to, to benefit from the tracing functionality that m offers.
/**
 *
 * @param slotName name for the slot
 * @param {Array<Component>} arrComponent For nowm should be an array with only one component
 * @returns {function(*=, *=): Sinks} component whose DOM output is subject to slotting
 */
export function InSlot(slotName, arrComponent) {
  if (!(isArray(arrComponent) && arrComponent.length === 1)) {
    throw `InSlot > fails contract : InSlot operator expects an ARRAY of ONE component!`
  }

  return function mComponentInSlot(sources, settings) {
    const sinks = m({}, set(combinatorNameInSettings, 'InSlot', {}), arrComponent)(sources, settings);
    const vNodes$ = sinks[DOM_SINK];

    sinks[DOM_SINK] = vNodes$ && vNodes$.do(vNode => {
      // NOTE : guard necessary as vNode could be null : OnRoute combinator for instance sends null
      // Those null are filtered at top level (filterNull), so we let them propagate to the top
      if (vNode) vNode.data.slot = slotName;
    });

    return sinks
  }
}
