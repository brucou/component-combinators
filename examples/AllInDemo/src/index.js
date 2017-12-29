import { App } from "./app"
import defaultModules from "cycle-snabbdom/lib/modules"
import { createHistory } from "history"
import firebase from 'firebase'
import { run } from "@cycle/core"
import { makeDOMDriver } from "cycle-snabbdom"
import { makeHistoryDriver } from '@cycle/history';
import { domainActionsConfig, domainObjectsQueryMap } from './domain/index';
import { inMemoryStoreActionsConfig, inMemoryStoreQueryMap } from './inMemoryStore';
import { makeDomainQueryDriver } from './domain/queryDriver/index';
import { makeDomainActionDriver } from './domain/actionDriver';
import { documentDriver } from '../../../src/drivers/documentDriver';
import { DOM_SINK, filterNull } from "../../../src/utils"
import {
  initLocallyPersistedState, initLocalNonPersistedState, initRemotelyPersistedState, initRepository
} from './init'

const repository = initRepository(firebase);
const fbRoot = repository;
const inMemoryStore = initLocalNonPersistedState();

// Initialize database if empty : this is only for demo purpose, in real app, data is already there
// NOTE: state initialization could be done in parallel instead of sequentially
initRemotelyPersistedState(repository)
  .then(initLocallyPersistedState())
  .then(() => {
    const { sources, sinks } = run(App, {
      [DOM_SINK]: filterNull(makeDOMDriver('#app', {
        transposition: false,
        modules: defaultModules
      })),
      document: documentDriver,
      domainQuery: makeDomainQueryDriver(repository, domainObjectsQueryMap),
      domainAction$: makeDomainActionDriver(repository, domainActionsConfig),
      storeAccess: makeDomainQueryDriver(inMemoryStore, inMemoryStoreQueryMap),
      storeUpdate$: makeDomainActionDriver(inMemoryStore, inMemoryStoreActionsConfig),
      router: makeHistoryDriver(createHistory(), { capture: true }),
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
    console.error(`error while initializing application`, err);
  });
