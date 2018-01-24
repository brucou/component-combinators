import { App } from "./app"
import defaultModules from "cycle-snabbdom/lib/modules"
import * as localForage from "localforage";
// drivers
import { makeDOMDriver } from "cycle-snabbdom"
import { run } from "@cycle/core"
import { loadTestData } from '../fixtures';
// utils
import { DOM_SINK } from "../../../utils/helpers/src/index"
import { domainActionsConfig, domainObjectsQueryMap } from './domain/index';
import { makeDomainQueryDriver } from './domain/queryDriver/index';
import { makeDomainActionDriver } from './domain/actionDriver/index';

const repository = localForage;
const modules = defaultModules;

// Helpers
function filterNull(driver) {
  return function filteredDOMDriver(sink$) {
    return driver(sink$
      .filter(Boolean)
    )
  }
}

// Make drivers
// Document driver
function documentDriver(_) {
  void _; // unused sink, this is a read-only driver

  return document
}

// Initialize the database - for this demo I do not use local storage but I keep this anyways
localForage._config = {
  driver: localForage.LOCALSTORAGE, // Force local storage;
  name: 'myApp',
  storeName: 'demo', // Should be alphanumeric, with underscores.
  description: 'emulation of remote storage in local for demo storage needs'
};

localForage.keys()
  .then(keys => Promise.all(keys.map(key => {
      return localForage.getItem(key).then(value => ({ [key]: value }))
    }
  )))
  .then(console.log.bind(console, `database content before`))
  .then(() => loadTestData(localForage))
  .then((initLoginState) => {

    const { sources, sinks } = run(App, {
      [DOM_SINK]: filterNull(makeDOMDriver('#app', { transposition: false, modules })),
      document: documentDriver,
      domainQuery: makeDomainQueryDriver(repository, domainObjectsQueryMap),
      domainAction$: makeDomainActionDriver(repository, domainActionsConfig),
    });

    // Webpack specific code
    if (module.hot) {
      module.hot.accept();

      module.hot.dispose(() => {
        sinks.dispose()
        sources.dispose()
      });
    }
  })
  .catch(function (err) {
    console.error(`error while initializing database`, err);
  });

// NOTE : convert html to snabbdom online to http://html-to-hyperscript.paqmind.com/
// ~~ attributes -> attrs
