import { SEP } from "./properties"
import { SINK_EMISSION, SOURCE_EMISSION } from "../../tracing/src"
import { flatten, merge, range } from 'ramda';

export const PROCESS_TREE_STRUCTURE_MSG = 'PROCESS_TREE_STRUCTURE_MSG';
export const PROCESS_DATA_EMISSION_MSG = 'PROCESS_DATA_EMISSION_MSG';
export const TREE_STRUCTURE_MSG = 'graph_structure';
export const DATA_EMISSION_MSG = 'runtime';

const EMPTY_TREE = { cursor: "0", hash: {} };

function getTraceMsgLogType(msg) {
  return msg.logType
}

// TODO : !! edge case with path repeating itself to analyze what to do... nothing for now
// TODO : refactor so to use push possibility of json patch

/**
 * Inlined state machine with two states and four transitions, which computes the state for the devtool, destined to
 * be used by all trace-related GUI components
 * @param {String} controlState
 * @param {TreeStructureMsg | EmissionMsg} traceMsg
 * @returns {{action: (function(TreeStructureMsg, DevtoolState): *)|(function(EmissionMsg, DevtoolState): *),
 *   newControlState: string}}
 */
export function processTraceStateMachine(controlState, traceMsg) {
  let action;
  let newControlState;
  const incomingEvent = getTraceMsgLogType(traceMsg);

  switch (incomingEvent) {
    case TREE_STRUCTURE_MSG :
      switch (controlState) {
        case PROCESS_TREE_STRUCTURE_MSG :
          // Case : We are receiving trace about the component tree structure while being in the processing state
          // we continue to improve our tree knowledge
          // we remain in the same state
          action = processIncomingTreeMsgWhileInTreeStructureState;
          newControlState = PROCESS_TREE_STRUCTURE_MSG;
          break;
        case PROCESS_DATA_EMISSION_MSG :
          // Case : We are receiving trace about the component tree structure while being in the data emission state
          // This is a breaking transition : we update the relevant data
          // we change control state
          action = processIncomingTreeMsgWhileInEmissionState;
          newControlState = PROCESS_TREE_STRUCTURE_MSG;
          break;
        default :
          throw `TraceHandler > devtoolStateUpdate$ : internal state machine in unexpected state! ${controlState}`
      }
      break;
    case DATA_EMISSION_MSG :
      switch (controlState) {
        case PROCESS_TREE_STRUCTURE_MSG :
          // Case : We are receiving trace of emission while being in the tree structure control state
          // This is a breaking transition : we update the relevant data
          // we change control state
          action = processEmissionMsgWhileInTreeStructureState;
          newControlState = PROCESS_DATA_EMISSION_MSG;
          break;
        case PROCESS_DATA_EMISSION_MSG :
          // Case : We are receiving trace of emission while being in the emission control state
          // we continue to improve our emission knowledge
          // we remain in the same state
          action = processEmissionMsgWhileInEmissionState;
          newControlState = PROCESS_DATA_EMISSION_MSG;
          break;
        default :
          throw `TraceHandler > devtoolStateUpdate$ : internal state machine in unexpected state! ${controlState}`
      }
      break;
    default :
      throw `TraceHandler > devtoolStateUpdate$ : received unexpected trace message type! ${traceMsg}`
  }

  return { action, newControlState }
}

/**
 *
 * @param {TreeStructureMsg} traceMsg
 * @param {DevtoolState} devtoolState
 * @returns {Array} Array of json patch updates
 */
function processIncomingTreeMsgWhileInTreeStructureState(traceMsg, devtoolState) {
  const { currentRushIndex, treeStructureTraces, } = devtoolState;
  const index = (treeStructureTraces[currentRushIndex] || []).length;

  const updateSelectionRushIndex = null;
  const updatePrimarySelection = null;
  const updateSecondarySelection = null;
  const updateSourcesForSelectedTrace = null;
  const updateSinksForSelectedTrace = null;
  const updateCurrentRushIndex = null;
  const updateEmissionTracesById = null;
  const updateComponentTrees = null;
  const updateEmissionTraces = null;

  const updateTreeStructureTracesAtIndex = {
    op: "add",
    path: `/treeStructureTraces/${currentRushIndex}/${index}`,
    value: traceMsg.id
  };
  const updateTreeStructureTraces = treeStructureTraces[currentRushIndex]
    ? updateTreeStructureTracesAtIndex
    : [
      {
        op: "add",
        path: `/treeStructureTraces/${currentRushIndex}`,
        value: []
      },
      updateTreeStructureTracesAtIndex
    ]

  const updateTreeStructureTracesById = {
    op: "add",
    path: `/treeStructureTracesById/${traceMsg.id}`,
    value: traceMsg
  }

  return flatten([
    updatePrimarySelection,
    updateSecondarySelection,
    updateSelectionRushIndex,
    updateSourcesForSelectedTrace,
    updateSinksForSelectedTrace,
    updateComponentTrees,
    updateCurrentRushIndex,
    updateEmissionTracesById,
    updateTreeStructureTracesById,
    updateEmissionTraces,
    updateTreeStructureTraces,
  ])
}

/**
 *
 * @param {EmissionMsg} traceMsg
 * @param {DevtoolState} devtoolState
 * @returns {Array} Array of json patch updates
 */
function processEmissionMsgWhileInTreeStructureState(traceMsg, devtoolState) {
  const {
    sourcesForSelectedTrace,
    sinksForSelectedTrace,
    currentRushIndex,
    treeStructureTracesById,
    treeStructureTraces,
    componentTrees
  } = devtoolState;

  const updatePrimarySelection = null;
  const updateSecondarySelection = null;
  const updateSelectionRushIndex = null;
  const updateCurrentRushIndex = null;
  const updateTreeStructureTracesById = null;
  const updateTreeStructureTraces = null;

  const prevComponentTree = currentRushIndex > 0 ? componentTrees[currentRushIndex - 1] : EMPTY_TREE;
  const currentComponentTreePaths = treeStructureTraces[currentRushIndex].map(treeStructureTraceId => {
    const traceMsg = treeStructureTracesById[treeStructureTraceId];

    return traceMsg.path
  });

  const withRemovedObsoletePaths = currentComponentTreePaths.reduce((acc, currentComponentTreePath) => {
    // remove all the paths which are same or below currentComponentTreePath
    return acc.filter(prevComponentTreePath => {
      return !prevComponentTreePath.startsWith(currentComponentTreePath.join(SEP))
    })
  }, Object.keys(prevComponentTree.hash));

  const withRemovedObsoleteContent = withRemovedObsoletePaths.reduce((acc, prevNonObsoletePath) => {
    acc[prevNonObsoletePath] = prevComponentTree.hash[prevNonObsoletePath];

    return acc
  }, {});

  const withNewContent = treeStructureTraces[currentRushIndex].reduce((acc, treeStructureTraceId) => {
    const traceMsg = treeStructureTracesById[treeStructureTraceId];
    const newContentPath = traceMsg.path.join(SEP);

    acc[newContentPath] = traceMsg;

    return acc
  }, {});

  const newTreeContent = merge(withRemovedObsoleteContent, withNewContent);

  const newTree = {
    cursor: '0',
    hash: newTreeContent
  };

  const updateComponentTrees = {
    op: "replace",
    path: `/componentTrees/${currentRushIndex}`,
    value: newTree
  };

  const updateEmissionTracesById = {
    op: "add",
    path: `/emissionTracesById/${traceMsg.id}`,
    value: traceMsg
  };

  const updateEmissionTraces = [{
    op: "add",
    path: `/emissionTraces/${currentRushIndex}`,
    value: []
  }, {
    op: "add",
    path: `/emissionTraces/${currentRushIndex}/0`,
    value: traceMsg.id
  }];

  const msgType = traceMsg.emits.type;

  let updateSourcesForSelectedTrace, updateSinksForSelectedTrace;

  switch (msgType) {
    case  SOURCE_EMISSION :
      updateSinksForSelectedTrace = null;
      const updateSourcesForSelectedTraceAtPathIndex = {
        op: "add",
        path: `/sourcesForSelectedTrace/${currentRushIndex}/${traceMsg.path.join(SEP)}`,
        value: traceMsg
      };
      updateSourcesForSelectedTrace = sourcesForSelectedTrace[currentRushIndex]
        ? updateSourcesForSelectedTraceAtPathIndex
        : [
          {
            op: "add",
            path: `/sourcesForSelectedTrace/${currentRushIndex}`,
            value: []
          },
          updateSourcesForSelectedTraceAtPathIndex
        ]
      break;

    case SINK_EMISSION :
      updateSourcesForSelectedTrace = null;
      const updateSinksForSelectedTraceAtPathIndex = {
        op: "add",
        path: `/sinksForSelectedTrace/${currentRushIndex}/${traceMsg.path.join(SEP)}`,
        value: traceMsg
      };

      updateSinksForSelectedTrace = sinksForSelectedTrace[currentRushIndex]
        ? updateSinksForSelectedTraceAtPathIndex
        : range(sinksForSelectedTrace.length, currentRushIndex + 1).map(index => ({
          op: "add",
          path: `/sinksForSelectedTrace/${index}`,
          value: []
        }))
          .concat(updateSinksForSelectedTraceAtPathIndex);
      break;

    default :
      throw `processEmissionMsgWhileInTreeStructureState > unexpected message emission type (neither source nor sink?) : ${msgType}`
  }

  return flatten([
    updatePrimarySelection,
    updateSecondarySelection,
    updateSelectionRushIndex,
    updateSourcesForSelectedTrace,
    updateSinksForSelectedTrace,
    updateComponentTrees,
    updateCurrentRushIndex,
    updateEmissionTracesById,
    updateTreeStructureTracesById,
    updateEmissionTraces,
    updateTreeStructureTraces,
  ])
}

/**
 *
 * @param {TreeStructureMsg} traceMsg
 * @param {DevtoolState} devtoolState
 * @returns {Array} Array of json patch updates
 */
function processIncomingTreeMsgWhileInEmissionState(traceMsg, devtoolState) {
  const { currentRushIndex, componentTrees } = devtoolState;

  const updatePrimarySelection = null;
  const updateSecondarySelection = null;
  const updateSelectionRushIndex = null;
  const updateSourcesForSelectedTrace = null;
  const updateSinksForSelectedTrace = null;
  const updateEmissionTracesById = null;
  const updateEmissionTraces = null;

  const newRushIndex = currentRushIndex + 1
  const updateCurrentRushIndex = {
    op: "add",
    path: "/currentRushIndex",
    value: newRushIndex
  };

  const updateComponentTrees = {
    op: "add",
    path: `/componentTrees/${newRushIndex}`,
    value: merge({}, componentTrees[currentRushIndex])
  };

  // TODO :simply at some point by using - syntax from json patch (push)
  const updateTreeStructureTraces = [{
    op: "add",
    path: `/treeStructureTraces/${newRushIndex}`,
    value: []
  }, {
    op: "add",
    path: `/treeStructureTraces/${newRushIndex}/0`,
    value: traceMsg.id
  }];

  const updateTreeStructureTracesById = {
    op: "add",
    path: `/treeStructureTracesById/${traceMsg.id}`,
    value: traceMsg
  }

  return flatten([
    updatePrimarySelection,
    updateSecondarySelection,
    updateSelectionRushIndex,
    updateSourcesForSelectedTrace,
    updateSinksForSelectedTrace,
    updateComponentTrees,
    updateCurrentRushIndex,
    updateEmissionTracesById,
    updateTreeStructureTracesById,
    updateEmissionTraces,
    updateTreeStructureTraces,
  ])
}

/**
 *
 * @param {EmissionMsg} traceMsg
 * @param {DevtoolState} devtoolState
 * @returns {Array} Array of json patch updates
 */
function processEmissionMsgWhileInEmissionState(traceMsg, devtoolState) {
  const {
    sourcesForSelectedTrace,
    sinksForSelectedTrace,
    currentRushIndex,
    emissionTraces,
  } = devtoolState;
  const index = (emissionTraces[currentRushIndex] || []).length;

  const updatePrimarySelection = null;
  const updateSecondarySelection = null;
  const updateSelectionRushIndex = null;
  const updateTreeStructureTraces = null;
  const updateTreeStructureTracesById = null;
  const updateCurrentRushIndex = null;
  const updateComponentTrees = null;
  // emissionTraces intact

  const updateEmissionTracesById = {
    op: "add",
    path: `/emissionTracesById/${traceMsg.id}`,
    value: traceMsg
  };

  const updateEmissionTraces = {
    op: "add",
    path: `/emissionTraces/${currentRushIndex}/${index}`,
    value: traceMsg.id
  };

  const msgType = traceMsg.emits.type;

  let updateSourcesForSelectedTrace, updateSinksForSelectedTrace;

  switch (msgType) {
    case  SOURCE_EMISSION :
      updateSinksForSelectedTrace = null;
      const updateSourcesForSelectedTraceAtPathIndex = {
        op: "add",
        path: `/sourcesForSelectedTrace/${currentRushIndex}/${traceMsg.path}`,
        value: traceMsg
      };
      updateSourcesForSelectedTrace = sourcesForSelectedTrace[currentRushIndex]
        ? updateSourcesForSelectedTraceAtPathIndex
        : range(sourcesForSelectedTrace.length, currentRushIndex + 1).map(index => ({
          op: "add",
          path: `/sourcesForSelectedTrace/${index}`,
          value: []
        }))
          .concat(updateSourcesForSelectedTraceAtPathIndex);
      break;

    case SINK_EMISSION :
      updateSourcesForSelectedTrace = null;
      const updateSinksForSelectedTraceAtPathIndex = {
        op: "add",
        path: `/sinksForSelectedTrace/${currentRushIndex}/${traceMsg.path}`,
        value: traceMsg
      };
      updateSinksForSelectedTrace = sinksForSelectedTrace[currentRushIndex]
        ? updateSinksForSelectedTraceAtPathIndex
        : range(sinksForSelectedTrace.length, currentRushIndex + 1).map(index => ({
          op: "add",
          path: `/sinksForSelectedTrace/${index}`,
          value: []
        }))
          .concat(updateSinksForSelectedTraceAtPathIndex);
      break;

    default :
      throw `processEmissionMsgWhileInEmissionState > unexpected message emission type (neither source nor sink?) : ${msgType}`
  }

  return flatten([
    updatePrimarySelection,
    updateSecondarySelection,
    updateSelectionRushIndex,
    updateSourcesForSelectedTrace,
    updateSinksForSelectedTrace,
    updateComponentTrees,
    updateCurrentRushIndex,
    updateEmissionTracesById,
    updateTreeStructureTracesById,
    updateEmissionTraces,
    updateTreeStructureTraces,
  ])
}
