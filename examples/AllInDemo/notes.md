HOW IT WORKS:
- breakdown the component tree with control flow combinators and 'sequential' or 'linear' operators
  - control flow
    - Switch, ForEach, FSM, Router
  - linear
    - `Events :: HashMap<EventName, EventSource>`
    - `EventsFactory :: HashMap<EventName, EventFactory>`
    - `EventFactory :: Sources -> Settings -> EventSource`
    - `Event :: Observable`
    - `MakeActionsSettings :: Record{makeAction :: ActionsFactory}`
    - `ActionsFactory :: Events -> Actions`
    - `Actions :: HashMap<SinkName, Sink>`
    - MakeEvents :: EventsFactory -> [Component] -> Component
      - Note that it might be useful to have also 
        - `EventsFactory :: Sources -> Settings -> Events` in case we need to make events from other previously made events (! be careful with the share and replay semantics there!!)
    - `MakeActions :: MakeActionsSettings -> [Component] -> Component` 
      - `makeAction` is a pure function
    - we skip the intent intermediary step (often mapping one to one to action)
    - `ev.preventDefault` SHOULD be in the event part, not the action part! We want  `makeAction` to be a pure function

HOW WOULD I DO A TABBED COMPONENT? ALSO STEP COMPONENT!
App = Tabs({tabs: [tab1, tab2, tab3]}, [Parent, [
  Tab1,
  Tab2,
  Tab3
]]
)

- tabs is an array of intents corresponding to the trigger to activate each tab
- Tabs will be implemented with a Switch component
- Parent ()and children) will receive in its settings the `when` (or `matched`?) property to hold the index of the tab to activate
- Parent can then render differently (header?) as a function of that

HOW TO DO A PROGRESS BAR COMPONENT
With ForEach
App = ForEach ({from, as}, [
  ProgressBar
])
- from is for instance the intent click on a +/- button
- as is the field necessary for ProgressBar 

HOW WOULD I DO AN ACCORDEON COMPONENT?
???
------ App structure
InjectSourcesAndSettings({}, [Div('.app'), [
    m({}, {}, [Div('.app__l-side'), [
      Navigation({}, [
        NavigationSection({..}, [
          NavigationItem({..})
        ]),
        InSlot({..}, [
          InjectSources({..), [
            ForEach({..}, [
              ListOf({..}, [
                EmptyComponent,
                NavigationItem
              ])
            ])
          ])
        ]),
        NavigationSection({..}, [
          NavigationItem({..})
        ])
      ])
    ]]),
    MainPanel
  ]
])
----- Logging
- All combinator are m(specs, settings, components)
- what happens is that those m can be calling other ms...
- so add a trace to each m call, a different recognizable trace for m internals too 
- I need also to trace children component sink
  - i.e. m({..}, [..]), I need to trace m sinks, but also .. sinks
  - so trace at m level must be suffixed by the children sinks trace (index?? component.name?? 
  both??)
- tracing component sinks can be done via a higher-order function 
  - TraceSinks({trace, ..}, component) returns a component whose unique sink is `log$`
  * BETTER option is TraceSinks({logSubject}, component) and spy on sinks to emit on logSubject
    - emits trace : sink name : sink value, timestamp
    - accumulate those data in some global variable
    - have a ui next to the app, which allows to visualize and filter the logs, maybe blink on new 
    values arrival
      - can I do a tree from it???
    - BUT then I can only trace sinks, not sources
      - sources can't be traced automatically as they do not follow a fixed interface
      * turnaround is to create `WithEvents` combinators, which homogeneizes the interface (with 
      autmatic share() included)
      - and separate the treatment of logs from this combinator
      - but then it has be done BY THE PROGRAMMER, and that EVERYWHERE, so a bit error prone...
      - but the architecture does not let any other options
      * rename `InjectSources` to `InjectState`, and automatically apply the sharReplay!!
    - so now I have events trace, and output and intermediary trace, and component hierarchy 
    information. So how do I relate events to outputs?? How do I display state??
      - relate : all descendants (as from teh trace) are possibly dependent on that event
      - state : is behaviours, hence in sources. So use only InjectSources for behaviour displays, 
      i.e. but is it only behaviours? make sure InjectSources differentiate events and 
      behaviours, and display behaviours, if possible within the hierarchy they are created 
    - how do I display settings!!! let that out for now, settings determine component behaviour, 
    but it is not state (or is it?) - we stick to input and output for now, and just the name of 
    components - not all information about the component (which settings is a part of)
    * App could have `settings.logSubject` that all components will receive
    - `InjectSources` could make the sources and log it directly
    * ORRR could use `m` preprocessing function (makeExtraSources) which returns the same sources
     altered (!! so far it was supposed to be EXTRA sources) - so change makeExtraSources to 
     `preprocessInputs` which takes inputs and returns the new inputs, or better add 
     `preprocessInputs` as prioritary over the other `makeExtra` options... complicates syntax 
     but well 
    - will be the problem of detecting and visualizing end of COMPONENTS (not just end of 
    streams)...
      - add it to the processing -> use materialize??
    - have two properties (MUST start with _ to protect, and forbid user having _ props):
      - trace : which is hierarchical
      - entity : which is one at all times, carries the name of the enclosing variable, ex: 
      MainPanel

----- Visualization
- A component sinks emits `trace chain : sink : sink name : timestamp : sink value`
- A component sinks emits `trace chain : behaviour : source name : timestamp : value`
- A component sinks emits `trace chain : event : event name : timestamp : event data`
- `trace` reflects the hierarchy of components (careful how to build it - early and late source 
of settings, so possible conflict with property `trace`)
- special treatment for `WithEvents` combinator

----- Visualization examples
- Inject/App : behaviour : url$ : tttt : url
- Inject/App : behaviour : user$ : tttt : user
- Inject/App : behaviour : projects$ : tttt : projects
- Inject/App : sink : DOM : tttt : projects (combined from below)
- Inject-Div/App : sink : DOM : tttt : ...
- Inject-m-Div/SidePanel: sink : DOM : tttt : ...
- Inject-m-Navigation/SidePanel: sink : DOM : tttt : ...
- Inject-m-Navigation-NavigationSection/SidePanel: sink : DOM : tttt : ...
- Inject-m-Navigation-NavigationSection-NavigationItem/SidePanel: sink : DOM : tttt : ...
- Inject-m-Navigation-NavigationSection-NavigationItem/SidePanel: sink : router : tttt : ...

-----explain m, m doc
- make a drawing of the three options, with input output and explain it is like hooks
Sources, Settings, Components -> Adapter -> Preconditions -> 1, 2 ,3
                                (makExtra...)  preCond...

----that is a large projects, so make a release as is, next release will have visualizer and drag
 and drop and scrolling
----write step by step demo, ideally different branches for each step - BEST!!
----for next release (put release X in its own branch), write spec and draw sketch for the viz

1 -> ComponentSinks -> 4
2 -> [Component] -> [ComponentSinks] -> Sinks (merge is folding functions) -> 4
3 -> [Component] -> Sinks -> 4 
4 -> PostConditions -> Postprocessing
