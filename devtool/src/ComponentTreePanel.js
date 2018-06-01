import { DOM_SINK, vLift } from "../../utils/src"
import { DEVTOOL_STATE_CHANNEL } from "./properties"
import { componentNameInSettings } from "../../tracing/src"
import { set } from 'ramda'
import { Tree } from "../../src/components/UI"
import { getHashedTreeLenses } from 'fp-rosetree';
import { a, li } from "cycle-snabbdom"
import { InjectSources } from "../../src"

const LOCAL_STATE_SOURCE_NAME = 'ComponentTreePanelStateChannel'; // state for displayed tree, modifyable by components
const TREE_SOURCE_NAME = 'ComponentTreeSource'; // source of trees
const TREE_SETTING_NAME = 'ComponentTree'; // accessed through settings
// command sink in case we need to do some stuff (fetch data etc.)
const COMMAND_SOURCE_NAME = 'ComponentTreeCommands';
const commandExecFn = undefined; // TODO : check signature contract allows for undefined values
const componentTreeLenses = getHashedTreeLenses('.');

const PATH_ATTRIBUTE = 'path';

const treeSettings = {
  treeSettings: {
    treeSource: TREE_SOURCE_NAME,
    localStateSource: LOCAL_STATE_SOURCE_NAME,
    localTreeSetting: 'ComponentTree',
    defaultUIstateNode: { isExpanded: true },
    localCommandSpecs: { source: COMMAND_SOURCE_NAME, executeFn: commandExecFn },
    lenses: componentTreeLenses,
    sinkNames: [DOM_SINK]
  }
};
const TreeLeaf =
...

const TreeEmpty = vLift(div(`Empty component tree?`));

function TreeRoot(sources, settings) {
  const { treeSettings: { localTreeSetting, localStateSource } } = settings;
  const uiState$ = sources[localStateSource];
  const { path, label } = settings;
  const devToolState = settings[localTreeSetting];
  const {
    primarySelection,
    secondarySelection,
    sourcesForSelectedTrace,
    sinksForSelectedTrace,
    currentRushIndex,
    emissionTracesById,
    treeStructureTracesById,
    treeStructureTraces,
    emissionTraces,
    componentTrees
  } = devToolState;
  const COMPONENT_TREE_SELECTOR = '.component-tree__title';

  const events = {
    click$: sources[DOM_SINK].select(COMPONENT_TREE_SELECTOR).events('click')
      .map(e => {
        const element = e.target;
        if (element.getAttribute(PATH_ATTRIBUTE)) {
          const path = element.getAttribute(PATH_ATTRIBUTE);
          return path
        }
        else {
          // click was not on a displayed tree node
          return null
        }
      })
      .filter(Boolean)
  };

  const actions = {
    renderTreeContainer: div(COMPONENT_TREE_SELECTOR, [div('Component tree')]),
    updateState: events.click$
      .withLatestFrom(uiState$)
      .map((path, uiState) => {
        const isExpanded = uiState[path].isExpanded;

        return {
          op: "add",
          path: `/isExpanded/${path}`,
          value: !isExpanded
        }
      })
  };

// TODO test
  return {
    [DOM_SINK]: actions.renderTreeContainer,
    [localStateSource]: actions.updateState
  }
}

function TreeNode() {
  // TODO
  const { treeSettings: { localTreeSetting, localStateSource } } = settings;
  const uiState$ = sources[localStateSource];
  const { path, label } = settings;
  // NOTE : this should be a traceMsg
  const nodeValue = label.label;

  const devToolState = settings[localTreeSetting];
  const {
    primarySelection,
    secondarySelection,
    sourcesForSelectedTrace,
    sinksForSelectedTrace,
    currentRushIndex,
    emissionTracesById,
    treeStructureTracesById,
    treeStructureTraces,
    emissionTraces,
    componentTrees
  } = devToolState;

  // TODO : render
  return {
    [DOM_SINK]: uiState$.map(uiState => {
      if (isNodeExpanded(uiState, path) && !hasFoldedAncestor(uiState, path)) {
        // combinator name / component name cf. what to display
        // TODO : also set the icon for expanded/not expanded in another plugin reused here? how?
        // should be TreeNodeExpand combine with TreeNodeTracedMsgTree, TreeNodeExpand can be reused (plugin)
        // open/closed x combinator/component
        // if open : combinatorName ----- component name (try to put it to the right side? so leave right margin)
        // if closed : component name || combinator name
        return ...
      }
      else return null

      return li(".collapsed", { slot: NODE_SLOT }, [
        a(".title", {}, [`TreeLeaf@${path} : ${label} | UI state : ${uiStateToString}`])
      ])
    })

  }
}

const componentTreeSource$ = function (sources, settings) {
  return sources[DEVTOOL_STATE_CHANNEL]
    .map(devtoolState => {
      const {
        primarySelection,
        secondarySelection,
        sourcesForSelectedTrace,
        sinksForSelectedTrace,
        currentRushIndex,
        emissionTracesById,
        treeStructureTracesById,
        treeStructureTraces,
        emissionTraces,
        componentTrees
      } = devtoolState;

      return componentTrees[currentRushIndex]
    })
}

export const ComponentTreePanel = InjectSources({ [TREE_SOURCE_NAME]: componentTreeSource$ }, [
  Tree(set(componentNameInSettings, 'ComponentTreePanel', treeSettings), [
    TreeEmpty, TreeRoot, TreeNode, TreeLeaf
  ])
]);
