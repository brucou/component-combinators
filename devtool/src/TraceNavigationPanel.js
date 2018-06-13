import { DOM_SINK } from "../../utils/src"
import * as Rx from 'rx'
import { div, img } from "cycle-snabbdom"
import { DEVTOOL_STATE_CHANNEL, SEP } from "./properties"
import { range } from "ramda"

const $ = Rx.Observable;
const traceNavigationPanelSelector = '.trace-navigation';
const navigateToNextTraceIdButtonSelector = '.trace-navigation__button--next-trace-id';
const navigateToPreviousTraceIdButtonSelector = '.trace-navigation__button--previous-trace-id';
const navigateToNextBreakButtonSelector = '.trace-navigation__button--next-break';
const navigateToPreviousBreakButtonSelector = '.trace-navigation__button--previous-break';
const navigateToNextComponentTraceButtonSelector = '.trace-navigation__button--next-output';
const navigateToPreviousComponentTraceButtonSelector = '.trace-navigation__button--previous-output';

const isNextIdInRush = (emissionTraces, rush, id) => emissionTraces[rush].indexOf(id + 1) > -1;
const isPreviousIdInRush = (emissionTraces, rush, id) => id >= 1 && emissionTraces[rush].indexOf(id - 1) > -1;

/**
 * Look if a given path corresponding to the position of a node in a hierarchy has an ancestor, or is itself
 * included in an array of such paths.
 * @param {string} targetPath
 * @param {Array<String>} paths
 * @returns {Boolean}
 */
function hasAncestorInPaths(targetPath, paths) {
  return paths.some(path => targetPath.startsWith(path))
}

/** TODO
 * Look if a given path corresponding to the position of a node in a hierarchy has an ancestor, or is itself
 * included in an array of such paths.
 * @param {string} targetPath
 * @param {Array<String>} paths
 * @returns {Boolean}
 */
function hasDescendantsInPaths(targetPath, paths) {
  return paths.some(path => path.startsWith(targetPath))
}


/**
 * Checks that two messages have similar parameters, namely
 * 'path', 'combinatorName', 'componentName'
 * @param selectedTraceMsg
 * @param candidateTraceMsg
 * @returns {Boolean}
 */
function isSimilarEmittedMessage(selectedTraceMsg, candidateTraceMsg) {
  return selectedTraceMsg.path.join(SEP) === candidateTraceMsg.path.join(SEP) &&
    ['combinatorName', 'componentName'].every(prop => selectedTraceMsg[prop] === candidateTraceMsg[prop]);
}

/**
 *
 * @param {DevtoolState} devtoolState
 */
function getLastEmittedMessageId(devtoolState) {
  const { currentRushIndex, emissionTraces } = devtoolState;
  // last element of the array of ids is the last id (pop would not work here, as it modifies the array!)
  return emissionTraces[currentRushIndex].slice(-1)[0]
}

/**
 *
 * @param {Event} event
 * @param {DevtoolState} devtoolState
 */
function navigateToNextTraceId([event, devtoolState]) {
  const { primarySelection, selectionRushIndex, emissionTraces, emissionTracesById } = devtoolState;
  /** @typedef Array<JSON_Patch>*/
  let jsonPatchOps;

  const newSelectionId = primarySelection + 1;
  const setNewPrimarySelection = {
    op: "replace",
    path: "/primarySelection",
    value: newSelectionId
  };
  const hasNextRush = Boolean(emissionTraces[selectionRushIndex + 1]);

  if (isNextIdInRush(emissionTraces, selectionRushIndex, primarySelection)) {
    jsonPatchOps = [setNewPrimarySelection];
  }
  else if (hasNextRush && isNextIdInRush(emissionTraces, selectionRushIndex + 1, primarySelection)) {
    jsonPatchOps = [
      setNewPrimarySelection, {
        op: "replace",
        path: "/selectionRushIndex",
        value: selectionRushIndex + 1
      }];
  }
  else {
    // potential next trace message id is nowhere to be found, so stay in the same selection id
    jsonPatchOps = [];
  }

  return jsonPatchOps
}

/**
 *
 * @param {Event} event
 * @param {DevtoolState} devtoolState
 */
function navigateToPreviousTraceId([event, devtoolState]) {
  const { selectionRushIndex, primarySelection, emissionTraces, emissionTracesById } = devtoolState;
  /** @typedef Array<JSON_Patch>*/
  let jsonPatchOps;

  const newSelectionId = primarySelection - 1;
  const setNewPrimarySelection = {
    op: "replace",
    path: "/primarySelection",
    value: newSelectionId
  };
  const hasPreviousRush = selectionRushIndex >= 1 && Boolean(emissionTraces[selectionRushIndex - 1]);

  if (isPreviousIdInRush(emissionTraces, selectionRushIndex, primarySelection)) {
    jsonPatchOps = [setNewPrimarySelection];
  }
  else if (hasPreviousRush && isPreviousIdInRush(emissionTraces, selectionRushIndex - 1, primarySelection)) {
    jsonPatchOps = [
      setNewPrimarySelection, {
        op: "replace",
        path: "/selectionRushIndex",
        value: selectionRushIndex - 1
      }];
  }
  else {
    // potential previous trace message id is nowhere to be found, so stay in the same selection id
    jsonPatchOps = [];
  }

  return jsonPatchOps
}

/**
 * We are looking for the first subsequent trace with the same parameters than the selected trace
 * However, there is no guarantee that that trace will be semantically matched to the current trace. That should
 * be the case most of the time. In other occurrences, it could happen that this component coincidentally have the
 * same parameters (for instance, if that portion of the tree is substituted by another - routing, switching...)
 * The chances would augment considerably if we would check the whole path from root towards the current node, for
 * equality, but still there would remain a possibility that components with otherwise the same parameters are not
 * semantically related. The best thing we can do, while maintaining the feature, is to ensure for all traces
 * between the present one and the sought-for one, that the portion of the tree structure including the present node
 * has not changed. So when there is a new rush, i.e. a change in teh component tree structure, we check that the change
 * did not impact the present node.
 * @param {Event} event
 * @param {DevtoolState} devtoolState
 */
function navigateToNextComponentTraceId([event, devtoolState]) {

  // TODO : have some visual clues in the graph that we are changing rush, for user to better understand the nav.
  // Algorithm
  // 0. Get the (id, combinatorName, componentName, path) for the selected trace emitted
  // 1. iterate from current selected id to the last, not including current
  // 1a. get rush index for the current iterated id
  // 1b. if new rush index, and in treeStructureTraces[newRush]->ids there is the path for the selected trace, or above
  //     then FAILURE: we cannot find a next id, abort and return null or sth
  // 1c. otherwise if emitted message for iterated id has same [combinatorName, componentName, path], then exit we
  // found what we wanted
  //               else loop
  // so we have a loop with two exits conditions
  // return what we found either failure or what we wanted or default value which is failure

  let jsonPatchOps;
  const {
    selectionRushIndex, primarySelection, emissionTraces, emissionTracesById, treeStructureTraces, treeStructureTracesById
  } = devtoolState;
  /** @type EmissionMsg*/
  const selectedTraceMsg = emissionTracesById[primarySelection];
  const { path } = selectedTraceMsg;

  const lastId = getLastEmittedMessageId(devtoolState);
  let foundId = null;
  let hasFoundId = false;
  let currrentRushIndex = selectionRushIndex;

  range(primarySelection + 1, lastId + 1).some(traceEmittedMessageId => {
    const isNewRush = !isNextIdInRush(emissionTraces, currrentRushIndex, traceEmittedMessageId - 1);
    currrentRushIndex += isNewRush ? 1 : 0;
    if (isNewRush) {
      const treeStructureMessageIds = treeStructureTraces[currrentRushIndex];
      const treeStructureMessages = treeStructureMessageIds.map(id => treeStructureTracesById[id]);
      const treeStructureMessagesPaths = treeStructureMessages.map(msg => msg.path.join(SEP));

      if (hasAncestorInPaths(path.join(SEP), treeStructureMessagesPaths)) {
        foundId = null;
        hasFoundId = false;
        return true
      }
    }

    const candidateTraceMsg = emissionTracesById[traceEmittedMessageId];
    if (isSimilarEmittedMessage(selectedTraceMsg, candidateTraceMsg)) {
      foundId = traceEmittedMessageId;
      hasFoundId = true;
      return true
    }

    return false
  });

  if (hasFoundId) {
    jsonPatchOps = [{
      op: "replace",
      path: "/primarySelection",
      value: foundId
    }, {
      op: "replace",
      path: "/selectionRushIndex",
      value: currrentRushIndex
    }]
  }
  else {
    jsonPatchOps = [];
  }

  return jsonPatchOps
}

function navigateToPreviousComponentTraceId([event, devtoolState]) {
  let jsonPatchOps;
  const {
    selectionRushIndex, primarySelection, emissionTraces, emissionTracesById, treeStructureTraces, treeStructureTracesById
  } = devtoolState;
  /** @type EmissionMsg*/
  const selectedTraceMsg = emissionTracesById[primarySelection];
  const { path } = selectedTraceMsg;

  const firstId = 0;
  let foundId = null;
  let hasFoundId = false;
  let currRushIndex = selectionRushIndex;

  // Edge case : we already are at the first id of the trace, so we cannot go backwards, can we
  if (primarySelection === firstId) return [];

  range(-(primarySelection - 1), - (firstId -1)).map(x => -x).some(traceEmittedMessageId => {
    const isNewRush = !isPreviousIdInRush(emissionTraces, currRushIndex, traceEmittedMessageId + 1);
    if (isNewRush) {
      // Was unable to have a totally symetrical implementation vs. nextComponentTraceId
      // Basically, I wrote this exploiting the property that one can only backwards if from that backwards position one
      // can go forward. This explains why we increment the rush index only at the end
      const treeStructureMessageIds = treeStructureTraces[currRushIndex];
      const treeStructureMessages = treeStructureMessageIds.map(id => treeStructureTracesById[id]);
      const treeStructureMessagesPaths = treeStructureMessages.map(msg => msg.path.join(SEP));

      if (hasAncestorInPaths(path.join(SEP), treeStructureMessagesPaths)) {
        foundId = null;
        hasFoundId = false;
        return true
      }
    }

    currRushIndex += isNewRush ? - 1 : 0;
    const candidateTraceMsg = emissionTracesById[traceEmittedMessageId];
    if (isSimilarEmittedMessage(selectedTraceMsg, candidateTraceMsg)) {
      foundId = traceEmittedMessageId;
      hasFoundId = true;
      return true
    }

    return false
  });

  if (hasFoundId) {
    jsonPatchOps = [{
      op: "replace",
      path: "/primarySelection",
      value: foundId
    }, {
      op: "replace",
      path: "/selectionRushIndex",
      value: currRushIndex
    }]
  }
  else {
    jsonPatchOps = [];
  }

  return jsonPatchOps
}

// TODO : more tests for ForEach/Inner, seems to be incorrect?? can we have both foreach/and inner displaying on the
// same path?

function render() {
  return $.of(div(`${traceNavigationPanelSelector}`, [
    img(`${navigateToPreviousComponentTraceButtonSelector}.icon`, {
      "attrs": {
        "src": "assets/open-iconic-master/svg/expand-right.svg",
        "alt": "icon name",
      }
    }),
    img(`${navigateToPreviousBreakButtonSelector}.icon`, {
      "attrs": {
        "src": "assets/open-iconic-master/svg/expand-up.svg",
        "alt": "icon name",
      }
    }),
    img(`${navigateToPreviousTraceIdButtonSelector}.icon`, {
      "attrs": {
        "src": "assets/open-iconic-master/svg/media-step-backward.svg",
        "alt": "icon name",
      }
    }),
    img(`${navigateToNextTraceIdButtonSelector}.icon`, {
      "attrs": {
        "src": "assets/open-iconic-master/svg/media-step-forward.svg",
        "alt": "icon name",
      }
    }),
    img(`${navigateToNextBreakButtonSelector}.icon`, {
      "attrs": {
        "src": "assets/open-iconic-master/svg/expand-down.svg",
        "alt": "icon name",
      }
    }),
    img(`${navigateToNextComponentTraceButtonSelector}.icon`, {
      "attrs": {
        "src": "assets/open-iconic-master/svg/expand-left.svg",
        "alt": "icon name",
      }
    })
  ]))
}

export function TraceNavigationPanel(sources, settings) {
  const DOM = sources[DOM_SINK];
  const devtoolState$ = sources[DEVTOOL_STATE_CHANNEL];

  const events = {
    navigateToNextTraceIdClick: DOM.select(navigateToNextTraceIdButtonSelector).events('click'),
    navigateToPreviousTraceIdClick: DOM.select(navigateToPreviousTraceIdButtonSelector).events('click'),
    // navigateToNextBreakClick: DOM.select(navigateToNextBreakButtonSelector).events('click'),
    // navigateToPreviousBreakClick: DOM.select(navigateToPreviousBreakButtonSelector).events('click'),
    navigateToNextComponentTraceId: DOM.select(navigateToNextComponentTraceButtonSelector).events('click'),
    navigateToPreviousComponentTraceId: DOM.select(navigateToPreviousComponentTraceButtonSelector).events('click'),
  };

  const actions = {
      navigateToNextTraceId: events.navigateToNextTraceIdClick.withLatestFrom(devtoolState$)
        .map(navigateToNextTraceId),
      navigateToPreviousTraceId: events.navigateToPreviousTraceIdClick.withLatestFrom(devtoolState$)
        .map(navigateToPreviousTraceId),
      // navigateToNextBreak: DOM.select(navigateToNextBreakButtonSelector).events('click'),
      // navigateToPreviousBreak:
      //   DOM.select(navigateToPreviousBreakButtonSelector).events('click'),
      navigateToNextComponentTraceId: events.navigateToNextComponentTraceId.withLatestFrom(devtoolState$)
        .map(navigateToNextComponentTraceId),
      navigateToPreviousComponentTraceId:events.navigateToPreviousComponentTraceId.withLatestFrom(devtoolState$)
          .map(navigateToPreviousComponentTraceId),
      renderNavigationUI: render()
    }
  ;

  return {
    [DEVTOOL_STATE_CHANNEL]: $.merge([
      actions.navigateToNextTraceId,
      actions.navigateToPreviousTraceId,
      actions.navigateToNextComponentTraceId,
      actions.navigateToPreviousComponentTraceId
    ]),
    [DOM_SINK]: actions.renderNavigationUI
  }
};
