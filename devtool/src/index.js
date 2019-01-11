import { filterNull } from "../../utils/src"
import { DOM_SINK } from "@rxcc/utils"
import { makeDOMDriver } from "cycle-snabbdom"
import { run } from "@cycle/core"
import defaultModules from "cycle-snabbdom/lib/modules"
import { documentDriver } from "../../drivers/src/documentDriver"
import { App } from './app'
import postRobot from "post-robot"
import { makePostRobotEmitterDriver, makePostRobotListenerDriver } from "../../drivers/src/crossDomainDriver"
import { CONTROL_CHANNEL, DATA_CHANNEL } from "./properties"

const parentWindow = window.parent;

const postWindowLoad = new Promise((resolve, reject) => {
  window.onload = function () {
    // Notifying parent window that iframe is ready to receive messages
    // NOTE : we don't put an origin for this initial message - could be some security risks - use only in DEV!
    // parentWindow.postMessage({type: READY}, '*');
    resolve();
    }
});

// TODO :dont forget messages  arrive in teh shape of string i.e. JSON-unparsed

function makeGraphRenderDriver(maybePassAgraphSelector) {
  return function (sink$) {
    sink$.subscribe(({ context, command, params }) => {
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
    renderGraph: makeGraphRenderDriver(),
    document: documentDriver,
    crossWindowReceiver$: makePostRobotListenerDriver(postRobot, DATA_CHANNEL, parentWindow, undefined),
    crossWindowEmitter$: makePostRobotEmitterDriver(postRobot, CONTROL_CHANNEL, parentWindow, undefined)
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

/** ADR :
 * I decided using the `post-robot` library to manage the trace cross-domain component
 * PROS:
 * - automatically manages ACK messages, and error messages (timer expiration)
 * - possibility to use function from the parent side in the cross-domain component, including closures
 * - easy to communicate between main window and cross-domain component via props
 * - `zoid` library built on top of it adds nice extra features for components
 * CONS:
 * - The cross-border component must be already attached to a selector in the main page, while I want to trace an
 * app just with a higher function, which means adding the selector only in case of trace
 * - function executed in the main window requires two exchanges of messages every time, and that is asynchronous.
 * That means overhead impacting performance
 * - about 40 K gzipped.
 * - well, it might have bugs, maybe the documentation is not so good, etc. (it is paypal though so could be ok, but
 * still)
 * Summary :
 * - we'll go with it, in spite of the cons mainly because we need the ability to execute cross-domain functions with
 * closures (to configure devtool at main parent's site)
 */

/**
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
 */
