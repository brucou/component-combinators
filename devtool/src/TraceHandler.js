import { removeNullsFromArray } from "../../utils/src"
import { DEVTOOL_SOURCE_NAME } from "./properties"
import { SINK_EMISSION, SOURCE_EMISSION } from "../../tracing/src"

const PROCESS_TREE_STRUCTURE_MSG = 'PROCESS_TREE_STRUCTURE_MSG';
const PROCESS_DATA_EMISSION_MSG = 'PROCESS_DATA_EMISSION_MSG';
const initialTraceControlState = PROCESS_TREE_STRUCTURE_MSG;
const TREE_STRUCTURE_MSG = 'TREE_STRUCTURE_MSG';
const DATA_EMISSION_MSG = 'DATA_EMISSION_MSG';

function getTraceMsgLogType(msg) {
  return msg.logType
}

// TODO : !! edge case with path repeating itself to analyze what to do... nothing for now

/**
 * Updates state for all trace-related components, for each incoming trace message.
 * Reminder : two types of trace messages having tree structure information, or data emission trace
 * Data emission itself can be a source data emission or a sink data emission
 * @param {Sources} sources
 * @param {Settings} settings
 * @returns Sinks
 *
 * ADR Implementation notes :
 * - The core state we need is the array of all trace messages, and the selected points.
 * - The state we compute here is derived incrementally from that core state, namely it is recomputed for every
 * incoming trace message
 * - A simpler implementation would be to use a sql-like dsl to compute the derived state
 *   - for instance [qo-sql](https://github.com/timtian/qo-sql) does the job, at little Kb cost (when used with babel
 *   which precompiles the query and inline it in the generated code). Query compiling can be customized (to lodash, or
 *   underscore)
 *   - however every query would be perfomed on an ever growing set of traces, which makes it potentially
 *   inefficient at scale (not that we should ever reach that kind of scale where we care, but still), and repeating the
 *   same operations.
 * - So for efficiency reasons, we precompute all necessary pieces of state for the client components down the tree.
 *
 * - The incremental computation itself is taken care by a state machine with two states and four transitions, which
 * we have inlined also here for reasons of efficiency, vs. using a dedicated state machine library.
 */
export const TraceHandler = function TraceHandler(sources, settings) {
  // will receive a trace and update local state
  const { crossWindowMessaging$ } = sources;
  const devtoolState$ = sources[DEVTOOL_SOURCE_NAME];
  let controlState = initialTraceControlState;

  function processTraceStateMachine(traceMsg){
    let action;

    switch (getTraceMsgLogType(traceMsg)) {
      case TREE_STRUCTURE_MSG :
        switch (controlState) {
          case PROCESS_TREE_STRUCTURE_MSG :
            // Case : We are receiving trace about the component tree structure while being in the processing state
            // we continue to improve our tree knowledge
            // we remain in the same state
            action = processIncomingTreeMsgWhileInTreeStructureState;
            break;
          case PROCESS_DATA_EMISSION_MSG :
            // Case : We are receiving trace about the component tree structure while being in the data emission state
            // This is a breaking transition : we update the relevant data
            // we change control state
            action = processIncomingTreeMsgWhileInEmissionState;
            controlState = PROCESS_TREE_STRUCTURE_MSG;
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
            controlState = PROCESS_DATA_EMISSION_MSG;
            break;
          case PROCESS_DATA_EMISSION_MSG :
            // Case : We are receiving trace of emission while being in the emission control state
            // we continue to improve our emission knowledge
            // we remain in the same state
            action = processEmissionMsgWhileInEmissionState;
            break;
          default :
            throw `TraceHandler > devtoolStateUpdate$ : internal state machine in unexpected state! ${controlState}`
        }
        break;
      default :
        throw `TraceHandler > devtoolStateUpdate$ : received unexpected trace message type! ${traceMsg}`
    }

    return action
  }

  const devtoolStateUpdate$ = crossWindowMessaging$.withLatestFrom(devtoolState$)
    .map((traceMsg, devtoolState) => {
      // State machine which as always takes an input, and returns an action, while updating internal state
      // (here `controlState` in closure)
      const action = processTraceStateMachine(traceMsg)

      return removeNullsFromArray(action(traceMsg, devtoolState))
    })

  return {
    [DEVTOOL_SOURCE_NAME]: devtoolStateUpdate$
  }
};

function processIncomingTreeMsgWhileInTreeStructureState(traceMsg, devtoolState) {
  const { logType, componentName, combinatorName, isContainerComponent, when, path, id } = traceMsg;

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
  const index = (treeStructureTraces[currentRushIndex] || []).length;

  const updatePrimarySelection = null;
  const updateSecondarySelection = null;
  const updateSourcesForSelectedTrace = null;
  const updateSinksForSelectedTrace = null;
  const updateCurrentRushIndex = null;
  const updateEmissionTracesById = null;
  const updateComponentTrees = null;
  const updateEmissionTraces = null;
  // emissionTraces intact

  const updateTreeStructureTraces = {
    op: "add",
    path: `/treeStructureTraces/${currentRushIndex}/${index}`,
    value: traceMsg.id
  };

  const updateTreeStructureTracesById = {
    op: "add",
    path: `/treeStructureTracesById/${traceMsg.id}`,
    value: traceMsg
  }

  return [
    updatePrimarySelection,
    updateSecondarySelection,
    updateSourcesForSelectedTrace,
    updateSinksForSelectedTrace,
    updateComponentTrees,
    updateCurrentRushIndex,
    updateEmissionTracesById,
    updateTreeStructureTracesById,
    updateEmissionTraces,
    updateTreeStructureTraces,
  ]
}

function processEmissionMsgWhileInTreeStructureState(traceMsg, devtoolState) {
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

  const updatePrimarySelection = null;
  const updateSecondarySelection = null;
  const updateCurrentRushIndex = null;
  const updateTreeStructureTracesById = null;
  const updateTreeStructureTraces = null;

  const treeContent = treeStructureTraces[currentRushIndex].reduce((acc, treeStructureTraceId) =>{
    const traceMsg = treeStructureTracesById[treeStructureTraceId];

    acc[traceMsg.path] = traceMsg;
    return acc
  }, {});

  const tree = {
    cursor : '0',
    hash : treeContent
  };

  const updateComponentTrees = {
    op:"add",
    path : `/treeStructureTraces/${currentRushIndex}`,
    value : tree
  };

  const updateEmissionTracesById = {
    op : "add",
    path : `/emissionTracesById/${traceMsg.id}`,
    value : traceMsg
  };

  const updateEmissionTraces = {
    op: "add",
    path: `/emissionTraces/${currentRushIndex}/0`,
    value: traceMsg.id
  };

  const msgType = traceMsg.emits.type;

  let updateSourcesForSelectedTrace, updateSinksForSelectedTrace;

  switch (msgType){
    case  SOURCE_EMISSION :
       updateSinksForSelectedTrace = null;
       updateSourcesForSelectedTrace = {
         op : "add",
         path : `/sourcesForSelectedTrace/${currentRushIndex}/${traceMsg.path}`,
         value : traceMsg
       }
      break;

    case SINK_EMISSION :
      updateSourcesForSelectedTrace = null;
      updateSinksForSelectedTrace = {
        op : "add",
        path : `/sinksForSelectedTrace/${currentRushIndex}/${traceMsg.path}`,
        value : traceMsg
      }
      break;

    default :
      throw `processEmissionMsgWhileInTreeStructureState > unexpected message emission type (neither source nor sink?) : ${msgType}`
  }

  return [
    updatePrimarySelection,
    updateSecondarySelection,
    updateSourcesForSelectedTrace,
    updateSinksForSelectedTrace,
    updateComponentTrees,
    updateCurrentRushIndex,
    updateEmissionTracesById,
    updateTreeStructureTracesById,
    updateEmissionTraces,
    updateTreeStructureTraces,
  ]
}

function processIncomingTreeMsgWhileInEmissionState(traceMsg, devtoolState) {
  const { logType, componentName, combinatorName, isContainerComponent, when, path, id } = traceMsg;

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

  const updatePrimarySelection = null;
  const updateSecondarySelection = null;
  const updateSourcesForSelectedTrace = null;
  const updateSinksForSelectedTrace = null;
  const updateEmissionTracesById = null;
  const updateEmissionTraces = null;
  const updateComponentTrees = null;

  const newRushIndex = currentRushIndex + 1
  const updateCurrentRushIndex = {
    op : "add",
    path : "/currentRushIndex",
    value : newRushIndex
  };

  const updateTreeStructureTraces = {
    op: "add",
    path: `/treeStructureTraces/${newRushIndex}/0`,
    value: traceMsg.id
  };

  const updateTreeStructureTracesById = {
    op: "add",
    path: `/treeStructureTracesById/${traceMsg.id}`,
    value: traceMsg
  }

  return [
    updatePrimarySelection,
    updateSecondarySelection,
    updateSourcesForSelectedTrace,
    updateSinksForSelectedTrace,
    updateComponentTrees,
    updateCurrentRushIndex,
    updateEmissionTracesById,
    updateTreeStructureTracesById,
    updateEmissionTraces,
    updateTreeStructureTraces,
  ]
}

function processEmissionMsgWhileInEmissionState(traceMsg, devtoolState) {
  const { logType, componentName, combinatorName, isContainerComponent, when, path, id } = traceMsg;

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
  const index = (emissionTraces[currentRushIndex] || []).length;

  const updatePrimarySelection = null;
  const updateSecondarySelection = null;
  const updateTreeStructureTraces = null;
  const updateTreeStructureTracesById = null;
  const updateCurrentRushIndex = null;
  const updateComponentTrees = null;
  // emissionTraces intact

  const updateEmissionTracesById = {
    op : "add",
    path : `/emissionTracesById/${traceMsg.id}`,
    value : traceMsg
  };

  const updateEmissionTraces = {
    op: "add",
    path: `/emissionTraces/${currentRushIndex}/${index}`,
    value: traceMsg.id
  };

  const msgType = traceMsg.emits.type;

  let updateSourcesForSelectedTrace, updateSinksForSelectedTrace;

  switch (msgType){
    case  SOURCE_EMISSION :
      updateSinksForSelectedTrace = null;
      updateSourcesForSelectedTrace = {
        op : "add",
        path : `/sourcesForSelectedTrace/${currentRushIndex}/${traceMsg.path}`,
        value : traceMsg
      }
      break;

    case SINK_EMISSION :
      updateSourcesForSelectedTrace = null;
      updateSinksForSelectedTrace = {
        op : "add",
        path : `/sinksForSelectedTrace/${currentRushIndex}/${traceMsg.path}`,
        value : traceMsg
      }
      break;

    default :
      throw `processEmissionMsgWhileInEmissionState > unexpected message emission type (neither source nor sink?) : ${msgType}`
  }


  return [
    updatePrimarySelection,
    updateSecondarySelection,
    updateSourcesForSelectedTrace,
    updateSinksForSelectedTrace,
    updateComponentTrees,
    updateCurrentRushIndex,
    updateEmissionTracesById,
    updateTreeStructureTracesById,
    updateEmissionTraces,
    updateTreeStructureTraces,
  ]
}
