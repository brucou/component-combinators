import { m } from "../m/m"

export function InjectSourcesAndSettings({ sourceFactory: sourcesFactory, settings }, componentTree) {
  // NOTE : not using makeLocalSettings which is the lowest priority of all settings
  return m({ makeLocalSources: sourcesFactory }, settings, componentTree)
}

