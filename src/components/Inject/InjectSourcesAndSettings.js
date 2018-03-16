import { m } from "../m/m"
import { assertContract, isFunction, isObject } from "../../../contracts/src/index"
import {set} from 'ramda'
import { combinatorNameInSettings } from "../../../tracing/src/helpers"

function isSourcesAndSettings(obj) {
  return Boolean(
    'sourceFactory' in obj && isFunction(obj['sourceFactory'])
    || (!obj.sourceFactory && obj.settings)
  )
}

export function InjectSourcesAndSettings({ sourceFactory: sourcesFactory, settings },
                                         componentTree) {
  // TODO : update documentation
  assertContract(isSourcesAndSettings, [{
    sourceFactory: sourcesFactory,
    settings
  }], `First parameter must have a sourceFactory property to compute the new sources, and may have a settings property for the extra settings!`);

  const settingsObj = isObject(settings) ? settings : {};
  const settingsFn = isFunction(settings) ? settings : undefined;

  return m({
      makeLocalSources: sourcesFactory,
      makeLocalSettings: settingsFn
    },
    set(combinatorNameInSettings, 'InjectSourcesAndSettings', settingsObj),
    componentTree
  )
}
