import { NO_VALUE } from "../properties"
import { memoizeWith } from 'ramda'
import * as Rx from "rx";

const $ = Rx.Observable;

export const USER = 'USER';
export const PROJECTS = 'PROJECTS';
export const ACTIVITIES = 'ACTIVITIES';
export const PROJECTS_REF = 'projects';
export const ACTIVITIES_REF = 'activities';
export const UPDATE = 'Update';
export const TASKS = 'tasks';
export const ADD_NEW_TASK = 'add_new_task';

function generateQueryCacheKey(repository, context, payload) {
  return JSON.stringify({ context, payload })
}

export const domainObjectsQueryMap = {
  [PROJECTS]: {
    // NOTE : we need some caching here, in case `get` is called several times with the same
    // parameter : we already have a listener, no need to duplicate
    get: memoizeWith(generateQueryCacheKey, function getLiveProjects(repository, context, payload) {
      if (payload) throw 'domainQueryDriver > domainObjectsQueryMap > Projects > get : payload' +
      ' should be null!'

      return Rx.Observable.create(observer => {
        function processProjectSnapshot(snapshot) {
          // NOTE : we do not use Null here, as it could be confused with a real null value in
          // the database. We use a dummy value with a view that callers can discriminate
          // against it with testing for `==` equality (referential equality)
          // NOTE : there does not seem to be error or completion flow here
          const value = snapshot ? snapshot.val() : NO_VALUE;
          observer.onNext(value);
        }

        repository.child(PROJECTS_REF).on('value', processProjectSnapshot);

        return function dispose() {
          repository.child(PROJECTS_REF).off('value', processProjectSnapshot)
        }
      })
      // NOTE : it is a behaviour
        .shareReplay(1);
    })
  },
  [ACTIVITIES]: {
    // NOTE : we need some caching here, in case `get` is called several times with the same
    // parameter : we already have a listener, no need to duplicate
    get: memoizeWith(generateQueryCacheKey, function getLiveProjects(repository, context, payload) {
      if (payload) throw 'domainQueryDriver > domainObjectsQueryMap > Activities > get : payload' +
      ' should be null!'

      return Rx.Observable.create(observer => {
        function processActivitiesSnapshot(snapshot) {
          // NOTE : we do not use Null here, as it could be confused with a real null value in
          // the database. We use a dummy value with a view that callers can discriminate
          // against it with testing for `==` equality (referential equality)
          // NOTE : there does not seem to be error or completion flow here
          const value = snapshot ? snapshot.val() : NO_VALUE;
          observer.onNext(value);
        }

        repository.child(ACTIVITIES_REF).on('value', processActivitiesSnapshot);

        return function dispose() {
          repository.child(ACTIVITIES_REF).off('value', processActivitiesSnapshot)
        }
      })
      // NOTE : it is a behaviour
        .shareReplay(1);
    })
  },
  [USER]: {
    // NOTE : we need some caching here, in case `get` is called several times with the same
    // parameter : we already have a listener, no need to duplicate
    get: function getDummyUser(repository, context, payload) {
      return $.of({
        name: 'You',
        pictureDataUri: 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAxOS4yLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCINCgkgdmlld0JveD0iMCAwIDMxMS41IDMxMS41IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAzMTEuNSAzMTEuNTsiIHhtbDpzcGFjZT0icHJlc2VydmUiPg0KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4NCgkuc3Qwe2ZpbGw6IzMzMzMzMzt9DQo8L3N0eWxlPg0KPGc+DQoJPGc+DQoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xNTUuOCwwQzY5LjcsMCwwLDY5LjcsMCwxNTUuOGMwLDM3LjUsMTMuMyw3MS45LDM1LjMsOTguOGMzLjQtMjcuMywzMC42LTUwLjMsNjguOC02MS4yDQoJCQljMTMuOSwxMywzMiwyMC45LDUxLjcsMjAuOWMxOS4yLDAsMzYuOS03LjUsNTAuNy0xOS45YzM4LjUsMTEuOSw2NS4xLDM2LjMsNjYsNjQuNmMyNC4zLTI3LjUsMzkuMS02My42LDM5LjEtMTAzLjENCgkJCUMzMTEuNSw2OS43LDI0MS44LDAsMTU1LjgsMHogTTE1NS44LDE5NS43Yy05LjksMC0xOS4zLTIuNy0yNy42LTcuNWMtMjAuMS0xMS40LTMzLjktMzQuOC0zMy45LTYxLjdjMC0zOC4xLDI3LjYtNjkuMiw2MS41LTY5LjINCgkJCWMzMy45LDAsNjEuNSwzMSw2MS41LDY5LjJjMCwyNy40LTE0LjIsNTEtMzQuOCw2Mi4yQzE3NC40LDE5My4yLDE2NS4zLDE5NS43LDE1NS44LDE5NS43eiIvPg0KCTwvZz4NCjwvZz4NCjwvc3ZnPg0K'
      })
    }
  },

};

export const domainActionsConfig = {
  [PROJECTS]: {
    [UPDATE]: function updateUserApplication(repository, context, payload) {
      void context;

      const { page } = payload;
      const localforageKey = PROJECTS_REF;

      console.log('update page: ', context, localforageKey, payload);

      return repository.setItem(localforageKey, payload);
    }
  },
  [TASKS] : {
    [ADD_NEW_TASK] : {
      // TODO
{
  context : TASKS,
    command : ADD_NEW_TASK,
  payload : {fbIndex, newTask: void 0}//TODO
};
    }
  }
};
