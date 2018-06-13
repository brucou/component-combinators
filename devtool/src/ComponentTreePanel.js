import { DOM_SINK, vLift } from "../../utils/src"
import { DEVTOOL_STATE_CHANNEL, SELECTED_STATE_CHANNEL, SEP } from "./properties"
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
const FLEX_CONTAINER_SELECTOR = '.component-tree__container';
const EMITTED_MESSAGE_NEXT_SELECTOR = '.next-notification';
const EMITTED_MESSAGE_ERROR_SELECTOR = '.error-notification';
const EMITTED_MESSAGE_COMPLETED_SELECTOR = '.completed-notification';
const EMITTED_MESSAGE_TYPE_SELECTOR = {
  N: EMITTED_MESSAGE_NEXT_SELECTOR,
  E: EMITTED_MESSAGE_ERROR_SELECTOR,
  C : EMITTED_MESSAGE_COMPLETED_SELECTOR
};

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

  const events = {
    click$: sources[DOM_SINK].select(COMPONENT_TREE_PANEL_CONTAINER_SELECTOR).events('click')
      .map(e => {
        // TODO : does not work!!
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
          slot: COMPONENT_TREE_NODE_SLOT
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

// TODO : also investigate seT(...name, settings) prefixed with WITH path info, so inheritance vs. new create is diff.
function TreeNode(sources, settings) {
  const { treeSettings: { localTreeSetting, localStateSource } } = settings;
  const uiState$ = sources[localStateSource];
  const userSelection$ = sources[SELECTED_STATE_CHANNEL];
  const devtoolState$ = sources[DEVTOOL_STATE_CHANNEL];
  const { path, label } = settings;
  const treeStructureTraceMsg = label.label;
  const { combinatorName, componentName, id: treeStructureId, isContainerComponent } = treeStructureTraceMsg;

  return {
    [DOM_SINK]: userSelection$.withLatestFrom(devtoolState$, uiState$, (userSelection, devtoolState, uiState) => {
      const {primarySelection, secondarySelection} = userSelection;
      const {
        sourcesForSelectedTrace,
        sinksForSelectedTrace,
        emissionTracesById,
        treeStructureTracesById,
        treeStructureTraces,
        emissionTraces,
        componentTrees
      } = devtoolState;
      const strPath = path.join(SEP);
      /** @type EmissionMsg*/
      const selectedTraceMsg = emissionTracesById[primarySelection];
      const { emits, id: selectedTraceId, path: selectedTraceMsgPath, settings: traceMsgSettings } = selectedTraceMsg;
      const { identifier, notification, type } = emits;
      const { kind, value} = notification;
      const iconEmissionDirection = type === SOURCE_EMISSION ? DOWNWARDS_DOUBLE_ARROW: UPWARDS_DOUBLE_ARROW ;

      const isFolded = !uiState[strPath].isExpanded;
      const isSelected = strPath === selectedTraceMsgPath.join(SEP);
      const foldedClass = isFolded ? FOLDED_SELECTOR : NOT_FOLDED_SELECTOR;
      const selectedClass = isSelected ? SELECTED_SELECTOR : NOT_SELECTED_SELECTOR;
      const containerComponentClass = isContainerComponent
        ? CONTAINER_COMPONENT_SELECTOR
        : NOT_CONTAINER_COMPONENT_SELECTOR;

      if (hasCollapsedAncestor(uiState, path.join(SEP))) {
        return null
      }
      else {
        // NOTE : we put something random (`.li`) because snabddom overloading causes problem with empty strings as sel
        return li(`.node${selectedClass}${foldedClass}`, {
          attrs: {
            "path": path.join(SEP),
          },
          slot: COMPONENT_TREE_NODE_SLOT
        }, [
          span(`${FLEX_CONTAINER_SELECTOR}${containerComponentClass}`, [
            span(EXPAND_SELECTOR, [isFolded ? `x` : `-`]),
            span(COMBINATOR_SECTION_SELECTOR, [isSelected ? `${selectedTraceMsg.combinatorName}` : `${combinatorName}`]),
            // If emitted trace message coincides with node path then display there which source/sink is related
            isSelected
              ? span(`${EMITTED_MESSAGE_SECTION_SELECTOR}${EMITTED_MESSAGE_TYPE_SELECTOR[kind]}`, [
                `${selectedTraceId}${iconEmissionDirection}${identifier}`
              ])
              : span(EMITTED_MESSAGE_SECTION_SELECTOR, []),
            span(COMPONENT_NAME_SECTION_SELECTOR, [`${componentName}`]) // TODO : if repeated from above do not repeat
          ]),
          span([
            ul(`.depth-${path.length}.no-list-style`, {
              slot: COMPONENT_TREE_NODE_SLOT
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
  const userSelection$ = sources[SELECTED_STATE_CHANNEL];
  const devtoolState$ = sources[DEVTOOL_STATE_CHANNEL];
  const { path, label } = settings;
  /** @type TreeStructureMsg */
  const treeStructureTraceMsg = label.label;
  const { componentName, combinatorName, id: treeStructureId, isContainerComponent } = treeStructureTraceMsg;

  return {
    [DOM_SINK]: userSelection$.withLatestFrom(devtoolState$, uiState$, (userSelection, devtoolState, uiState) => {
      const {primarySelection, secondarySelection} = userSelection;
      const {
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
      const iconEmissionDirection = type === SOURCE_EMISSION ? DOWNWARDS_DOUBLE_ARROW: UPWARDS_DOUBLE_ARROW;

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
        return li(`.leaf${selectedClass}${foldedClass}`, {
          attrs: {
            "path": path.join(SEP),
          },
          slot: COMPONENT_TREE_NODE_SLOT
        }, [
          span(`${FLEX_CONTAINER_SELECTOR}${containerComponentClass}`, [
            span(EXPAND_SELECTOR, [`-`]),
            // TODO : investigate why it does not display -.-. anymore for real leaves
            span(COMBINATOR_SECTION_SELECTOR, [`${combinatorName || componentName || '????'}`]),
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
      const {  selectionRushIndex, componentTrees } = devtoolState;

      return componentTrees[selectionRushIndex]
    })
    .distinctUntilChanged()
    .share()
//    .shareReplay(1) // it is an event
}

export const ComponentTreePanel = InjectSources({ [TREE_SOURCE_NAME]: componentTreeSource$ }, [
  Tree(set(componentNameInSettings, 'ComponentTreePanel', treeSettings), [
    TreeEmpty, TreeRoot, TreeNode, TreeLeaf
  ])
]);
