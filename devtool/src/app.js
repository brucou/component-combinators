import { vLift } from "../../utils/src"
import { TraceNavigationPanel } from './TraceNavigationPanel'
import { ComponentTreePanel } from './ComponentTreePanel'
import { SourcesPanel } from './SourcesPanel'
import { SettingsPanel } from './SettingsPanel'
import { SinksPanel } from './SinksPanel'
import { GraphPanel } from './GraphPanel'
import { InSlot } from "../../src"
import { div } from "cycle-snabbdom"
import { InjectLocalState } from "../../src/components/Inject/InjectLocalState"
import { DEVTOOL_STATE_CHANNEL } from "./properties"
import { TraceHandler } from "./TraceHandler"

const NavigationPanelSlot = 'NavigationSlot';
const ComponentTreePanelSlot = 'ComponentTreePanelSlot';
const SourcesPanelSlot = 'SourcesPanelSlot';
const SinksPanelSlot = 'SinksPanelSlot';
const SettingsPanelSlot = 'SettingsPanelSlot';
const GraphPanelSlot = 'GraphPanelSlot';

const initialState = {
  primarySelection: 0, // TODO : review this later, I put 0 now as id
  secondarySelection: undefined,
  sourcesForSelectedTrace: [], // should start with sources
  sinksForSelectedTrace: [], // should start with sinks but will be done at another level
  // traces are rush-based. For each rush, [tree structure msg] followed by [emission msgs]
  currentRushIndex : 0,
  // Will have for each id/msg type the trace msg
  emissionTracesById : {},
  treeStructureTracesById : {},
  // Will keep at rush index the list of id part of the rush, starts with []
  emissionTraces : [],
  treeStructureTraces : [],
// map rush index : tree
  componentTrees : []
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

export const App = InjectLocalState({
  sourceName: DEVTOOL_STATE_CHANNEL,
  initialState: initialState,
}, [LayoutContainer, [
  TraceHandler, // updates the devtool state according to incoming messages
  InSlot(NavigationPanelSlot, [TraceNavigationPanel]),
  InSlot(ComponentTreePanelSlot, [ComponentTreePanel]),
  InSlot(SourcesPanelSlot, [SourcesPanel]),
  InSlot(SinksPanelSlot, [SettingsPanel]),
  InSlot(SettingsPanelSlot, [SinksPanel]),
  InSlot(GraphPanelSlot, [GraphPanel]),
]]);
