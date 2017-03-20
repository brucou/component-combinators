- Each statechart has states
- All states have one entry action which is to initialize a component.
  That means when the state is entered, the sinks of the component are
passed down to the drivers. This means regular interactive behaviour of
component can occur, but none of those behaviours will lead to a change
of state in the state machine.
- statechart reacts to a set of configured events
- each of those events, if a guard condition is fulfilled, MUST lead to a change of state in the state machine. That condition could be relaxed at a later point. It is there to avoid terminating the current component and re-instantiating it anew. This could become a configuration option (re-enter the state on event triggered, or remain in the state)
- each of those events MUST trigger an action configured in the fsm
- States then have actions which can change the state of the state machine.
Those actions are part of the definition of the state machine. Those actions 
come with :
    - destination driver
    - action description (parameters passed to the destination driver) in the
 form of a function which returns those parameters AND TAKES WHICH INPUTS??
    - token identifying the action request so its response can be listened to
    - success target state - case pending action succeeds
      - fsm model update function
    - error target state - case pending action fails
      - fsm model update function
  - Only one action is triggered at any given time by incoming events.
 Before another action can be triggered, the pending action must be
 completed : RTC semantics
- update operations follows the JSON Patch specs (cf. http://jsonpatch.com/)

# API
## Composed types
- `makeFSM :: Events -> Transitions -> StateEntryComponents -> FSM_Settings -> Component`
- `FSM_Settings :: Record {
     initial_model :: FSM_Model
     init_event_data :: Event_Data 
     sinkNames :: [SinkName] | []
   }`
- `ActionResponse :: Record {
    request : ActionRequest,
    response : * | Null,
    err : Error | Null,
  }`
- `Sources :: HashMap SourceName (Source *)`
- `Events :: (HashMap EventName Event) | {}`
- `Event :: Sources -> Settings -> Source EventData`
- `Transitions :: HashMap TransitionName TransitionOptions`
- `Request : Record {
    context :: *,
    command :: Command
    payload :: Payload | Null
  }`
- `ActionRequest :: Record {
    driver :: SinkName | Null
    request :: (FSM_Model -> EventData) -> Request
  } `
- `UpdateOperation :: JSON_Patch`
- `TransitionOptions :: Record {
        origin_state :: State // Must exist in StateEntryComponents
        event :: EventName // Must exist in Events
        target_states :: [Transition]
      }`
- `Transition :: Record {
    event_guard :: EventGuard  | Null
    re_entry :: Boolean | Null
    action_request :: ActionRequest | Null
    transition_evaluation :: [TransEval]
  }`
- `TransEval :: Record {
    action_guard :: ActionGuard | Null
    target_state :: State // Must exist in StateEntryComponents
    model_update :: FSM_Model -> EventData -> ActionResponse -> Settings -> [UpdateOperation]     
  }`
- `ActionGuard :: Model -> ActionResponse -> Boolean`
- `EventGuard :: Model -> EventData -> Boolean`
- `StateEntryComponents :: HashMap State StateEntryComponent`
- `StateEntryComponent :: FSM_Model -> Component | Null`
- `JSON_Patch :: Op_Add | Op_Remove | Op_Replace | Op_Move | Op_Copy | Op_Test | Op_None`
- `Op_Add :: Record { op: "add", path: JSON_Pointer, value : *}`
- `Op_Remove :: Record { op: "remove", path: JSON_Pointer}`
- `Op_Replace :: Record { op: "replace", path: JSON_Pointer, value: *}`
- `Op_Move :: Record { op: "move", from: JSON_Pointer, path: JSON_Pointer}`
- `Op_Copy :: Record { op: "copy", from: JSON_Pointer, path: JSON_Pointer}`
- `Op_Test :: Record { op: "test", path: JSON_Pointer, value: *}`
- `Op_None :: {} | Null`

## Terminal types
- `FSM_Model :: Object`
- `Payload :: * | Null`
- `EventData :: * | Null`
- `ActionResponse :: *`
- `Command :: String`
- `EventName :: String`
- `SinkName :: String`
- `State :: String`

# FSM specifications
## Contracts
x The `EV_INIT` event is reserved and cannot be used in user-defined event 
configuration 
x The seed state is `S_INIT` and is reserved and cannot be used in 
user-defined state configuration
- For the `INIT` event, there MUST be a defined success/error transition
- States MAY be associated to entry action which is the instantiation of a component
x A transition MAY have an action response guard
x A transition MAY have an event guard
x If a transition does not have an action response guard, it is equivalent to having a guard which always passes
x If a transition does not have a event guard, it is equivalent to having a guard which always
passes
x If a transition between two states have one or several action response guards, then for any 
incoming events, at least ONE of the guards MUST pass. 
- guard predicates MUST be pure functions - or more relaxly have side-effects which do not affect the evaluation of other guards for the same event
x Run To Completion (RTC) semantics : a state machine completes processing of each event before it can start processing the next event
- Additional events occurring while the state machine is busy processing an event are dropped
x FSM configured functions MUST NOT modify the model object parameter that they receive - to prevent this the implementation could pass a clone of the model object, or use inmutable models
x an action request MAY take a special zero value which indicates no request (zero driver)
- the state machine keeps a journal of the modification of its model (history 
of update operations together with the transitions taken) for debugging 
purposes or else
- all configured functions must be synchronous
- there MUST be an init event and transition configured
- if action request has zero driver, then the request field MUST be null
- if action request is none then `transition_evaluation.action_guard` MUST be Null 
- an action request MUST have an action response associated i.e. no write-only driver
- if an action request features a driver name, that driver name MUST be found in the sources
- state defined in transition array MUST exist in state definition
- the Init state MUST be associated ONLY with transition featuring INIT events
NOTE THAT AN FSM WITH EVENT GUARD SUCH THAT INIT EVENT FAILS WILL REMAIN IN LIMBO (INIT_STATE) AS INIT EVENT WILL NOT BE REPEATED

## Behaviour
When we refer to an event, we implicitly refer to an event configured to be handled by a FSM.

### Type contracts
#### isEvents
#### isEvent
#### isTransitions
#### isTransitionOptions
#### isTransition
#### isTransEval
#### isState
#### isActionGuard
#### isSinkName
#### isZeroDriver
#### isEventName
#### isActionRequest
#### isRequest
#### isStateEntryComponents
#### StateEntryComponent

### Transitions
#### Init event
- GIVEN : FSM `Model, SinkNames`,  transition `Ev.INIT -> evG(none) -> S.Init -> T -> Ar(none) -> Ag(none) -> U`, `init: Model -> Component(_, model)`
- GIVEN : Component emits two values on two sinks in SinkNames
  - WHEN state machine is initialized THEN :
    - Update U is called with right parameters (i.e. Ev.INIT is triggered)
    - init state component factory function is called with the right parameters
    - FSM emits component sinks as expected

#### with action responses guards
##### passing guard
- GIVEN : cf. Init event
- GIVEN : FSM `Model`, transition `ev -> evG(none) -> O -> T -> Ar -> Ag(pass) -> U`, `T: Model -> Component(_, model)`
  - WHEN `ev ev_data` occurs THEN 
     - `Ar.request` is called with `Model`, `ev_data`
     - FSM component emits {driver_name : `Ar.request return value`}
  - WHEN `Ar.request` returns a response THEN
     - `guard` function is executed with the required parameters and passes
     - `model_update` function is executed with the required parameters
     - The component selector function associated to`Ts` is executed with the right parameters (`Model`)
     - The component returned by the selector function is initialized, the settings.model being as expected the initial model updated by operations returned from model update function

##### failing guard
- GIVEN : FSM `Model`, transition `ev -> evG(none) -> O -> T -> Ar -> Ag(fail) -> U`, `Ts: Model -> Component(_, model)`
  - WHEN `ev ev_data` occurs THEN 
     - `Ar.request` is called with `Model`, `ev_data`
     - FSM component emits {driver_name : `Ar.request return value`}
  - WHEN `Ar.request` returns a response THEN
     - `guard` function is executed with the required parameters and fails
     - an exception is thrown `action responses must have at least one passing guard`

### with event guards
##### fulfilled guard - no action request guard
- GIVEN : FSM `Model`, transition `ev -> evG(pass) -> O -> T -> Ar -> Ag(none=pass) -> U`, `Ts: Model -> Component(_, model)`
  - WHEN `ev ev_data` occurs THEN 
     - `evG` is executed with the right parameters
     - `Ar.request` is called with `Model`, `ev_data`
     - FSM component emits {driver_name : `Ar.request return value`}
  - WHEN `Ar.request` returns a response THEN
     - `model_update` function is executed with the required parameters
     - The component selector function associated to`Ts` is executed with the right parameters (`Model`)
     - The component returned by the selector function is initialized, the settings.model being as expected the initial model updated by operations returned from model update function

##### failing guard - no action request guard
- GIVEN : FSM `Model`,  transition `Ev.INIT -> evG(none) -> S.Init -> T -> Ar(none) -> Ag(none) -> U`, `init: Model -> Component(_, model)`
- GIVEN : FSM `Model`, transition `Ev.E -> evG(fail) -> T -> T' -> Ar -> Ag(fail) -> U`, `Ts: Model -> Component2(_, model)`
- GIVEN : Component emits three values every 100ms on two different sinks
- GIVEN : Component2 emits five values every 10ms on one sink
- GIVEN : Ev.E is emitted quickly before three values are emitted
  - WHEN state machine is initializes THEN :
    - Update U is called with right parameters (i.e. Ev.INIT is triggered)
    - Component is instantiated - 
  - WHEN `ev ev_data` occurs THEN 
     - `evG` is executed with the right parameters and fails
     - FSM component emits only the three values from Component, i.e. component remains active, and Component2 is never instantiated

##### failing guard and fulfilled guard - no action request guard
- GIVEN : FSM `Model`,  transition `Ev.INIT -> evG(none) -> S.Init -> T -> Ar(none) -> Ag(none) -> U`, `init: Model -> Component(_, model)`
- GIVEN : FSM `Model`, transition `Ev.E -> evG1(fail) -> T -> T' -> Ar -> Ag(fail) -> U`, `Ts: Model -> Component2(_, model)`
- GIVEN : FSM `Model`, transition `Ev.E -> evG2(pass) -> T -> T' -> Ar -> Ag(fail) -> U`, `Ts: Model -> Component3(_, model)`
- GIVEN : Component emits three values A every 0+100ms on two different sinks
- GIVEN : Component2 emits five values B every 10ms on one sink
- GIVEN : Component3 emits two values C every 10ms on one sink
- GIVEN : Ev.E is emitted quickly before three values are emitted
  - WHEN state machine is initializes THEN :
    - Update U is called with right parameters (i.e. Ev.INIT is triggered)
    - Component is instantiated - 
  - WHEN `Ev.E` occurs THEN 
     - `evG1` is executed with the right parameters and fails
     - `evG2` is executed with the right parameters and passes
     - FSM component emits only 1 value from Component, and 2 values from Component3, i.e. Component is switched out, and Component3 is instantiated

##### 2 fulfilled guards - no action request guard
- GIVEN : FSM `Model`,  transition `Ev.INIT -> evG(none) -> S.Init -> T -> Ar(none) -> Ag(none) -> U`, `init: Model -> Component(_, model)`
- GIVEN : FSM `Model`, transition `Ev.E -> evG1(pass) -> T -> T' -> Ar -> Ag(fail) -> U`, `Ts: Model -> Component2(_, model)`
- GIVEN : FSM `Model`, transition `Ev.E -> evG2(pass) -> T -> T' -> Ar -> Ag(fail) -> U`, `Ts: Model -> Component3(_, model)`
- GIVEN : Component emits three values A every 0+100ms on two different sinks
- GIVEN : Component2 emits five values B every 10ms on one sink
- GIVEN : Component3 emits two values C every 10ms on one sink
- GIVEN : Ev.E is emitted quickly before three values are emitted
  - WHEN state machine is initializes THEN :
    - Update U is called with right parameters (i.e. Ev.INIT is triggered)
    - Component is instantiated - 
  - WHEN `Ev.E` occurs THEN 
     - `evG1` is executed with the right parameters and passes
     - (`evG2` is not executed as `evG1` passes already)
     - FSM component emits only 1 value from Component, and 5 values from Component2, i.e. Component is switched out, and Component3 is never instantiated

TODO : If I go with that, update contracts

# Possible improvements
- policies when a state machine is in between states (expecting action response)
    - CANCEL AND FIRE : the action in course is cancelled and the event is processed
    - DROP : the events are dropped and not processed, a warning is issued (default)
    - QUEUE AND FIRE : events for that state are queued. If the transition is towards the same state, then events are dequeued and processed in order of arrival. If to another state, warning is issued and events are dropped
    - QUEUE AND DROP : events for that state are queued. If the transition is towards the same state, then queued events who happened while the action was executed are dropped, the queued events who happened after action has ended (and hence state is re-entered) are processed in order of arrival. If transition is to another state, warning is issued and events are dropped
- policy should be specified at the transition level
  - the event triggering the transition should define its queuing policy

- instead of having component executed upon state entry, one can have a full application, i.e a run(main) with drivers
  - main will be injected the sources argument from its parent
  - main can also define additional sources (by defining additional sinks)
  - mian can redefine/redirect existing sinks 
  - non-redefined sinks will be routed to the parent as always
  - it will be necessary to check carefully the disposal mechanism of that application...
  
- implement exit actions for cleanup purpose -will have to be specified in sync with the entry action (which probably creates the resource to clean up) 
- automatic events (i.e. immediate preemption or transient state)
- investigate racing conditions (?)
