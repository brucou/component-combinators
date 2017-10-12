- bug with sources.source called several times. Use share or shareReplay(1) wisely - tricky to debug
  - in the case of drivers specially think long about using share or shareReplay..., but there should be one, as there is no guarantee a driver source won't be called several times...
- trace every single f.. sink
  - it is relatively easy to see data flow, but when the problem is that the data does not flow it gets hairy, as this is often due to subscription not happening, and there is no way to trace subscription (unsubscription is possible to trace somehow due to `finally`).
  - NOTE : onSubscribe possible. cf. https://stackoverflow.com/questions/41883339/observable-onsubscribe-equivalent-in-rxjs
- in the example aplication, interesting how important to think that Switch is disconnection a component sinks, so here the router never gets to emit a route
- DO NOT FORGET THE SINKS in SINKNAMES (3x)
  - adding a sink in `run` but not in settings.sinkNames will lead to hard to trace bugs!!
  - Look if I can issue a warning if a component emits a sink not part of sinknames
- WHEN USING DIRECT DOM READ, dont do it twice at two different times, values will be different, 
and some time error will be launched
  - case where first time dom element exists and value read ok, then removed, then read again : 
  boom! read ONCE for all the time it is needed! no multicast with direct read! 

# State management
## from button group
// NOTE : Here we present a case of optimistic update for local state. This is fundamented in
// the fact that local state update cannot fail, that is the key difference vs. remotely persisted
// state.
// So: user clicks on a tab from the tab group, that updates the local state for the tab group,
// the ui updates, and then that local state is translated into a state update action for
// the corresponding app level piece of state (i.e. task filter)
// Note again that we have two semantically distinct concepts, which belong to two distinct
// layers :
// - which button of the button group is clicked
//   - that is UI state corresponding to the UI layer
//    - that state is not visible out of the specific portion of the UI it is declared in
// - what is the current filter for the tasks
//   - that is non-persisted local app state corresponding to the domain layer
//   - that is visible by the whole app

# third-party bugs or strangeties
cf. bug tags in the code. How to 

- bug in snabbdom
  - when using keys, weird, dont have the repro anymore
  - when having a #selector after a .selector
- desync. snabbdom vs. actual DOM
  - in case of input for instance (a more elegant solution would be to have an input component??) ALWAYS USE A KEY FOR INPUTS

- firebase
  - cannot set a property to undefined
    - `makeDomainActionDriver: an error occured Error: Firebase.set failed: First argument contains undefined in property 'projects.-KtxLeGQmuU5ViOm8XQO.tasks.4.done'  `
  - cannot set a property to null : it means remove

# containers
- are the constant part of the rendering function
- holes are for the variable part

# state
- initialize all source of truth before starting the app
  - for instance filter tasks starts with ALL, so put 'all' there BEFORE starting
- initialize all dependent sources of state when building state/behaviour
  - for instance task button group state is connected to in-memory task-button-state/filter.
    - the connection is made through stream, EXCEPT for 
      - the initial value where the connection has to be done by hand
      - OR linked to the current value of the source of truth

# cycle stuff
- order of drivers not predictable
  - problem when one driver must execute after another one

# general
- with using strings for identifiers of sources or else, it is easy to make a mistake that is not captured by js (but maybe ts would)
- don't replace links with . if it goes to classes, use _
- also the equality used to recognize the route is obviously weak (indexOf) would be better to recognize the full route as a prefix oh well
- bugs can update wrongly the database, which can create other bugs because one forgets to put back the database
- be careful with Ramda that always will evaluate only once its operand. i.e. always(x++) will 
only evalue x++ once, so event$.map(always(x++)) will not work, not evaluated for each event

# my components
- InSlot has to be right after where the slot is asked, any other component combinator is wrapping over previous vnodes with a div without slot
