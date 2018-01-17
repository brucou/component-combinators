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
- blog : investigate highlighting with ``` how to add new syntax, or what is the list```
- blog : add ⇡ character for back to top cf. view-source:https://sarabander.github.io/sicp/html/1_002e3.xhtml#pagetop
  - `<section><span class="top jump" title="Jump to top"><a href="#pagetop" accesskey="t">⇡</a></span><a id="pagetop"></a><a id="g_t1_002e3"></a>`
  - code https://sarabander.github.io/sicp/html/js/footnotes.js
  - and https://sarabander.github.io/sicp/html/js/footnotes.js
  - http://www.leancrew.com/all-this/2010/05/popup-footnotes/
  - http://www.leancrew.com/all-this/2010/05/a-small-popup-footnote-change/
- blog: add those shortcodes
  - https://learn.netlify.com/en/shortcodes/mermaid/
  - https://learn.netlify.com/en/shortcodes/children/ (looked for long how to do this...)
  - series : https://realjenius.com/2017/08/07/series-list-with-hugo/
  - https://github.com/parsiya/Hugo-Shortcodes
    - code caption (!)
    - Octopress blockquote
  - https://jpescador.com/blog/leverage-shortcodes-in-hugo/
    - image post
  - http://redhatgov.io/workshops/example/hugo_shortcodes/
    - figure shortcode (better than markdown original as it has caption)
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

# TODO TODO 
- ROLL UP AND RELEASE
- start working on logging and visualization -> architecture note
- start working on the new cycle event/state handling-> architecture draft article to write
- MAKE A RELEASE!!!!
  - rmove lodash dependency (forOwn, kebabCase, escape, etc.) that is snabbdom-to-html, which I 
  don't even use... except for debugging i.e. in dev
  - so add a DEV variable which will be taken out when building for prod or sth like that

- OR GO BACK TO MASTER and bundle with webpack - look at size in prod...
- try some default files from webpack the new one

- RELEASE a version!!
  - umd
- AND THEN I will have to redo the demos but importing the library with package.json and the 
release number
- RUN PRETTIER!!

# Introduction of my work to cycle group gitter
18 months ago, while working on a multi-thousand-line cyclejs code base, I realized how hard it 
was to actually make sense quickly of a large cycle-js application. There were many problems in that code base (documentation, error management, (no) testing, etc.), as in any, but the ones related to cycle were :

- a large portion of the code was stream manutention due to the use of components. The domain 
logic, and as a result, the application logic was lost into a sea of streams cryptic operations. 
- extra confusion due to parametrizing components with streams which were not streams, but constants
lifted into streams, adding to the noise
- modifying and extending that code proved to be a gamble, with any debugging sessions counted 
in hours (to be fair, the complete absence of documentation explained a lot of that)
- very hard to figure out quickly with certainty the workflow that the application was implementing 
(you know, multi-step processes where any step may fail and need to backtrack), let alone add new
 logical branches (error recovery...)

And yet, while that application was large, it cannot really be said to be a particularly complex 
application. Rather it was the standard CRUD application which is 90% of the applications today. No fancy animations (no animations at all in fact if I remember well), adaptive ui as the only ux trick, otherwise mostly 
fields and forms and a remote database.

This was the motivation behind my dedicating my (quite) limited free time to investigate remedies
 to what appeared to be an uncalled for complexity. I singled out those four areas : 
 componentization, visual debugging, testing, concurrency control. I am happy that finally the 
 first step is in a sufficient state of progress that it can be shared. 
 
 That first step is a componentization model for cyclejs, that builds upon the original idea of a 
 component as a function and extends it further. Components are (mostly) what they used to 
 be. They can now be combined with a seriees of component combinators which eliminate a lot
  of stream noisy, repetitive code. Those component combinators have been extracted and 
  abstracted from the multi-thousands line code base, so they should cover a large number of 
  cases that one encounters in any code base. 

This is really a working draft, akin to a proof of concept. Performance was not at all looked upon, 
combinators only work with rxjs, the version of cycle used is ancient, build is not 
optimized, etc. It works nicely though, and a sample application is available to showcase it.

A series of articles covers the theoretical underpinning in more details (altogether they 
constitute a long read, but I think it is very interesting). A shorter introduction  
can be found in the `README` for the repository. Every combinator is documented, and is provided 
with examples.

I will now be using this library in my future projects. I'll now also take a little break on the 
development of the first step to focus on the second step (visualization -- thanks to this work, it 
should now be possible to visually and interactively trace and debug an application). In the 
meanwhile, I would be grateful to have feedback from the community. Any feedback is useful, but in 
particular the one from people who have spent enough time writing cycle applications. 
