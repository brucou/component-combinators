import { OnRoute } from "../../../../src/components/Router/Router"
import { Div } from "../../../../src/utils"
import { m } from "../../../../src/components/m/m"
import { Project } from './..Project'
import { ProjectsDashboard } from './..ProjectsDashboard'
import { ManagePlugins } from './..ManagePlugins'

export const MainPanel =
  m({}, {}, [Div(`.app__l-main`), [
    OnRoute({ route: 'dashboard' }, [ProjectsDashboard]),
    OnRoute({ route: 'projects/:projectId' }, [Project]),
    OnRoute({ route: 'plugins' }, [ManagePlugins]),
  ]]);
