import { m } from "../m/m"
import { mapObjIndexed } from 'ramda'
import {set} from 'ramda'
import { combinatorNameInSettings } from "../../../tracing/src"
import { INJECT_SOURCES_COMBINATOR } from "../properties"

export function InjectSources(sourcesHash, componentTree) {
  return m({
    makeLocalSources: function makeInjectedLocalSources(sources, settings) {
      return mapObjIndexed(sourceFactory => {
        return sourceFactory(sources, settings)
      }, sourcesHash)
    }
  }, set(combinatorNameInSettings, INJECT_SOURCES_COMBINATOR, {}), componentTree)
}
