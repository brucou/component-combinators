import { DOM_SINK, vLift } from "../../utils/src"
import { DEVTOOL_STATE_CHANNEL, SEP } from "./properties"
import { componentNameInSettings, SOURCE_EMISSION } from "../../tracing/src"
import { set } from 'ramda'
import { Tree } from "../../src/components/UI"
import { getHashedTreeLenses } from 'fp-rosetree';
import { div, ul, li, span } from "cycle-snabbdom"
import { InjectSources } from "../../src"
import * as Rx from "rx";
const $ = Rx.Observable;

const LOCAL_STATE_SOURCE_NAME = 'ComponentTreePanelStateChannel'; // state for displayed tree, modifyable by components
const TREE_SOURCE_NAME = 'ComponentTreeSource'; // source of trees
const componentTreeLenses = getHashedTreeLenses('.');

const COMPONENT_TREE_PANEL_ROOT_WRAPPER_SELECTOR = ".depth-0";
const COMPONENT_TREE_PANEL_CONTAINER_SELECTOR = ".component-tree-view";
const COMBINATOR_SECTION_SELECTOR = '.combinator';
const COMPONENT_NAME_SECTION_SELECTOR = '.info';
const EMITTED_MESSAGE_SECTION_SELECTOR = '.trace';
const CONTAINER_COMPONENT_SELECTOR = '.is-container-component';
const NOT_CONTAINER_COMPONENT_SELECTOR = '';
const FOLDED_SELECTOR = ".folded";
const SELECTED_SELECTOR = '.selected';
const NOT_SELECTED_SELECTOR = '';
const NOT_FOLDED_SELECTOR = "";
const EXPAND_SELECTOR = ".toggle";
const FLEX_CONTAINER_SELECTOR = '.container';
// cf. https://www.w3schools.com/charsets/ref_utf_arrows.asp
const UPWARDS_DOUBLE_ARROW = "\u21D1";
const DOWNWARDS_DOUBLE_ARROW = "\u21D3";

const COMPONENT_TREE_NODE_SLOT = "component_tree_node_slot";
const PATH_ATTRIBUTE = 'path';

function hasCollapsedAncestor(uiState, strPath) {
  const paths = Object.keys(uiState).filter(path => strPath.startsWith(path));

  return paths.some(path => !uiState[path].isExpanded && strPath !== path)
}

const treeSettings = {
  treeSettings: {
    treeSource: TREE_SOURCE_NAME,
    localStateSource: LOCAL_STATE_SOURCE_NAME,
    localTreeSetting: 'ComponentTree',
    defaultUIstateNode: { isExpanded: true },
    localCommandSpecs: undefined,
    lenses: componentTreeLenses,
    // NOTE : don't forget to also let the state source pass!
    sinkNames: [DOM_SINK, LOCAL_STATE_SOURCE_NAME]
  }
};

const TreeEmpty = vLift(div(`Empty component tree?`));

function TreeRoot(sources, settings) {
  const { treeSettings: { localTreeSetting, localStateSource } } = settings;
  const uiState$ = sources[localStateSource];
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

  const events = {
    click$: sources[DOM_SINK].select(COMPONENT_TREE_PANEL_CONTAINER_SELECTOR).events('click')
      .map(e => {
        const element = e.target.closest(`${COMPONENT_TREE_PANEL_CONTAINER_SELECTOR} li`);
        if (element && element.getAttribute(PATH_ATTRIBUTE)) {
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
    renderTreeContainer: $.of(div(COMPONENT_TREE_PANEL_CONTAINER_SELECTOR, [
      span([
        ul(COMPONENT_TREE_PANEL_ROOT_WRAPPER_SELECTOR, {
          data: { slot: COMPONENT_TREE_NODE_SLOT }
        })
      ])
    ])),
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

  return {
    [DOM_SINK]: actions.renderTreeContainer,
    [localStateSource]: actions.updateState
  }
}

// TODO update same as tree leaf
function TreeNode(sources, settings) {
  const { treeSettings: { localTreeSetting, localStateSource } } = settings;
  const uiState$ = sources[localStateSource];
  const { path, label } = settings;
  const treeStructureTraceMsg = label.label;
  const { combinatorName, componentName, id: treeStructureId, isContainerComponent } = treeStructureTraceMsg;

  const devToolState = settings[localTreeSetting];
  const {
    // TODO : write separately data model, in fact those will be types doc for each prop of devToolState
    primarySelection, // TODO : primary selection is an emission message id
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
  const selectedTraceMsg = emissionTraces[primarySelection];
  // This shape is for trace messages with data emission logType
  const { emits, id: selectedTraceId, path: selectedTraceMsgPath } = selectedTraceMsg;
  const { identifier, notification, type } = emits;
  const iconEmissionDirection = type === SOURCE_EMISSION ? UPWARDS_DOUBLE_ARROW : DOWNWARDS_DOUBLE_ARROW;

  return {
    [DOM_SINK]: uiState$.map(uiState => {
      const strPath = path.join(SEP);
      const isFolded = !uiState[strPath].isExpanded;
      const isSelected = strPath === selectedTraceMsgPath.join(SEP);
      const foldedClass = isFolded ? FOLDED_SELECTOR : NOT_FOLDED_SELECTOR;
      const selectedClass = isSelected ? SELECTED_SELECTOR : NOT_SELECTED_SELECTOR;
      const containerComponentClass = isContainerComponent ? CONTAINER_COMPONENT_SELECTOR : NOT_CONTAINER_COMPONENT_SELECTOR;

      if (hasCollapsedAncestor(uiState, path.join(SEP))) {
        return null
      }
      else {
        return li(`${selectedClass}${foldedClass}`, {
          attrs: {
            "path": path,
          },
          slot: COMPONENT_TREE_NODE_SLOT
        }, [
          span(`${FLEX_CONTAINER_SELECTOR}${containerComponentClass}`, [
            span(EXPAND_SELECTOR, [isFolded ? `x` : `-`]),
            span(COMBINATOR_SECTION_SELECTOR, [`${combinatorName}`]),
            // If emitted trace message coincides with node path then display there which source/sink is related
            isSelected
              ? span(EMITTED_MESSAGE_SECTION_SELECTOR, [`${selectedTraceId}${iconEmissionDirection}${identifier}`])
              : span(EMITTED_MESSAGE_SECTION_SELECTOR, []),
            span(COMPONENT_NAME_SECTION_SELECTOR, [`${componentName}`]) // TODO : if repeated from above do not repeat
          ]),
          span([
            ul(`.depth-${length(path)}`, {
              data: { slot: COMPONENT_TREE_NODE_SLOT }
            }, [])
          ])
        ])
      }
    })
  }
}

function TreeLeaf(sources, settings) {
  const { treeSettings: { localTreeSetting, localStateSource } } = settings;
  const uiState$ = sources[localStateSource];
  const devtoolState$ = sources[DEVTOOL_STATE_CHANNEL];
  const { path, label } = settings;
  const treeStructureTraceMsg = label.label;
  const { componentName, id: treeStructureId, isContainerComponent } = treeStructureTraceMsg;

  return {
    // TODO check no wrong interaction with for each
    [DOM_SINK]: $.combineLatest(devtoolState$, uiState$, (devtoolState, uiState) => {
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
      const strPath = path.join(SEP);
      const selectedTraceMsg = emissionTracesById[primarySelection];
      const { emits, id: selectedTraceId, path: selectedTraceMsgPath, settings: traceMsgSettings } = selectedTraceMsg;
      const { identifier, notification, type } = emits;
      const iconEmissionDirection = type === SOURCE_EMISSION ? UPWARDS_DOUBLE_ARROW : DOWNWARDS_DOUBLE_ARROW;

      const isSelected = strPath === selectedTraceMsgPath.join(SEP);
      const foldedClass = NOT_FOLDED_SELECTOR;
      const selectedClass = isSelected ? SELECTED_SELECTOR : NOT_SELECTED_SELECTOR;
      const containerComponentClass = isContainerComponent
        ? CONTAINER_COMPONENT_SELECTOR
        : NOT_CONTAINER_COMPONENT_SELECTOR;

      if (hasCollapsedAncestor(uiState, path.join(SEP))) {
        return null
      }
      else {
        return li(`${selectedClass}${foldedClass}`, {
          attrs: {
            "path": path,
          },
          slot: COMPONENT_TREE_NODE_SLOT
        }, [
          span(`${FLEX_CONTAINER_SELECTOR}${containerComponentClass}`, [
            span(EXPAND_SELECTOR, [`-`]),
            span(COMBINATOR_SECTION_SELECTOR, [`------`]),
            // If emitted trace message coincides with node path then display there which source/sink it relates to
            isSelected
              ? span(EMITTED_MESSAGE_SECTION_SELECTOR, [`${selectedTraceId}${iconEmissionDirection}${identifier}`])
              : span(EMITTED_MESSAGE_SECTION_SELECTOR, []),
            span(COMPONENT_NAME_SECTION_SELECTOR, [`${componentName}`])
          ]),
        ])
      }
    })
  }
}

const componentTreeSource$ = function (sources, settings) {
  return sources[DEVTOOL_STATE_CHANNEL]
    .map(devtoolState => {
      const { currentRushIndex, componentTrees } = devtoolState;

      return componentTrees[currentRushIndex]
    })
}

export const ComponentTreePanel = InjectSources({ [TREE_SOURCE_NAME]: componentTreeSource$ }, [
  Tree(set(componentNameInSettings, 'ComponentTreePanel', treeSettings), [
    TreeEmpty, TreeRoot, TreeNode, TreeLeaf
  ])
]);
