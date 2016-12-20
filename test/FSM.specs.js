// let Qunit = require('qunitjs');
import * as QUnit from 'qunitjs';
import {map as mapR, reduce as reduceR, always, clone, __} from 'ramda';
import * as jsonpatch from 'fast-json-patch';
import * as Rx from 'rx';
import h from 'snabbdom/h';
import {div, span} from 'cycle-snabbdom';
import {m} from '../src/components/m';
import {projectSinksOn, makeDivVNode} from '../src/utils';
import {runTestScenario} from '../src/runTestScenario';
import {
  EV_GUARD_NONE,
  ACTION_REQUEST_NONE,
  ACTION_GUARD_NONE,
  makeFSM
} from '../src/components/FSM'

let $ = Rx.Observable;

// Fixtures
const sinkNames = ['sinkA', 'sinkB', 'sinkC', 'sinkModel'];
const dummyValue = 'dummy';
const dummyValue1 = 'dummy1';
const dummyValue2 = 'dummy2';
// NOTE : a function as a value is used here to test against json patching
// library
const dummyValue3 = function dummyFunction(){ return 'dummy3'};
const dummySinkA3Values = ['dummySinkA1', 'dummySinkA2', 'dummySinkA3'];
const dummySinkB2Values = ['dummySinkB1', 'dummySinkB2'];
const dummySinkC1Value = ['dummySinkC1'];
const initialModel = {
  dummyKey1InitModel: dummyValue1,
  dummyKey2InitModel: dummyValue2,
};
const opsOnInitialModel = [
  {op: "add", path: '/dummyKey3InitModel', value: dummyValue3},
  {op: "replace", path: '/dummyKey1InitModel', value: dummyValue2},
  {op: "remove", path: '/dummyKey2InitModel'},
];
const initEventData = {
  dummyKeyEvInit: dummyValue
};

function dummyComponent1Sink(sources, settings) {
  const {model} = settings;

  return {
    sinkA: generateValuesWithInterval(dummySinkA3Values, 10),
    sinkB: generateValuesWithInterval(dummySinkB2Values, 15),
    sinkModel: generateValuesWithInterval([model], 1)
  }
}

function generateValuesWithInterval(arrayValues, timeInterval) {
  return $.generateWithAbsoluteTime(
    0,
    index => index < arrayValues.length,
    index => index + 1,
    index => arrayValues[index],
    index => index ? timeInterval : 0 // emit first value sooner
  )
}

QUnit.module("makeFSM :: Events -> Transitions -> StateEntryComponents -> FSM_Settings -> Component", {});

//// Init event
///  - Also testing EV_GUARD_NONE, ACTION_REQUEST_NONE, ACTION_GUARD_NONE
// - GIVEN : FSM `Model, SinkNames`,  transition `Ev.INIT -> evG(none) -> S.Init -> T -> Ar(none) -> Ag(none) -> U`, `init: Model -> Component(_, model)`
// - GIVEN : Component emits two values on two sinks in SinkNames
// - WHEN state machine is initialized THEN :
//   - Update U is called with right parameters (i.e. Ev.INIT is triggered)
// - init state component factory function is called with the right parameters
// - FSM emits component sinks as expected
QUnit.test(
  "Initialization of state machine - INIT event",
  function exec_test(assert) {
    let done = assert.async(3);

    function modelUpdateInitTransition(model, eventData, actionResponse) {
      assert.deepEqual(model, initialModel,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose first parameter is the initial' +
        ' model');
      assert.deepEqual(eventData, initEventData,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose second parameter is the ' +
        ' event data for the INIT event');
      assert.deepEqual(actionResponse, null,
        'The INIT event triggers a call to the configured update' +
        ' model function, whose third parameter is the ' +
        ' response for the action corresponding to the transition');

      return opsOnInitialModel
    }

    const events = {};
    // Transitions :: HashMap TransitionName TransitionOptions
    // TransitionOptions :: Record {
    //   origin_state :: State, event :: EventName, target_states ::
    // [Transition]
    // }
    // Transition :: Record {
    //   event_guard :: EventGuard, action_request :: ActionRequest,
    //   transition_evaluation :: [TransEval]
    // }
    // ActionRequest : Record {
    //   driver :: SinkName | ZeroDriver,
    //   request :: (FSM_Model -> EventData) -> Request
    // }
    // TransEval :: Record {
    //   action_guard :: ActionGuard
    //   target_state :: State
    //   model_update :: FSM_Model -> EventData -> ActionResponse ->
    //                                                       UpdateOperations
    // }
    // StateEntryComponents :: HashMap State StateEntryComponent
    // StateEntryComponent :: FSM_Model -> Component
    // FSM_Settings :: Record {
    //  initial_model :: FSM_Model
    //  init_event_data :: Event_Data
    //  sinkNames :: [SinkName]
    // }

    const transitions = {
      T_INIT: {
        origin_state: 'S_INIT',
        event: 'EV_INIT',
        target_states: [
          {
            event_guard: EV_GUARD_NONE,
            action_request: ACTION_REQUEST_NONE,
            transition_evaluation: [
              {
                action_guard: ACTION_GUARD_NONE,
                target_state: 'First',
                model_update: modelUpdateInitTransition
              }
            ]
          }
        ]
      }
    };

    const entryComponents = {
      First: function (model) {
        return curry(dummyComponent1Sink)(__, {model})
      }
    };

    const fsmSettings = {
      initial_model: initialModel,
      init_event_data: initEventData,
      sinkNames: sinkNames
    };

    const fsmComponent = makeFSM(events, transitions, entryComponents, fsmSettings);

    const inputs = [];

    function analyzeTestResults(actual, expected, message) {
      assert.deepEqual(actual, expected, message);
      done()
    }

    const updatedModel = jsonpatch.apply(clone(initialModel), opsOnInitialModel);

    /** @type TestResults */
    const testResults = {
      sinkA: {
        outputs: dummySinkA3Values,
        successMessage: 'sink sinkA produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkB: {
        outputs: dummySinkB2Values,
        successMessage: 'sink sinkB produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
      sinkModel: {
        outputs: [updatedModel],
        successMessage: 'sink sinkModel produces the expected values',
        analyzeTestResults: analyzeTestResults,
      },
    };

    runTestScenario(inputs, testResults, fsmComponent, {
      tickDuration: 5,
      // We put a large value here as there is no inputs, so this allows to
      // wait for the tested component to produce all its sink values
      waitForFinishDelay: 200
    })

  });
