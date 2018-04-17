import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { h } from 'cycle-snabbdom'
import { runTestScenario } from '../testing/src/runTestScenario'
import { DOM_SINK, EmptyComponent } from "../utils/src/index"
import { convertVNodesToHTML, format } from "../utils/src/index"
import { concat, pipe } from 'ramda'
import { ListOf } from "../src/components/ListOf/ListOf"

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

const item1 = 'ITEM1';
const item2 = 'ITEM2';
const item3 = 'ITEM3';

QUnit.module("Testing ListOf component", {})

// Test plan
// Conditions under test
// check items is read correctly
// check children are passed the item as cardInfo and an index
// check that the merge is happenning correctly when buildActionsFromChildrenSinks  Y/N
// check behaviour with actionsMap, and without
// Test universe
// - buildActionsFromChildrenSinks (Y | N) x actionsMap (Y|N) x size of items (0 | 1 | > 1)
// reduced to, by independence hypothesis
// - buildActionsFromChildrenSinks (Y | N) + actionsMap (Y|N) + size of items (0 | 1 | > 1)
// Test cases
// - 4 cases enough (actually 3 but never mind): N + N + (0 | 1 | > 1) ; Y + Y + derived + > 1

QUnit.test("main case - each child generates its actions unhinged - ListOf several items", function exec_test(assert) {
  const done = assert.async(2);

  const childComponent = function childComponent1(sources, settings) {
    return {
      [DOM_SINK]: sources.DOM1
        .tap(console.warn.bind(console, `DOM for list component ${settings.listIndex}: `))
        .map(
          x => h('span', {}, `List Component ${settings.listIndex} : ${format(settings.item)} - ${x}`)),
      a: sources.userAction$.map(x => `Component ${settings.listIndex} - user action : ${x}`)
    }
  };

  const listOfComponent = ListOf({
    list: 'items',
    as: 'item',
    items: [item1, item2, item3],
    trace: 'listOfComponent'
  }, [
    EmptyComponent,
    childComponent,
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c-----------' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      // NOTE : one can see here the `combineLatest` in action : a-a-a ; b-a-a; b-b-a; b-b-b
      outputs: [
        "<div><span>List Component 0 : ITEM1 - a</span><span>List Component 1 : ITEM2 - a</span><span>List Component 2 : ITEM3 - a</span></div>",
        "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : ITEM2 - a</span><span>List Component 2 : ITEM3 - a</span></div>",
        "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : ITEM2 - b</span><span>List Component 2 : ITEM3 - a</span></div>",
        "<div><span>List Component 0 : ITEM1 - b</span><span>List Component 1 : ITEM2 - b</span><span>List Component 2 : ITEM3 - b</span></div>",
        "<div><span>List Component 0 : ITEM1 - c</span><span>List Component 1 : ITEM2 - b</span><span>List Component 2 : ITEM3 - b</span></div>",
        "<div><span>List Component 0 : ITEM1 - c</span><span>List Component 1 : ITEM2 - c</span><span>List Component 2 : ITEM3 - b</span></div>",
        "<div><span>List Component 0 : ITEM1 - c</span><span>List Component 1 : ITEM2 - c</span><span>List Component 2 : ITEM3 - c</span></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        "Component 0 - user action : click",
        "Component 1 - user action : click",
        "Component 2 - user action : click",
        "Component 0 - user action : select",
        "Component 1 - user action : select",
        "Component 2 - user action : select",
        "Component 0 - user action : hover",
        "Component 1 - user action : hover",
        "Component 2 - user action : hover",
        "Component 0 - user action : select",
        "Component 1 - user action : select",
        "Component 2 - user action : select",
        "Component 0 - user action : click",
        "Component 1 - user action : click",
        "Component 2 - user action : click",
        "Component 0 - user action : hover",
        "Component 1 - user action : hover",
        "Component 2 - user action : hover",
        "Component 0 - user action : click",
        "Component 1 - user action : click",
        "Component 2 - user action : click",
        "Component 0 - user action : select",
        "Component 1 - user action : select",
        "Component 2 - user action : select",
        "Component 0 - user action : hover",
        "Component 1 - user action : hover",
        "Component 2 - user action : hover"
      ],
      successMessage: 'sink a produces the expected values',
    },
  }

  runTestScenario(inputs, expected, listOfComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })
});

QUnit.test("main case - each child generates its actions unhinged - ListOf 1 item only", function exec_test(assert) {
  const done = assert.async(2);

  // TODO
  const childComponent = function childComponent1(sources, settings) {
    return {
      [DOM_SINK]: sources.DOM1
        .tap(console.warn.bind(console, `DOM for list component ${settings.listIndex}: `))
        .map(
          x => h('span', {}, `List Component ${settings.listIndex} : ${format(settings.item)} - ${x}`)),
      a: sources.userAction$.map(x => `Component ${settings.listIndex} - user action : ${x}`)
    }
  };

  const listOfComponent = ListOf({
    list: 'items',
    as: 'item',
    items: [item1],
    trace: 'listOfComponent'
  }, [
    EmptyComponent,
    childComponent,
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c-----------' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      // NOTE : one can see here the `combineLatest` in action : a-a-a ; b-a-a; b-b-a; b-b-b
      outputs: [
        "<span>List Component 0 : ITEM1 - a</span>",
        "<span>List Component 0 : ITEM1 - b</span>",
        "<span>List Component 0 : ITEM1 - c</span>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        "Component 0 - user action : click",
        "Component 0 - user action : select",
        "Component 0 - user action : hover",
        "Component 0 - user action : select",
        "Component 0 - user action : click",
        "Component 0 - user action : hover",
        "Component 0 - user action : click",
        "Component 0 - user action : select",
        "Component 0 - user action : hover",
      ],
      successMessage: 'sink a produces the expected values',
    },
  }

  runTestScenario(inputs, expected, listOfComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })
});

QUnit.test("main case - each child generates its actions unhinged - ListOf no items", function exec_test(assert) {
  const done = assert.async(1);

  const childComponent = function childComponent1(sources, settings) {
    return {
      [DOM_SINK]: sources.DOM1
        .tap(console.warn.bind(console, `DOM for list component ${settings.listIndex}: `))
        .map(
          x => h('span', {}, `List Component ${settings.listIndex} : ${format(settings.item)} - ${x}`)),
      a: sources.userAction$.map(x => `Component ${settings.listIndex} - user action : ${x}`)
    }
  };

  const listOfComponent = ListOf({
    list: 'items',
    as: 'item',
    items: [],
    trace: 'listOfComponent'
  }, [
    EmptyComponent,
    childComponent,
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c-----------' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
  ];

  /** @type TestResults */
    // First <div/> is the empty component, surrounding div is the ListOf wrapper, same as if
    // there would be x > 0 items in the list
  const expected = {
      DOM: {
        outputs: ["<div></div>"],
        successMessage: 'sink DOM produces the expected values',
        transform: pipe(convertVNodesToHTML)
      },
    }

  runTestScenario(inputs, expected, listOfComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })
});

// TODO : edge case if I put EmptyComponent to vLift(null), in that case, ListOf returns {} and traceDOMsinkFn errors...
