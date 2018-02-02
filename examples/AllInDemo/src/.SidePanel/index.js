import * as Rx from "rx";
import { InjectSources, ListOf, ForEach, m, InSlot } from "@rxcc/components"
import { firebaseListToArray, preventDefault } from "../../../../utils/utils/src/index"
import { Div, DOM_SINK, EmptyComponent } from "../../../../utils/helpers/src/index"
import { always, filter, map } from 'ramda'
import { a, div, h2, img, nav, p, strong, ul } from "cycle-snabbdom"

const $ = Rx.Observable;

// Helpers
function renderTasksSummary({ user, projects }) {
  const openTasksCount = firebaseListToArray(projects)
    .reduce((count, project) => count + project.tasks.filter((task) => !task.done).length, 0);

  return div('.user-area', [
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

function getProjectNavigationItems$(sources, settings) {
  return sources.projects$
    .map(filter(project => !project.deleted))
    .map(map(project => ({
      title: project.title,
      link: ['projects', project._id].join('/')
    })))
    .distinctUntilChanged()
    .tap(x => console.log(`getProjectNavigationItems$:`, x))
    // NOTE : this is a behaviour
    .shareReplay(1)
    ;
}

// Components
// Navigation(..., [NavigationSection(..., [NavigationItem(...,[])])])
function NavigationContainerComponent(sources, settings) {
  const { user$, projects$ } = sources;
  // combineLatest allows to construct a behaviour from other behaviours
  const state$ = $.combineLatest(user$, projects$, (user, projects) => ({ user, projects }))

  return {
    [DOM_SINK]: state$.map(state => {
      return div('.navigation', [
        renderTasksSummary(state),
        nav({ slot: 'navigation-section' }, [])
      ])
    })
  }
}

function Navigation(navigationSettings, componentArray) {
  return m({}, navigationSettings, [NavigationContainerComponent, componentArray])
}

function NavigationSectionContainerComponent(sources, settings) {
  const { title } = settings;

  return {
    [DOM_SINK]: $.of(
      div('.navigation-section', { slot: 'navigation-section' }, [
        h2('.navigation-section__title', title),
        ul('.navigation-section__list', { slot: 'navigation-item' }, [])
      ])
    )
  }
}

function NavigationSection(navigationSectionSettings, componentArray) {
  return m({}, navigationSectionSettings, [NavigationSectionContainerComponent, componentArray])
}

function NavigationItem(sources, settings) {
  const { url$ } = sources;
  const { project: { title, link } } = settings;
  const linkSanitized = link.replace(/\//i, '_');

  const events = {
    // NOTE : we avoid having to isolate by using the link which MUST be unique over the whole
    // application (unicity of a route)
    click: sources.DOM.select(`.navigation-section__link.${linkSanitized}`).events('click')
  };
  // TODO : refactor to state = {isLinkActive$ : url$...}, it is more readable, and in line with
  // the equational approach, that I will detail later in the blog
  // TODO : search for `function NavigationItem` in blog and update example
  // TODO : if have the courage, go through all components and impose the pattern
  // TODO : copy the selector DRY approach from blog article Applying componentization to reactive
  // systems - sample application.md TODO : if have the courage, go through all components and
  // impose the pattern...
  const state$ = url$
    .map(url => url.indexOf(link) > -1)
    .shareReplay(1);

  const actions = {
    domUpdate: state$.map(isLinkActive => {
      const isLinkActiveClass = isLinkActive ? '.navigation-section__link--active' : '';

      return a(
        `${isLinkActiveClass}.navigation-item.navigation-section__link.${linkSanitized}`,
        { attrs: { href: link }, slot: 'navigation-item' },
        title)
    }),
    router: events.click
      .do(preventDefault)
      .map(always('/' + link + '/'))
  }

  return {
    [DOM_SINK]: actions.domUpdate,
    router: actions.router
  }
}

const ListOfItemsComponent =
  InjectSources({ projectNavigationItems$: getProjectNavigationItems$ }, [
    ForEach({ from: 'projectNavigationItems$', as: 'projectList' }, [
      ListOf({ list: 'projectList', as: 'project' }, [
        EmptyComponent,
        NavigationItem
      ])
    ])
  ]);

export const SidePanel =
  m({}, {}, [Div('.app__l-side'), [
    Navigation({}, [
      NavigationSection({ title: 'Main' }, [
        m({}, { project: { title: 'Dashboard', link: 'dashboard' } }, [NavigationItem])
      ]),
      NavigationSection({ title: 'Projects' }, [
        InSlot('navigation-item', [ListOfItemsComponent])
      ]),
      NavigationSection({ title: 'Admin' }, [
        m({}, { project: { title: 'Manage Plugins', link: 'plugins' } }, [NavigationItem])
      ]),
    ])
  ]]);
