import { InSlot, Combine } from "@rxcc/components"
import { vLift } from "@rxcc/utils"
import { div } from "cycle-snabbdom"
import { ToggleButton } from './ToggleButton'
import { EnterTask } from './EnterTask'
import { TaskList } from './TaskList'

const ProjectTaskListContainer = vLift(
  div('.task-list.task-list__l-container', { slot: 'tab' }, [
    div('.task-list__l-box-a', { slot: 'toggle' }, []),
    div('.task-list__l-box-b', { slot: 'enter-task' }, []),
    div('.task-list__l-box-c', [
      div('.task-list__tasks', { slot: 'tasks' }, [])
    ])
  ]));

export const ProjectTaskList =
  Combine({}, [ProjectTaskListContainer, [
    InSlot('toggle', [ToggleButton]),
    InSlot('enter-task', [EnterTask]),
    InSlot('tasks', [TaskList])
  ]]);
