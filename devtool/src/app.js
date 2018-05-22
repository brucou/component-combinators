import { DummyComponent, vLift } from "../../utils/src"
import { TraceNavigationPanel } from './TraceNavigationPanel'
import { ComponentTreePanel } from './ComponentTreePanel'
import { SourcesPanel } from './SourcesPanel'
import { SettingsPanel } from './SettingsPanel'
import { SinksPanel } from './SinksPanel'
import { GraphPanel } from './GraphPanel'
import { InSlot } from "../../src"
import { div } from "cycle-snabbdom"
import { InjectLocalState } from "../../src/components/Inject/InjectLocalState"
import { DEVTOOL_SOURCE_NAME } from "./properties"
import { TraceHandler } from "./TraceHandler"

const NavigationPanelSlot = 'NavigationSlot';
const ComponentTreePanelSlot = 'ComponentTreePanelSlot';
const SourcesPanelSlot = 'SourcesPanelSlot';
const SinksPanelSlot = 'SinksPanelSlot';
const SettingsPanelSlot = 'SettingsPanelSlot';
const GraphPanelSlot = 'GraphPanelSlot';

const initialState = {
  primarySelection: undefined,
  secondarySelection: undefined,
  sourcesForSelectedTrace: {}, // should start with sources
  sinksForSelectedTrace: {}, // should start with sinks but will be done at another level
  componentTreeForSelectedTrace: undefined,
  traces: [],
  // TODO : something else?
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
  sourceName: DEVTOOL_SOURCE_NAME,
  initialState: initialState,
}, [LayoutContainer, [
  TraceHandler, // will receive a trace and update local state
  InSlot(NavigationPanelSlot, [TraceNavigationPanel]),
  InSlot(ComponentTreePanelSlot, [ComponentTreePanel]),
  InSlot(SourcesPanelSlot, [SourcesPanel]),
  InSlot(SinksPanelSlot, [SettingsPanel]),
  InSlot(SettingsPanelSlot, [SinksPanel]),
  InSlot(GraphPanelSlot, [GraphPanel]),
]]);


