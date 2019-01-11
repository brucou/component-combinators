import { DOM_SINK, vLift } from "../../utils/src"
import { DEVTOOL_STATE_CHANNEL, SELECTED_STATE_CHANNEL, SEP } from "./properties"
import { componentNameInSettings, defaultDisplayCombinatorName, SOURCE_EMISSION } from "../../tracing/src"
import { set } from 'ramda'
import { Tree } from "../../src/components/UI"
import { getHashedTreeLenses } from 'fp-rosetree';
import { div, li, span, ul } from "cycle-snabbdom"
import { InjectSources } from "../../src"
import * as Rx from "rx";

const $ = Rx.Observable;

const LOCAL_STATE_SOURCE_NAME = 'ComponentTreePanelStateChannel'; // state for displayed tree, modifyable by components
const TREE_SOURCE_NAME = 'ComponentTreeSource'; // source of trees
const componentTreeLenses = getHashedTreeLenses('.');

const COMPONENT_TREE_PANEL_ROOT_WRAPPER_SELECTOR = ".depth-0";
const COMPONENT_TREE_PANEL_CONTAINER_SELECTOR = ".component-tree-view";
const COMPONENT_NAME_SECTION_SELECTOR = '.info';
const CONTAINER_COMPONENT_SELECTOR = '.is-container-component';
const NOT_CONTAINER_COMPONENT_SELECTOR = '';
const FOLDED_SELECTOR = ".folded";
const SELECTED_SELECTOR = '.selected';
const NOT_SELECTED_SELECTOR = '';
const NOT_FOLDED_SELECTOR = "";
const EXPAND_SELECTOR = ".toggle";
const FLEX_CONTAINER_SELECTOR = '.component-tree__container';

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

function renderDisplayedLabel(settings, userSelection, devtoolState, uiState) {
  const { label } = settings;
  const treeStructureTraceMsg = label.label;
  const { isContainerComponent } = treeStructureTraceMsg;

  const containerComponentClass = isContainerComponent
    ? CONTAINER_COMPONENT_SELECTOR
    : NOT_CONTAINER_COMPONENT_SELECTOR;

  return span(`${FLEX_CONTAINER_SELECTOR}${containerComponentClass}`, [
    renderExpandButton(settings, userSelection, devtoolState, uiState),
    renderCombinatorName(settings, userSelection, devtoolState, uiState),
    renderEmittedMessageSummary(settings, userSelection, devtoolState, uiState),
    renderComponentName(settings, userSelection, devtoolState, uiState),
  ])
}

function renderComponentName(settings, userSelection, devtoolState, uiState) {
  const { label } = settings;
  const treeStructureTraceMsg = label.label;
  const { componentName } = treeStructureTraceMsg;

  return span(COMPONENT_NAME_SECTION_SELECTOR, [`${componentName}`]) // TODO : if repeated from above do not repeat
}

function renderEmittedMessageSummary(settings, userSelection, devtoolState, uiState) {
  const { path, label } = settings;

  const { primarySelection } = userSelection;
  const { emissionTracesById, } = devtoolState;
  const strPath = path.join(SEP);
  /** @type EmissionMsg*/
  const selectedTraceMsg = emissionTracesById[primarySelection];
  const { emits, id: selectedTraceId, path: selectedTraceMsgPath, settings: traceMsgSettings } = selectedTraceMsg;
  const { identifier, notification, type } = emits;
  const { kind } = notification;
  const iconEmissionDirection = type === SOURCE_EMISSION ? DOWNWARDS_DOUBLE_ARROW : UPWARDS_DOUBLE_ARROW;

  const isSelected = strPath === selectedTraceMsgPath.join(SEP);

  // If emitted trace message coincides with node path then display there which source/sink is related
  return isSelected
    ? span(`${EMITTED_MESSAGE_SECTION_SELECTOR}${EMITTED_MESSAGE_TYPE_SELECTOR[kind]}`, [
      `${selectedTraceId}${iconEmissionDirection}${identifier}`
    ])
    : span(EMITTED_MESSAGE_SECTION_SELECTOR, [])
}

// TODO

/**
 * render a VTree encoding the visual representation of the section dedicated to the combinator name display
 * @param settings
 * @param userSelection
 * @param {DevtoolState} devtoolState
 * @param uiState
 * @returns {*}
 */
function renderCombinatorName(settings, userSelection, devtoolState, uiState) {
  const { path, label } = settings;
  const treeStructureTraceMsg = label.label;
  const { combinatorName, componentName } = treeStructureTraceMsg;

  const { primarySelection } = userSelection;
  const { emissionTracesById, renderSpecs } = devtoolState;
  const { channels, combinators } = renderSpecs;
  const strPath = path.join(SEP);
  /** @type EmissionMsg*/
  const selectedTraceMsg = emissionTracesById[primarySelection];
  const { path: selectedTraceMsgPath, combinatorName: realCombinatorName } = selectedTraceMsg;

  const isSelected = strPath === selectedTraceMsgPath.join(SEP);
  const displayedCombinatorNameIfSelected = realCombinatorName || combinatorName;
  // In the normal case if no combinators, we render the component name as if it were a combinator...
  const displayedCombinatorNameIfNotSelected = combinatorName || componentName;
  // Basically all combinators have/should have a render function specified.
  // That would ensure that the default render function is used iff we are on a leaf component, i.e.
  // when there is no combinator name but there is a component name, which is the name of the function component
  const renderFn = isSelected
    ? combinators[displayedCombinatorNameIfSelected] || defaultDisplayCombinatorName(displayedCombinatorNameIfSelected)
    : combinators[displayedCombinatorNameIfNotSelected] || defaultDisplayCombinatorName(displayedCombinatorNameIfNotSelected);

  // TODO : that is in fact confusing and due to same path on ForEach/Inner for instance... solution is to preprocess..
  return renderFn(strPath, treeStructureTraceMsg, selectedTraceMsg)
}

function renderExpandButton(settings, userSelection, devtoolState, uiState) {
  const { path } = settings;
  const strPath = path.join(SEP);
  const isFolded = !uiState[strPath].isExpanded;

  return span(EXPAND_SELECTOR, [isFolded ? `x` : `-`])
}

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

  return {
    [DOM_SINK]: userSelection$.withLatestFrom(devtoolState$, uiState$, (userSelection, devtoolState, uiState) => {
      const { primarySelection } = userSelection;
      const { emissionTracesById, } = devtoolState;
      const strPath = path.join(SEP);
      /** @type EmissionMsg*/
      const selectedTraceMsg = emissionTracesById[primarySelection];
      const { path: selectedTraceMsgPath, settings: traceMsgSettings } = selectedTraceMsg;
      const isFolded = !uiState[strPath].isExpanded;
      const isSelected = strPath === selectedTraceMsgPath.join(SEP);
      const foldedClass = isFolded ? FOLDED_SELECTOR : NOT_FOLDED_SELECTOR;
      const selectedClass = isSelected ? SELECTED_SELECTOR : NOT_SELECTED_SELECTOR;

      if (hasCollapsedAncestor(uiState, path.join(SEP))) {
        return null
      }
      else {
        // NOTE : we put something random (`.li`) because snabddom overloading causes problem with empty strings as sel
        return li(`.node${selectedClass}${foldedClass}`, {
          attrs: { "path": path.join(SEP), },
          slot: COMPONENT_TREE_NODE_SLOT
        }, [
          renderDisplayedLabel(settings, userSelection, devtoolState, uiState),
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
  const { path } = settings;

  return {
    [DOM_SINK]: userSelection$.withLatestFrom(devtoolState$, uiState$, (userSelection, devtoolState, uiState) => {
      const { primarySelection } = userSelection;
      const { emissionTracesById, } = devtoolState;
      const strPath = path.join(SEP);
      const selectedTraceMsg = emissionTracesById[primarySelection];
      const { path: selectedTraceMsgPath } = selectedTraceMsg;

      const isSelected = strPath === selectedTraceMsgPath.join(SEP);
      const foldedClass = NOT_FOLDED_SELECTOR;
      const selectedClass = isSelected ? SELECTED_SELECTOR : NOT_SELECTED_SELECTOR;

      if (hasCollapsedAncestor(uiState, path.join(SEP))) {
        return null
      }
      else {
        return li(`.leaf${selectedClass}${foldedClass}`, {
          attrs: { "path": path.join(SEP), },
          slot: COMPONENT_TREE_NODE_SLOT
        }, [
          renderDisplayedLabel(settings, userSelection, devtoolState, uiState),
        ])
      }
    })
  }
}

const componentTreeSource$ = function (sources, settings) {
  return sources[DEVTOOL_STATE_CHANNEL]
    .map(devtoolState => {
      const { selectionRushIndex, componentTrees } = devtoolState;

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

// TODO : I AM HERE : state machine to pass settigns to devtool and then use that to display comb/sour/sink better
// 4. TODO : review all component combinators and pass their settings always in the same name Settings
// Ex : ForEachSettings, ListOfSettings, InjectSourcesSettings
// make sure those settings are all mandatory to avoid undesired inheritance bugs...
// then pass those settings in the tracing, but filtered with just those (I have the combinatorName so should be easy)
// Then I will have
// InjectSources : fetchedCardsInfo$, fetchedPageNumber$                               App
//   ForEach : fetchedCardsInfo$ => items                                              DisplayCards
//     AspirationalPageHeader : container
//       ListOf : items => cardInfo
//         Card
//   ForEach : fetchedPageNumber$ => pageNumber                                        PaginateCards
//     Pagination
// For InjectSources, do not pass the settings object, pass {Inject...Settings : [names of sources]}
// To reflect also if `InjectSources` should have a {event, behaviour} separation (maybe)

// 1. TODO : pass map {trace entity : display function}
// - pass {combinatorName : (tree_structure_msg) => HTML} - can use the settings in the msg to display extra info
// - pass {channel : runtime_msg => HTML} - discrimate there again source/sink in emits.type
// - have a default value for these functions if not configured
// - those {...} are passed as config on the iTraceDef object
//   - display : {combinators: {...}, channels: {...}}
// - there is a protocol of communication between parent and iframe
//   - first iframe sends ready
//   - then parent sends DISPLAY_SETTING_MSG or TRACE_MSGs
//   - update the corresponding state machine
// !! this does the trick for JSON function serialization https://gist.github.com/anvaka/3815296
//    also even better
// https://medium.com/@oprearocks/serializing-object-methods-using-es6-template-strings-and-eval-c77c894651f0 !! Note
// that then I canno include closures, so not even constant... so add a param deps to display fn? or add it as part of
// Function reviver? (cf. Function parameters, and add use strict?)
// 2. TODO : also display more info with the source name. I sometimes should display the context if any
// TODO : also change implementation of inject sources so it can be like other and I can use set(componentname in
// settings...
// 3. TODO : change traceApp component name from ROOT to TRACER TODO : also think about a way to trace also the DOM
// events...
// 5. TODO : do the preprocessing of trace messages to eliminate Indexed|Inner etc
// 5. TODO : before that, add the ForEach vs. Inner in separate paths (yeah, an insert API in the tree
// library would be good)
