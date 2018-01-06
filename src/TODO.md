# Combinators
- Use Pipe({},[WithEvents(...), WithState(...), ComputeActions(...)]) would be any leaf
      // component including generic or ad-hoc components.
      // InjectSources would be state visible in all the hierarchy, while WithState only visible
      // in Pipe - ComputeActions
      // Those three components actually are the same component sources -> settings, what changes
      // is meaning i.e. meta like log
- make combinator ForEachOfList as shortcut for ForEach(...ListOf(...))
- // TODO : a DIV combinator (instead of a Div component - or both??)

# Core
- think about work around for isolation, components need to pass their click free of concerns
- m : write a better doc to explain settings inheritance, and put in the docs not in the code
  - write an interactive application with update of the three possible settings
- m : design better trace information
  - for instance outer trace could be concatenated to inner trace to trace also the component 
  hierarchy
- all components : replace singular treatment for DOM into behaviourSinkNames, sinkNames
  - all behaviourSinkNames must give a zero value (for DOM : $.of(null)
  - but really find a non-DOM example and investigate, it is not so simple
- NTH : Router : route params property name could be configured in settings, to think about
- NTH : Router : route params could be directly passed as settings to children components
- TODO : FSM : a bunch of them pending
- NOTE : run the router only with cycle history (done in AllIn demo)
- TODO : for all components, decide if I pass the settings of the combinator downstream!!
   - for instance, sinkNames is good to pass downstream, but slot would not be!!
- TODO : change InjectSourcesAndSettings so that factory returns both sources and settings so
 one function call factory(sources, settings) -> {sources : {sources hash}, settings: new
 settings}
- TODO : cleanup and break up utils, too many thigns there, look for cohesion
- TODO : add examples for :
   - authentication : take it from firebase sparks
- TODO : see how to translate that https://github.com/Shopify/draggable?
- TODO : what about animations? How does that play with vDom?

# Routing
cf. https://css-tricks.com/react-router-4/ and investigate if our router can do all these patterns :

- Nested Layouts
- Redirect
- Exclusive Routing
- Inclusive Routing
- Conditional routing (Authorized Route)
- Preventing transition

# Build/devop
- TODO : move to rollup? why lib/rxcc.min.js is so big ? because rx?
- TODO : also review the structure of the repository (m_helpers? history_driver? where to put 
runTestScenario?)
- TODO : get all working with latest version of snabdomm, and cycle-run etc.

# Documentation/Example
- for new comers
// When trying to expand this example to a proper app, it quickly becomes an avalanche
// of unsolvable questions:
//
//   How do I keep track of all the streams?
//   Where do I keep state?
//   Where and how do I propagate my HTTP requests?
//   How do my child components communicate with parents and vice versa?
//   How do I deal with lists of things?
//   How do I communicate between components in different parts of the page?
//   How do I respond to and possibly propagate errors (anywhere: HTTP responses, form field
// values etc.)?
//   How do I do forms and form validation?
//   How do I...?
//   //

- angular app
// TODO:  1. draggable first
// TODO:  2. tags
// TODO:  3. scroll
// TODO : understand the plugin thing (used for task info)

- cf. react website https://reacttraining.com/react-router/web/guides/philosophy

# Testing
Well, testing is complicated by having impure functions, so not sure what to do here. Best is to 
have nice tracing/debugging, and then test with instrumenting the gui (a la flaky selenium). 

# to put somewhere in a new article
We have seen while implementing the application how to address common issues arising when 
implementing a web application :

- **routing** : a quintessential requirement such as routing is very naturally expressed with 
 the `OnRoute` combinator.
- **state management** : state can be injected at any point of the component tree and becomes 
visible to any component down the injection point. Alternatively, state can also be kept at the
 global level, through the use of in-memory store.
- **change propagation** : at the lowest level, using streams as the corner stone of our 
architecture solves the issue of updating a variable (behaviour) when one of its dependencies 
change. *Live queries* can then be built on top of read and write drivers as exemplified in the 
sample application. Additionally, we offer the `ForEach` combinator, to execute a given logic on 
a every change of a behaviour. 
- **communication between components** : parent-child communication may occur through passing 
settings and sources, child-parent communication and communication between components with no 
direct ascendency relationship in the component tree may occur via shared state. 
- **lists** : list of things are dealt with reactively with the `ListOf` and `ForEach` combinators. 

While these were not encountered in the present sample application, our combinator library also 
helps deal with :

- **control flow** : Two combinators (`Switch` and `FSM`) allow to implement both simple and 
complex control flow logic. A [realistic example](https://github.com/brucou/component-combinators/tree/master/examples/volunteerApplication) for the `FSM` combinator showcases the advantage of state machines to that purpose.

In summary,

- So what?
  - readable, i.e. understandable, the logic is immediately apparent from the use of combinators
    - A projectTaskList is a list of tasks, and a task is ...
    - compare that with chldren(sources) with lots of $ in settings, and then sinks this merge 
    sinks that. The combination logic is abstracted into the combinator, that is what it is for.
  - supports iterative development through refinement
    - current approach does not, if you call children comp, you then have to merge the sinks, and
     you don't know yet what are the sinks for your child, if you don't know what you will put 
     there...
   - make explicit a syntax tree for a DSL, in which combinators are the keywords, and components
    are the variables, i.e. in the future the DSL could be extracted and code generated through 
    parsing
   - tracing and loggging should be easy and allow for visualization
     - next release!! 

