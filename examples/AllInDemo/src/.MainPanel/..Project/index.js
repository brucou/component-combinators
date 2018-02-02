import * as Rx from "rx";
import { InjectSources, ListOf, ForEach, m, InSlot } from "@rxcc/components"
import { preventDefault } from "../../../../../utils/utils/src/index"
import { Div, DOM_SINK } from "../../../../../utils/helpers/src/index"
import { button, div, h2, li, p, ul } from "cycle-snabbdom"
import { m } from "../../../../../src/components/m/m"
import { ROUTE_PARAMS } from "../../../../../src/components/Router/properties"
import { ProjectTaskList } from "./...ProjectTaskList"
import { ProjectTaskDetails } from "./...ProjectTaskDetails"
import { ProjectComments } from "./...ProjectComments"
import { ProjectActivities } from "./...ProjectActivities"
import { projectsStateFactory } from "./state"

const $ = Rx.Observable;

const tabItems = [
  { title: 'Tasks', link: 'tasks' },
  { title: 'Comments', link: 'comments' },
  { title: 'Activities', link: 'activities' }
];

const parentRoute = projectId => `projects/${projectId}`;

// Component displaying and linking the tabs
function TabContainer(sources, settings) {
  const { url$ } = sources;
  const { tabItems, [ROUTE_PARAMS]: { projectId } } = settings;
  const state$ = url$
    .map(url => {
      // Reminder : leading '/' was removed
      // returns the index for which the link of the tab item can be found in the url
      return tabItems.findIndex(tabItem => url.indexOf(tabItem.link) !== -1)
    })
    .shareReplay(1);

  const intents$ =
    $.merge(tabItems.map(tabItem => {
      return sources[DOM_SINK].select(`.${tabItem.title}.tabs__tab-button`).events('click')
        .do(preventDefault)
        .map(ev => tabItem.link)
    }))
      .share();

  // div .tabs
  // slot for active tab
  return {
    [DOM_SINK]: state$.map(tabIndex => {
      return div('.tabs', [
        ul('.tabs__tab-list', tabItems.map((tabItem, index) => {
          const tabActiveClass = (tabIndex === index) ? '.tabs__tab-button--active' : '';

          return li([
            button(`${tabActiveClass }.${tabItem.title}.tabs__tab-button`, [
              tabItem.title
            ])
          ])
        })),
        div('.tabs__l-container', { slot: 'tab' }, [])
      ])
    }),
    // NOTE : apparently, the router driver requires to pass fully formed routes (i.e. starting
    // from the root) to avoid miscellaneous issues.
    // - Given current url a/b/c, passing 'route' will give a/b/route
    // - Given current url a/b/c/, passing 'route' will give a/b/c/route
    // - However for some reasons the router source does not read the location correctly...
    // So full routes everywhere for this application.
    // Now that kind of defeats the idea behind nested routing as you need to know the parent route
    router: intents$
      .map(nestedRoute => ['', parentRoute(projectId), nestedRoute].join('/'))
  }
}

// Component displaying project's description
function ProjectHeader(sources, settings) {
  const { projects$ } = sources;
  const { [ROUTE_PARAMS]: { projectId } } = settings;
  const state$ = projects$
    .map(projects => {
      const project = projects.find(project => project._id === projectId);
      const { title, description } = project;

      return { title, description }
    })
    .shareReplay(1);

  return {
    [DOM_SINK]: state$
      .map(({ title, description }) => {
        return div('.project__l-header', [
          h2('.project__title', title),
          p(description)
        ])
      })
  }
}

export const Project =
  InjectSources({ projectFb$: projectsStateFactory }, [Div('.project'), [
    ProjectHeader,
    m({}, { tabItems }, [TabContainer, [
      OnRoute({ route: 'tasks' }, [ProjectTaskList]),
      OnRoute({ route: 'task/:nr' }, [Div('.task-details', { slot: 'tab' }), [ProjectTaskDetails]]),
      OnRoute({ route: 'comments' }, [Div('.comments', { slot: 'tab' }), [ProjectComments]]),
      OnRoute({ route: 'activities' }, [Div('.activities', { slot: 'tab' }), [ProjectActivities]])
    ]])
  ]]);
