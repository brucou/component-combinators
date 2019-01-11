import { m } from "../m/m"
import { omit, set, T } from 'ramda'
import { assertContract, isOptional, isRecordE, isString } from "../../../contracts/src"
import { combinatorNameInSettings } from "../../../tracing/src/helpers"
import { computeInjectSpec } from "./InjectCircularSources"
import * as jsonpatch from "fast-json-patch/src/json-patch-duplex"
import { INJECT_LOCAL_STATE_COMBINATOR } from "../properties"

const injectLocalStateError = `InjectLocalState : Invalid settings !`
const isLocalStateSettings = isOptional(isRecordE({
  sourceName: isString,
  initialState: T,
}));

/**
 * Circular dependencies combinator specialized to state. Allows to have a state source and sink available to
 * downstream components, so they can read and write shared state within a scope delimited by the downstream
 * portion of the component tree
 * @param {{sourceName : String, initialState : *}} injectLocalStateSettings
 * @param {ComponentTree} componentTree
 */
export function InjectLocalState(injectLocalStateSettings, componentTree) {
  assertContract(isLocalStateSettings, [injectLocalStateSettings], injectLocalStateError);

  const injectlocalStateSpec = computeInjectSpec({
    behaviour: {
      behaviourSourceName : injectLocalStateSettings.sourceName,
      initialBehaviorValue : injectLocalStateSettings.initialState,
      processingBehaviourFn : (patchCommands, behaviourCache) => {
        return jsonpatch.applyPatch(behaviourCache, patchCommands).newDocument
      },
      finalizeBehaviourSource : (behaviourCache) => behaviourCache = null,
    }
  });

  // Here we chose to not have the settings inherited down the component tree, as this information is of exclusive
  // usage at this level
  const cleanedSettings = omit(['behaviour', 'event'], injectLocalStateSettings);
  return m(injectlocalStateSpec, set(combinatorNameInSettings, INJECT_LOCAL_STATE_COMBINATOR, cleanedSettings), componentTree)
}
