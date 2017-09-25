import * as Rx from "rx";
import { ForEach } from "../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../src/components/ListOf/ListOf"
import { InjectSources } from "../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift,firebaseListToArray } from "../../../../src/utils"
import { pipe, values, always, filter, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li } from "cycle-snabbdom"
import { m } from "../../../../src/components/m/m"
import 'user-area.scss'
import { ROUTE_PARAMS } from "../../../../src/components/Router/properties"

const $ = Rx.Observable;

function getProjectNavigationItems$(sources, settings) {
  return sources.projects$
    .map(filter(project => !project.deleted))
    .map(map(project => ({
        title: project.title,
        link: ['projects', project._id].join('/')
    })))
    .tap(x => console.log(`getProjectNavigationItems$:`, x))
    // NOTE : this is a behaviour
    .shareReplay(1)
    ;
}

export const SidePanel = m({}, {}, [Div('.app__l-side'), [
  m({},{}, [Navigation, [
    m({},{ title: 'Main' }, [ NavigationSection, [
        m({},{project : { title: 'Dashboard', link: 'dashboard' }}, [NavigationItem])
      ]
    ]),
    m({},{ title: 'Projects' }, [ NavigationSection, [
      InjectSources({ projectNavigationItems$: getProjectNavigationItems$ }, [
        // TODO : that could be refactored in (userProjectList$ : ..., project, NavigationItem)
        // TODO : like ForEachOf({listName$:listdefFn, itemProp:string, comp:Component})
        ForEach({ from: 'projectNavigationItems$', as: 'projectList' }, [
          ListOf({ list: 'projectList', as: 'project' }, [
            EmptyComponent,
            NavigationItem
          ])
        ])
      ])
    ]]),
    m({},{ title: 'Admin' }, [ NavigationSection, [
        m({},{project : { title: 'Manage Plugins', link: 'plugins' }}, [NavigationItem])
      ]
    ]),
  ]])
]
]);

function Navigation(sources, settings){
  // NOTE : the `Div('.app__l-side')` could also be moved in the top level div below. I however
  // think it is more readable to expose the container class outside the navigation component
  // This is obviously arbitrary. On the downside, it will be less performant, and also adds an
  // extra div only because snabbdom only accepts `VNode`, not `[VNode]`, so we wrap in `div`
  const { user$, projects$ } = sources;
  const state$ = $.combineLatest(user$, projects$, (user, projects) => ({ user, projects }))

  return {
    [DOM_SINK]: state$.map(state => {
      return div([
        renderTasksSummary(state),
        // NOTE : nav('', {..}, []) does not work, '' is not recognized as valid selector
        nav({ slot: 'navigation-section' }, [])
      ])
    })
  }
}

function NavigationSection(sources, settings){
  const {title} = settings;

  return {
    [DOM_SINK] : $.of(
      div({slot : 'navigation-section'}, [
      h2('.navigation-section__title', title),
        ul('.navigation-section__list', {slot : 'navigation-item'},[])
      ])
    )
  }
}

function NavigationItem(sources, settings){
  const {project : {title, link}} = settings;
  // TODO : finish logic later, when link is clicked, route changes, and read route to set
  // active class
  const isLinkActive = ROUTE_PARAMS in settings ? '.navigation-section__link--active' : ''
  const linkSanitized = link.replace(/\//i, '.');

  return {
    [DOM_SINK] : $.of(
      a(
        `.navigation-section__link.${linkSanitized}${isLinkActive}`,
        {attrs : {href : link}, slot: 'navigation-item'},
        title)
    ),
  // NOTE : we avoid havign to isolate by using the link which MUST be unique over the whole
    // application (unicity of a route)
  router : sources.DOM.select(`.navigation-section__link.${linkSanitized}`).events('click')
    .map(always(link))
    }
}

// Helper
function renderTasksSummary({ user, projects }) {
  const openTasksCount = firebaseListToArray(projects)
    .reduce((count, project) => count + project.tasks.filter((task) => !task.done).length, 0);

  return div([
    div('.user-area__l-profile', [
      img({
        attrs: {
          src: user.pictureDataUri
        }
      }, [])
    ]),
    div('.user-area__l-information', [
      p('.user-area__welcome-text', `Hi ${user.name}`),
      openTasksCount
        ? p([`You got `, strong(openTasksCount), ` open tasks.`])
        : p('No open tasks. Hooray!')
    ])
  ])
}

// NOTE : To compare with
//   <div class="app__l-side">
//     <ngc-navigation [openTasksCount]="openTaskCount">
//       <ngc-navigation-section title="Main">
//         <ngc-navigation-item title="Dashboard" [link]="['/dashboard']"></ngc-navigation-item>
//       </ngc-navigation-section>
//       <ngc-navigation-section title="Projects" [items]="projectNavigationItems">
//       </ngc-navigation-section>
//       <ngc-navigation-section title="Admin">
//         <ngc-navigation-item title="Manage Plugins" [link]="['/plugins']"></ngc-navigation-item>
//       </ngc-navigation-section>
//     </ngc-navigation>
//   </div>
