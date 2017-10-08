import * as Rx from "rx";
import { ForEach } from "../../../../../../src/components/ForEach/ForEach"
import { ListOf } from "../../../../../../src/components/ListOf/ListOf"
import { InSlot} from "../../../../../../src/components/InSlot"
import { InjectSources } from "../../../../../../src/components/Inject/InjectSources"
import { InjectSourcesAndSettings } from "../../../../../../src/components/Inject/InjectSourcesAndSettings"
import { DOM_SINK, EmptyComponent, DummyComponent, format, Div, Nav, vLift, preventDefault } from "../../../../../../src/utils"
import { pipe, values, keys, always, filter, path, map } from 'ramda'
import { a, p, div, img, nav, strong, h2, ul, li, button, input } from "cycle-snabbdom"
import { UPDATE_TASK_COMPLETION_STATUS, TASKS, taskFactory } from "../../../../src/domain"
import {computeTaskCheckedActions, computeSaveUpdatedTaskActions, filterTasks} from './helpers'
import {taskEnterButtonSelector, taskEnterInputSelector} from './properties'
import {taskListStateFactory} from './state'
import {CheckBox} from '../../../UI/CheckBox'
import {Editor} from '../../../UI/Editor'
import { InjectStateInSinks } from "../../../../../../src/components/Inject/InjectStateInSinks"

const $ = Rx.Observable;

// Helpers
const TaskListContainer = vLift(
  div('.task-list__l-box-c', [
    div('.task-list__tasks', {slot: 'task'}, [])
  ])
);

const TaskContainer = vLift(
  div('.task', [
    div(".task__l-box-a", {slot : 'checkbox'}, []),
    div(".task__l-box-b", [
      div(".task__title", {slot : 'editor'}, []),
      button(".task__delete"), // TODO : handler here, create a TaskDelete??
      div('.task-infos', {slot : 'task-infos'}, []),
      div({slot: 'task-link'}, []),
    ])
  ])
);

const TaskLink = DummyComponent;
const TaskInfo = DummyComponent;

// NOTE : Because Editor and CheckBox are reusable UI component, they are unaware of any domain
// model, and can only be parameterized through settings. `InjectSourcesAndSettings` is used to
// compute the necessary settings for those components
const Task = InjectSourcesAndSettings({
  settings : function(settings){
    const {filteredTask : {done, title}} = settings;

    return {
      checkBox : {        isChecked : !!done,        namespace : TASKS,       label : undefined      },
      editor : {showControls : true, initialEditMode : false, initialContent : title}
    }
  }
}, [TaskContainer, [
  InjectStateInSinks({ isChecked$ : {as : 'isChecked', inject : {projectFb$ : 'projectFb'}}}, CheckBox),
  // TODO : I AM here soon, refactor
  InjectStateInSinks({ save$ : {as : 'save', inject : {projectFb$ : 'projectFb'}}}, Editor),
  TaskInfo, // TODO : should be noting to inject here? have it from the sources
  TaskLink
]]);

export const TaskList = InjectSources({filteredTasks$: taskListStateFactory}, [TaskListContainer,  [
  InSlot('task', [
    ForEach({from : 'filteredTasks$', as : 'filteredTasks'}, [
      ListOf({list : 'filteredTasks', as : 'filteredTask', buildActionsFromChildrenSinks : {
        isChecked$: computeTaskCheckedActions,
        save$ : computeSaveUpdatedTaskActions
        // TODO
      }, actionsMap : {'isChecked$' : 'domainAction$'}, 'save$' : 'domainAction$'}, [
        EmptyComponent,
        Task
      ])])
  ])]]);

// TODO : not done, infinite scroll and draggable... and tags : DO THE TAGS dont know about scroll
// TODO : do the drag and drop : good exercise, useful in the general case, example of reusable
// component
// TODO : need to read more about the scroll but could be interesting to do
// TODO:  in order : draggable first
// TODO : understand the plugin thing (used for task info)
/*
<div class="task-list__l-box-c">
  <div class="task-list__tasks">
    <ngc-task *ngcInfiniteScroll="let task of filteredTasks" [task]="task"
     (taskUpdated)="onTaskUpdated(task, $event)"
     (taskDeleted)="onTaskDeleted(task)"
     draggable
     draggableType="task"
     [draggableData]="task"
     draggableDropZone
     dropAcceptType="task"
     (dropDraggable)="onTaskDrop($event, task)"></ngc-task>
  </div>
</div>
*/

