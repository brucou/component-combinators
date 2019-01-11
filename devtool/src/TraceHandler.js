import { removeNullsFromArray } from "../../utils/src"
import { DEVTOOL_STATE_CHANNEL } from "./properties"
import { PROCESS_TREE_STRUCTURE_MSG, processTraceStateMachine } from "./DevtoolState"

const initialTraceControlState = PROCESS_TREE_STRUCTURE_MSG;

/**
 * Updates state used by all trace-related components, for each incoming trace message.
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
  // Will receive a trace and update local state
  const { crossWindowMessaging$ } = sources;
  const devtoolState$ = sources[DEVTOOL_STATE_CHANNEL];
  let controlState = initialTraceControlState;

  const devtoolStateUpdate$ = crossWindowMessaging$.withLatestFrom(devtoolState$)
    .map(([traceMsg, devtoolState]) => {
      // State machine which as always takes an input, and returns an action, while updating internal state
      // (here `controlState` in closure)
      const { action, newControlState } = processTraceStateMachine(controlState, traceMsg);
      controlState = newControlState;

      return removeNullsFromArray(action(traceMsg, devtoolState))
    })

  return {
    [DEVTOOL_STATE_CHANNEL]: devtoolStateUpdate$
  }
};

// TODO : will have to change as crossWindowMessaging$ no longer exists
