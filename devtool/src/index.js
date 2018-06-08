import * as Rx from 'rx'
import { filterNull } from "../../utils/src"
import { DOM_SINK } from "@rxcc/utils"
import { makeDOMDriver } from "cycle-snabbdom"
import { run } from "@cycle/core"
import defaultModules from "cycle-snabbdom/lib/modules"
import { documentDriver } from "../../drivers/src/documentDriver"
import {App} from './app'
import { READY } from "../../tracing/src"

const maxWindowLoadWaitingTime = 5000;

const postWindowLoad = new Promise((resolve, reject) => {
  // Set a timer in case the window never loads or does not load fast enough
  const timerId  = setTimeout(reject, maxWindowLoadWaitingTime);

  window.onload = function() {
    // Notifying parent window that iframe is ready to receive messages
    // NOTE : we don't put an origin for this initial message - could be some security risks - use only in DEV!
    window.parent.postMessage({type: READY}, '*');

    // Setup an event listener that calls receiveMessage() when the window
    // receives a new MessageEvent.
    window.addEventListener('message', function receiveMessage(event) {
      mainWindow = event.source;
      mainWindowOrigin = event.origin;

      // Emit the message on the observer side of the subject so it can be read on the observable side
      const msgs = JSON.parse(event.data);
      console.warn('event data', msgs);
      msgs.forEach(msg => observable.onNext(msg))
    });

    clearTimeout(timerId);
    resolve();
  }
});

// Main window handles
let mainWindow;
let mainWindowOrigin;
// Create observable for the application to receive messages from main window
const observable = new Rx.Subject();
// Create observable to receive messages from main window
const observer = Rx.Observer.create(
  function next(x) {
    // CONTRACT : our iframe MUST NOT send messages to the main window before the main window had sent one message.
    if (!mainWindow) {
      throw `devtool > crossWindowMessaging$ > postMessage > observer > origin window is not defined! This can happen if the iframe window sends a message before any messages from the origin window has been received. The iframe window CANNOT initiate the bidirectional communication!`
    }

    mainWindow.postMessage(x, mainWindowOrigin);
  },
  function error(err) {
    // NOTE : an error here would come from the `crossWindowMessaging$` sink, we log the error but do not throw
    console.error('devtool > crossWindowMessaging$ > postMessage > observer > Error: ', err);
  },
  function completed() {
    console.info('devtool > crossWindowMessaging$ > postMessage > observer > Completed');
  }
);

const windowMessagingSubject = Rx.Subject.create(observer, observable)

function makeWindowMessagingDriver(windowMessagingSubject) {
  return function windowMessagingDriver(sink$) {
    // Observer side of the subject will receive messages from the iframe to send to the main window
    sink$.subscribe(windowMessagingSubject.asObserver());

    // Observable side of the subject receives messages from the main window, and is passed to `sources`
    return windowMessagingSubject.asObservable()
  }
}

function makeGraphRenderDriver(maybePassAgraphSelector){
  return function (sink$) {
    sink$.subscribe(({context, command, params}) => {
      // TODO : code to run the graph library with the data. params has the data, command is render, context is ?
      // context : graph selector (will render an array of graphs in fact)
      // command : 'render'
      // params : {data, type, dimensions etc.}
    });
  }
}

// NOTE : we ensure that the app is initialized only after the window is loaded and the message handler has been set
postWindowLoad.then(() => {
  const { sources, sinks } = run(App, {
    [DOM_SINK]: filterNull(makeDOMDriver('#devtool_app', { transposition: false, defaultModules })),
    renderGraph : makeGraphRenderDriver(),
    document: documentDriver,
    crossWindowMessaging$ : makeWindowMessagingDriver(windowMessagingSubject)
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
    console.error(`devtool > error while loading window or running devtool!`, err);
  });


/**
 * msg => graph_msg | runtime_msg
 * state machine?
 * graph_msg 0
 * graph_msg 0.0
 * graph_msg 0.1...
 * Rules :
 * - When a graph_msg [path] comes that invalidates all the tree below (i.e. delete it)
 * - When a graph_msg [path] comes, add it to the tree structure
 *
 *
 *
 * Description of UI
 * - structure[]
 *   - every value is an array of graph_msg
 *   - i.e. Tree_Structure_Info<Tree_Structure_Msg> :: Array<Array<Tree_Structure_Msg>>
 * - when a new `graph_msg::Tree_Structure_Msg` arrives, it is put either in the last structure, or in a new one,
 * depending on runtime_msg arrivals (runtime_msg after graph_msg => close the current array grpah_msg, graph_msg
 * after graph_msg, add to current array, graph_msg after runtime_msg => open new array, graph_msg first => open new
 * arrray)
 *
 * UI/UX
 * - for a selected runtime_msg (u can't select graph_msgs...),
 *   - it is necessary to know the current index in structure[]
 *     - that's what we draw in the upper left panel
 *   - it is necessary to extract the current combinator/component name and the corresponding path
 *     - highlighted in the UI (as long as msg is selected)
 *     - in addition to current selection
 *
 * - for a selected combinator/component name/path
 *   - get the list of sources/sinks for that component
 *     1 as extracted from the runtime_msg from the previous interval between current graph structure section and
 *     previous graph_structure section
 *     2 as extracted from the runtime_msg after current grpah structure section
 *     - 1. is displayed in gray (past info, likely sources)
 *     - 2 is displayed in black (source actually did emit, so existence is confirmed)
 *   - get for each source/sink who emitted in that graph_structure section
 *     - last emission (full msg and/or shorter version)
 *   - display the most recent message from one of its source/sink in some different colour or section
 *
 * - scatter plot section (runime_msg display)
 *   - runtime_msg are broken into sections of consecutive sequences
 *     - runtime_msg then graph_structure => end of runtime_section
 *     - if too long time between consecutive runtime_msg => end of current and new runtime_section
 *   - detect transitions source/sink (colour code)
 *     - sink -> source : source is colour coded
 *     - source -> source : same color code
 *     - source -> sink : sink colour coded
 *     - sink -> sink : same color code
 *
 * - state
 *   - primary selected log msg
 *   - secondary selected log msg
 *   - log msgs
 *
 * - initial state
 *   - selected runtime_ms id = 1 (the first message)
 *     - but be careful that that message might not have arrived
 *   - log msgs (can be initialized with a bunch of logs)
 *   - no secondary selection
 */
