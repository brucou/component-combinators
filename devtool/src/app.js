import { vLift } from "../../utils/src"
import { TraceNavigationPanel } from './TraceNavigationPanel'
import { ComponentTreePanel } from './ComponentTreePanel'
import { SourcesPanel } from './SourcesPanel'
import { SettingsPanel } from './SettingsPanel'
import { SinksPanel } from './SinksPanel'
import { GraphPanel } from './GraphPanel'
import { InjectSources, InSlot, Pipe } from "../../src"
import { div } from "cycle-snabbdom"
import { InjectLocalState } from "../../src/components/Inject/InjectLocalState"
import { DEVTOOL_STATE_CHANNEL, SELECTED_STATE_CHANNEL } from "./properties"
import { TraceHandler } from "./TraceHandler"
import { READY_TOKEN } from "../../tracing/src"

const NavigationPanelSlot = 'NavigationSlot';
const ComponentTreePanelSlot = 'ComponentTreePanelSlot';
const SourcesPanelSlot = 'SourcesPanelSlot';
const SinksPanelSlot = 'SinksPanelSlot';
const SettingsPanelSlot = 'SettingsPanelSlot';
const GraphPanelSlot = 'GraphPanelSlot';

/** @type DevtoolState*/
const initialState = {
  primarySelection: 0, // TODO : review this later, I put 0 now as id
  secondarySelection: undefined,
  selectionRushIndex : 0,
  sourcesForSelectedTrace: [], // should start with sources
  sinksForSelectedTrace: [], // should start with sinks but will be done at another level
  // traces are rush-based. For each rush, [tree structure msg] followed by [emission msgs]
  currentRushIndex: 0,
  // Will have for each id/msg type the trace msg
  emissionTracesById: {},
  treeStructureTracesById: {},
  // Will keep at rush index the list of id part of the rush, starts with []
  emissionTraces: [],
  treeStructureTraces: [],
// map rush index : tree
  componentTrees: []
};

// ! coupled to devtool.css
const LayoutContainer = vLift(
  div('.container', [
    div('.navigation', { slot: NavigationPanelSlot }, []),
    div('.component-tree', { slot: ComponentTreePanelSlot }, []),
    div('.sources', { slot: SourcesPanelSlot }, []),
    div('.sinks', { slot: SinksPanelSlot }, []),
    div('.settings', { slot: SettingsPanelSlot }, []),
    div('.graph', { slot: GraphPanelSlot }, []),
  ])
);

function getSelectedChannelState(sources, settings) {
  return sources[DEVTOOL_STATE_CHANNEL]
    .map(devtoolState => ({
      primarySelection: devtoolState.primarySelection,
      secondarySelection: devtoolState.secondarySelection,
    }))
    .distinctUntilChanged( x => x,
      (a, b) => (a && a.primarySelection === b && b.primarySelection ) &&
        (a && a.secondarySelection === b && b.secondarySelection)
    )
    // used as an event, but must be a behaviour!!
    // The tree source comes from DEVTOOL_STATE_CHANNEL, so any event tied to DEVTOOL_STATE_CHANNEL is lost after
    // the ForEach, so we need to memoize the value
    // TODO : explain that in a doc...
    .shareReplay(1)
}

function SetupCrossDomain(sources, settings){
  const {crossWindowEmitter$, crossWindowReceiver$ } = sources;


  const events = {
    READY_ACK : crossWindowEmitter$.filter(x => !x.error), // NOTE : answer is display settings!!
    READY_NOK : crossWindowEmitter$.filter(x => x.error),
    TRACE_MSG : crossWindowReceiver$.map(event => JSON.parse(event.data))
  };
  const msgProcessingFSM = makeStreamingStateMachine(fsmDef,  settings );
  // makeStreamingStateMachine :: uses :: create_state_machine(fsmDef,  settings );
  // with let _value = automaton.start(); and automaton.yield to send a value
  // Note that the automaton is synchronous and as such async has to be simluated as state
  const fsmActions$ = msgProcessingFSM(events);
  ......processedAction$  = action$.filter(Boolean).map(action => processAction)

  const actions = {
    emitReadyMsg : $.of(READY_TOKEN),
    ...
  };

  return {
    crossWindowEmitter$ : actions.emitReadyMsg
  }
}

const Devtool = InjectLocalState({
    sourceName: DEVTOOL_STATE_CHANNEL,
    initialState: initialState,
  }, [
    InjectSources({ [SELECTED_STATE_CHANNEL]: getSelectedChannelState }, [LayoutContainer, [
      TraceHandler, // updates the devtool state according to incoming messages
      InSlot(NavigationPanelSlot, [TraceNavigationPanel]),
      InSlot(ComponentTreePanelSlot, [ComponentTreePanel]),
      InSlot(SourcesPanelSlot, [SourcesPanel]),
      InSlot(SinksPanelSlot, [SettingsPanel]),
      InSlot(SettingsPanelSlot, [SinksPanel]),
      InSlot(GraphPanelSlot, [GraphPanel]),
    ]])
  ]
);

export const App = Pipe({ Pipe: { throwIfSinkSourceConflict: true } }, [
  SetupCrossDomain,
  Devtool
])

// TODO :
// initialize ready message
// set the state machine -> action$
// from the action$, derive a traceMsg$ to be used in TraceHandler
// App = Pipe (SetupCrossDomain, Devtool)
// Devtool = InjectLocalState
// SetupCrossDomain = function (so,se){}
