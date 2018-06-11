import { DOM_SINK } from "../../utils/src"
import * as Rx from 'rx'
import { div, img } from "cycle-snabbdom"
import { DEVTOOL_STATE_CHANNEL } from "./properties"

const $ = Rx.Observable;
const traceNavigationPanelSelector = '.trace-navigation';
const navigateToNextTraceIdButtonSelector = '.trace-navigation__button--next-trace-id';
const navigateToPreviousTraceIdButtonSelector = '.trace-navigation__button--previous-trace-id';
const navigateToNextBreakButtonSelector = '.trace-navigation__button--next-break';
const navigateToPreviousBreakButtonSelector = '.trace-navigation__button--previous-break';
const navigateToNextMatchingOutputButonSelector = '.trace-navigation__button--next-output';
const navigateToPreviousMatchingOutputButonSelector = '.trace-navigation__button--previous-output';

function getRushIndexForSelectedTrace(emissionTraces, primarySelection){
  let selectedRushIndex = undefined;

  emissionTraces.some((indices, rushIndex) => {
    const index = emissionTraces[rushIndex].indexOf(primarySelection);
    return index > -1
      ? (selectedRushIndex = rushIndex, true)
      : false
  });

  if (selectedRushIndex === undefined) throw `TraceNavigationPanel > navigateToNextTraceId : impossible state reached! Handling a selected trace message id which is nowhere to be found in the devtool state repository!`

  return selectedRushIndex
}

/**
 *
 * @param {Event} event
 * @param {DevtoolState} devtoolState
 */
function navigateToNextTraceId([event, devtoolState]) {
  const {  primarySelection, selectionRushIndex, emissionTraces, emissionTracesById } = devtoolState;
  /** @typedef Array<JSON_Patch>*/
  let jsonPatchOps;

  const newSelectionId = primarySelection + 1;
  const setNewPrimarySelection = {
    op: "replace",
    path: "/primarySelection",
    value: newSelectionId
  };
  const isNextIdInRush = (emissionTraces, rush, id) => emissionTraces[rush].indexOf(id + 1) > -1;
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
  const isPreviousIdInRush = (emissionTraces, rush, id) => id >= 1 && emissionTraces[rush].indexOf(id - 1) > -1;
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

function render() {
  return $.of(div(`${traceNavigationPanelSelector}`, [
    img(`${navigateToPreviousMatchingOutputButonSelector}.icon`, {
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
    img(`${navigateToNextMatchingOutputButonSelector}.icon`, {
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
    navigateToNextBreakClick: DOM.select(navigateToNextBreakButtonSelector).events('click'),
    navigateToPreviousBreakClick: DOM.select(navigateToPreviousBreakButtonSelector).events('click'),
    navigateToNextMatchingOutputClick: DOM.select(navigateToNextMatchingOutputButonSelector).events('click'),
    navigateToPreviousMatchingInputClick: DOM.select(navigateToPreviousMatchingOutputButonSelector).events('click'),
  };

  const actions = {
      navigateToNextTraceId: events.navigateToNextTraceIdClick.withLatestFrom(devtoolState$)
        .map(navigateToNextTraceId),
      navigateToPreviousTraceId: events.navigateToPreviousTraceIdClick.withLatestFrom(devtoolState$)
        .map(navigateToPreviousTraceId),
      // navigateToNextBreak: DOM.select(navigateToNextBreakButtonSelector).events('click'),
      // navigateToPreviousBreak:
      //   DOM.select(navigateToPreviousBreakButtonSelector).events('click'),
      // navigateToNextMatchingOutput:
      //   DOM.select(navigateToNextMatchingOutputButonSelector).events('click'),
      // navigateToPreviousMatchingInput:
      //   DOM.select(navigateToPreviousMatchingOutputButonSelector).events('click'),
      renderNavigationUI: render()
    }
  ;

  return {
    [DEVTOOL_STATE_CHANNEL]: $.merge([
      actions.navigateToNextTraceId,
      actions.navigateToPreviousTraceId
    ]),
    [DOM_SINK]: actions.renderNavigationUI
  }
};
