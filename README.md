# The case for a component combinator library ![](https://img.shields.io/badge/license-MIT-blue.svg)
This component combinator library comes from some pain points I experimented while dealing with implementing interactive applications, which make heavy use of streams and try to use componentization :

- the stream plumbery between components is hard to read and make sense of
  - this is specially true with deep and large reactive graphs
  - and when you have to process mentally miscellaneous level of `flatMap`
- achieving reusability through parameterization leads to more in-your-face stream gymnastic 
    - using `prop$` to pass properties can become unwieldy when there are a lot of properties involved

The application under development should be expressed as simply or as complex as it is per its design, while keeping the stream complexity at a lower layer. 

Let's see some examples.

## Login gateway
For instance, the structure behind a login section of an application goes as such:

```javascript
export const App = Switch({
  on: convertAuthToIsLoggedIn,
  sinkNames: ['auth$', DOM_SINK, 'router'],
  as : 'switchedOn',
  trace: 'Switch'
}, [
  Case({ when: IS_NOT_LOGGED_IN, trace: 'LoginPage Case' }, [
    LoginPage({ redirect: '/component-combinators/examples/SwitchLogin/index.html?_ijt=7a193qn02ufeu5it8ofa231v7e' })
  ]),
  Case({ when: IS_LOGGED_IN, trace: 'MainPage Case' }, [
    MainPage
  ]),
]);

```

and translates the simple design :

- Functional specifications
    - if user is logged, show the main page
    - if user is not logged, show the login page, and redirect to `index` route when login is performed
- Technical specifications
    - `MainPage` takes the concern of implementing the main page logic.
    - `LoginPage` is parameterized by a redirect route, and is in charge of logging in the user
    - `convertAuthToIsLoggedIn` emits `IS_NOT_LOGGED_IN` or `IS_LOGGED_IN` according to whether the user is logged or not
    
The stream switching logic is hidden behind the `Switch` combinator.

## Nested routing
The following implementation corresponds to :

- Functional specifications
    - user visits '/' -> display home page
        - home page allows to navigate to different sections of the application
    - when the user visit a given section of the application
        - a breadcrumb shows the user where he stands in the sitemap
        - a series of clickable cards is displayed
            - when the user clicks on a given card, details about that card are displayed, and corresponding to a specific route for possible bookmarking
- Technical specifications
    - `HomePage` takes the concern of implementing the home page logic.
    - `Card` is parameterized by its card content, and is in charge of implementing the card logic
    - `CardDetail` is parameterized by its card content, and is in charge of displaying the extra details of the card

```javascript
export const App = InjectSourcesAndSettings({
  sourceFactory: injectRouteSource,
  settings: {
    sinkNames: [DOM_SINK, 'router'],
    routeSource: ROUTE_SOURCE,
    trace: 'App'
  }
}, [
  OnRoute({ route: '', trace: 'OnRoute (/)' }, [
    HomePage
  ]),
  OnRoute({ route: 'aspirational', trace: 'OnRoute  (aspirational)' }, [
    InjectSourcesAndSettings({ settings: { breadcrumbs: ['aspirational'] } }, [
      AspirationalPageHeader, [
        Card(BLACBIRD_CARD_INFO),
        OnRoute({ route: BLACK_BIRD_DETAIL_ROUTE, trace: `OnRoute (${BLACK_BIRD_DETAIL_ROUTE})` }, [
          CardDetail(BLACBIRD_CARD_INFO)
        ]),
        Card(TECHX_CARD_INFO),
        OnRoute({ route: TECHX_CARD_DETAIL_ROUTE, trace: `OnRoute (${TECHX_CARD_DETAIL_ROUTE})` }, [
          CardDetail(TECHX_CARD_INFO)
        ]),
        Card(TYPOGRAPHICS_CARD_INFO),
        OnRoute({
          route: TYPOGRAPHICS_CARD_DETAIL_ROUTE,
          trace: `OnRoute (${TYPOGRAPHICS_CARD_DETAIL_ROUTE})`
        }, [
          CardDetail(TYPOGRAPHICS_CARD_INFO)
        ]),
      ]])
  ]),
]);
```

The nested routing switching logic is hidden behind the `OnRoute` combinator.

## Dynamically changing list of items

The following implementation corresponds to :

- Functional specifications
    - display a list of card reflecting input information from a card database
    - a pagination section allows to display X cards at a time
- Technical specifications
    - `Card` is parameterized by its card content, and is in charge of implementing the card logic
    - `Pagination` is in charge of the page number change logic

```javascript
export const App = InjectSources({
  fetchedCardsInfo$: fetchCardsInfo,
  fetchedPageNumber$: fetchPageNumber
}, [
  ForEach({
      from: 'fetchedCardsInfo$',
      as: 'items',
      sinkNames: [DOM_SINK],
      trace: 'ForEach card'
    }, [AspirationalPageHeader, [
      ListOf({ list: 'items', as: 'cardInfo', trace: 'ForEach card > ListOf' }, [
        EmptyComponent,
        Card,
      ])
    ]]
  ),
  ForEach({
    from: 'fetchedPageNumber$',
    as: 'pageNumber',
    sinkNames: [DOM_SINK, 'domainAction$']
  }, [
    Pagination
  ])
]);

```

The iteration logic are taken care of with the `ForEach` and the `ListOf` combinators.

# Combinators
## Syntax
In general combinators follow a common syntax : 

- `Combinator :: Settings -> ComponentTree -> Component`
    - `Component :: Sources -> Settings -> Sinks`
    - `ComponentTree :: ChildrenComponents | [ParentComponent, ChildrenComponents]`
    - `ParentComponent:: Component`
    - `ChildrenComponents :: Array<Component>`

## Combinator list
The proposed library has the following combinators :

| Combinator      | Description | 
| --------- | :-----|
| [FSM](./documentation/EFSM.md)      |    Activate components based on inputs, and current state of a state machine. Allows to implement a flow of screens and actions according to complex control flow rules.  |
| [OnRoute](./documentation/Router.md)      |    Activate a component based on the route changes. Allows nested routing. |
| [Switch](./documentation/Switch.md)  | Activate component(s) depending on the incoming value of a source| 
| [ForEach](./documentation/ForEach.md)     |   Activate component for each incoming value of a source| 
| [ListOf](./documentation/ListOf.md)      |    Activate a list of a given component based on an array of items |
| [InjectSources](./documentation/InjectSources.md)      |    Activate a component which will be injected extra sources |
| [InjectSourcesAndSettings](./documentation/InjectSourcesAndSettings.md)      |    Activate a component which will receive extra sources and extra settings |
| [m](./documentation/m.md)      |    The core combinator from which all other combinators are derived. m basically traverses a component tree, applying reducing functions along the way.  |

Documentation, demo and tests for each combinator can be found in its respective repository.

# Roadmap
Please note that library is still wildly under development :

- APIs ~~might~~ will go through breaking changes
- you might encounter problems in production
- performance has not been investigated as of yet

The current roadmap stands as :

- Testing
    - [x] Testing library `runTestScenario`
    - [x] Mocks for DOM and document driver
    - [x] Mock for domain query driver
    - [ ] Model-based testing for FSM, i.e. automatic test cases generation
- Combinators
    - [x] Generic combinator `m`
    - [x] Routing combinator `onRoute`
    - [x] Switch combinator 
      - [x] `Switch`
      - [x] `Case`
    - [x] State machine combinator `FSM`
      - [ ] convert FSM structure to graphml or dot or tgf format
      - [ ] automatic generation of graphical representation of the FSM
      - [ ] refactor the asynchronous FSM into synchronous EHFSM + async module
        - this adds the hierarchical part, improvement in core library are automatically translated in improvement to this library, and closed/open principle advantages
      - [ ] investigate prior art
        - https://github.com/jbeard4/SCION
        - http://blog.sproutcore.com/statecharts-in-sproutcore/ 
    - [x] ForEach combinator `ForEach`
    - [x] List combinator `ListOf`
    - [x] Injection combinator 
      - [x] `InjectSources`
      - [x] `InjectSourcesAndSettings`
    - [ ] Event combinator `WithEvents`
    - [ ] Action combinator `MakeActions`
    - [ ] Tabbed component combinator `OneOf`
    - [ ] vNode combinator `VT`
    - [x] Query driver 
    - [x] Action driver 
- Core
    - [ ] DOM merge with slot assignment (a la web component)
- Demo
  - [ ] nice demo site : github pages? 
- Distribution
  - monorepo?
  - individual combinator packages?

# Installation
## Running tests
- `npm install`
- `npm run node-build-test`
- `npm run test`
- then open with a local webserver the `index.html` in `test` directory 

## Demos
### State Machine
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/volunteerApplication` directory 

### Switch
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/SwitchLogin` directory

### OnRoute
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/NestedRoutingDemo` directory

### ForEach and List
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/ForEachListDemo` directory

### 
- `npm install`
- `npm run wbuild`
- then open with a local webserver the `index.html` in `$HOMEDIR/examples/ForEachListDemo` directory
