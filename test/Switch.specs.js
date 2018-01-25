import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { div, h } from 'cycle-snabbdom'
import { runTestScenario } from '../src/runTestScenario'
import { Case, Switch } from '../src/components/Switch/Switch'
import { DOM_SINK } from "../utils/helpers/src/index"
import { convertVNodesToHTML } from "../utils/debug/src/index"

import { pipe } from 'ramda'

const $ = Rx.Observable;

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

QUnit.module("Testing Switch component", {})

// Test plan
// All tests with two children min. for components, and 3 cases
// All tests will test for all combination of transition of switch source (t->f, f->t, t->t, f->f)
// 1. Switch on source
// 1.1 source not existing in sources
// 1.2 source not a string or a function
// 1.3 switch source 1 match
// 1.4 switch source 2 matches
// 1.5 switch source 0 matches
// 1.6 same with config of eqFn
// 2. Switch on source generating function
// same than 1
// NOTE : due to changes in specifications, we also added tests for parent component
// NOTE : no tests for the `switchedOn` property which passes the value from the switched source

QUnit.test("main cases - 1 match - 3 cases - switch on source - with case container component", function exec_test(assert) {
  const done = assert.async(4);

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1.take(4)
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`)
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };
  const childComponent3 = function childComponent3(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 3: '))
        .map(x => h('span', {}, `Component 3 : ${x}`)),
      b: sources.userAction$.map(x => `Component3 - user action : ${x}`)
    }
  };
  const childComponent4 = function childComponent4(sources, settings) {
    return {
      c: sources.userAction$.map(x => `Component4 - user action : ${x}`)
    }
  };
  const CaseContainer = function CaseContainer(sources, settings) {
    return {
      [DOM_SINK]: $.of(div('.parent'))
    }
  }

  const switchComponent = Switch({
    on: 'sweatch$',
    as: 'switched',
    sinkNames: ['DOM', 'a', 'b', 'c']
  }, [CaseContainer, [
    Case({ when: false }, [childComponent3]),
    Case({ when: false }, [childComponent4]),
    Case({ when: true }, [childComponent1, childComponent2]),
  ]]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<div class=\"parent\"></div>",
        "<div class=\"parent\"><div><span>Component 3 : c</span></div></div>",
        "<div class=\"parent\"></div>",
        "<div class=\"parent\"><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>",
        "<div class=\"parent\"></div>",
        "<div class=\"parent\"><div><span>Component 3 : f</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : a</span></div></div>",
        "<div class=\"parent\"></div>",
        "<div class=\"parent\"><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div>",
        "<div class=\"parent\"><div><span>Component 1 : f</span><span>Component 2 : c</span></div></div>",
        "<div class=\"parent\"><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div>",
        "<div class=\"parent\"><div><span>Component 1 : a</span><span>Component 2 : d</span></div></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
      ],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [
        // basically all userAction after first value of switch$ is emitted
        "Component2 - user action : hover",
        "Component3 - user action : select",
        "Component2 - user action : click",
        "Component2 - user action : hover",
        "Component2 - user action : click",
        "Component3 - user action : select",
        "Component2 - user action : hover"
      ],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [
        "Component4 - user action : select",
        "Component4 - user action : select"
      ],
      successMessage: 'sink c produces the expected values',
    },
  }

  runTestScenario(inputs, expected, switchComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })

});

QUnit.test("main cases - 0-1 match - 3 cases - switch on source - with case container component" +
  " - testing incoming switched value", function exec_test(assert) {
  const done = assert.async(4);

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1.take(4)
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`)
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };
  const childComponent3 = function childComponent3(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 3: '))
        .map(x => h('span', {}, `Component 3 : ${x}`)),
      b: sources.userAction$.map(x => `Component3 - user action : ${x}`)
    }
  };
  const childComponent4 = function childComponent4(sources, settings) {
    return {
      c: sources.userAction$.map(
        x => `Component4 - user action : ${x} | switched on : ${settings.switchedOn}`)
    }
  };
  const CaseContainer = function CaseContainer(sources, settings) {
    return {
      [DOM_SINK]: $.of(div('.parent'))
    }
  }

  const switchComponent = Switch({
    on: 'sweatch$',
    as: 'switchedOn',
    sinkNames: ['DOM', 'a', 'b', 'c']
  }, [CaseContainer, [
    Case({ when: false }, [childComponent3]),
    Case({ when: false }, [childComponent4]),
    Case({ when: 'true' }, [childComponent1, childComponent2]),
  ]]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<div class=\"parent\"></div>",
        "<div class=\"parent\"><div><span>Component 3 : c</span></div></div>",
        "<div class=\"parent\"></div>",
        "<div class=\"parent\"><div><span>Component 3 : f</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : a</span></div></div>",
        "<div class=\"parent\"></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [
        "Component3 - user action : select",
        "Component3 - user action : select"
      ],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [
        "Component4 - user action : select | switched on : false",
        "Component4 - user action : select | switched on : false"
      ],
      successMessage: 'sink c produces the expected values',
    },
  }

  runTestScenario(inputs, expected, switchComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })

});

QUnit.test("main cases - 2 matches - 3 cases - switch on source - with case container component", function exec_test(assert) {
  const done = assert.async(4);

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1.take(4)
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`)
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };
  const childComponent3 = function childComponent3(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 3: '))
        .map(x => h('span', {}, `Component 3 : ${x}`)),
      b: sources.userAction$.map(x => `Component3 - user action : ${x}`)
    }
  };
  const childComponent4 = function childComponent4(sources, settings) {
    return {
      c: sources.userAction$.map(x => `Component4 - user action : ${x}`)
    }
  };
  const CaseContainer = function CaseContainer(sources, settings) {
    return {
      [DOM_SINK]: $.of(div('.parent'))
    }
  }

  const switchComponent = Switch({
    on: 'sweatch$',
    as: 'switchedOn',
    sinkNames: ['DOM', 'a', 'b', 'c']
  }, [CaseContainer, [
    Case({ when: true }, [childComponent3]),
    Case({ when: false }, [childComponent4]),
    Case({ when: true }, [childComponent1, childComponent2]),
  ]]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<div class=\"parent\"></div>", // first `true` match activates the CaseContainer
        "<div class=\"parent\"><div><span>Component 3 : d</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : d</span></div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : e</span></div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>",
        "<div class=\"parent\"><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>",
        "<div class=\"parent\"></div>",
        "<div class=\"parent\"><div><span>Component 3 : b</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : b</span></div><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : c</span></div><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : c</span></div><div><span>Component 1 : f</span><span>Component 2 : c</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : c</span></div><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : d</span></div><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div>",
        "<div class=\"parent\"><div><span>Component 3 : d</span></div><div><span>Component 1 : a</span><span>Component 2 : d</span></div></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
      ],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [
        "Component3 - user action : hover",
        "Component2 - user action : hover",
        "Component3 - user action : click",
        "Component2 - user action : click",
        "Component3 - user action : hover",
        "Component2 - user action : hover",
        "Component3 - user action : click",
        "Component2 - user action : click",
        "Component3 - user action : hover",
        "Component2 - user action : hover"
      ],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [
        "Component4 - user action : select",
        "Component4 - user action : select"
      ],
      successMessage: 'sink c produces the expected values',
    },
  }

  runTestScenario(inputs, expected, switchComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })

});

QUnit.test("main cases - 2 matches - 3 cases - switch on source - without case container" +
  " component", function exec_test(assert) {
  const done = assert.async(4);

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1.take(4)
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`)
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };
  const childComponent3 = function childComponent3(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 3: '))
        .map(x => h('span', {}, `Component 3 : ${x}`)),
      b: sources.userAction$.map(x => `Component3 - user action : ${x}`)
    }
  };
  const childComponent4 = function childComponent4(sources, settings) {
    return {
      c: sources.userAction$.map(x => `Component4 - user action : ${x}`)
    }
  };
  const CaseContainer = function CaseContainer(sources, settings) {
    return {
      [DOM_SINK]: $.of(div('.parent'))
    }
  }

  const switchComponent = Switch({
    on: 'sweatch$',
    as: 'switchedOn',
    sinkNames: ['DOM', 'a', 'b', 'c']
  }, [
    Case({ when: true }, [childComponent3]),
    Case({ when: false }, [childComponent4]),
    Case({ when: true }, [childComponent1, childComponent2]),
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<div></div>",
        "<div><div><span>Component 3 : d</span></div></div>",
        "<div><div><span>Component 3 : d</span></div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>",
        "<div><div><span>Component 3 : e</span></div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>",
        "<div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>",
        "<div></div>",
        "<div><div><span>Component 3 : b</span></div></div>",
        "<div><div><span>Component 3 : b</span></div><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div>",
        "<div><div><span>Component 3 : c</span></div><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div>",
        "<div><div><span>Component 3 : c</span></div><div><span>Component 1 : f</span><span>Component 2 : c</span></div></div>",
        "<div><div><span>Component 3 : c</span></div><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div>",
        "<div><div><span>Component 3 : d</span></div><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div>",
        "<div><div><span>Component 3 : d</span></div><div><span>Component 1 : a</span><span>Component 2 : d</span></div></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
      ],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [
        "Component3 - user action : hover",
        "Component2 - user action : hover",
        "Component3 - user action : click",
        "Component2 - user action : click",
        "Component3 - user action : hover",
        "Component2 - user action : hover",
        "Component3 - user action : click",
        "Component2 - user action : click",
        "Component3 - user action : hover",
        "Component2 - user action : hover"
      ],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [
        "Component4 - user action : select",
        "Component4 - user action : select"
      ],
      successMessage: 'sink c produces the expected values',
    },
  }

  runTestScenario(inputs, expected, switchComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })

});

// 1.5 Switch on source : switch source 0 match
QUnit.test("main cases - 0 match - 3 cases - switch on source", function exec_test(assert) {
  const done = assert.async(4);

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1.take(4)
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`)
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };
  const childComponent3 = function childComponent3(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 3: '))
        .map(x => h('span', {}, `Component 3 : ${x}`)),
      b: sources.userAction$.map(x => `Component3 - user action : ${x}`)
    }
  };
  const childComponent4 = function childComponent4(sources, settings) {
    return {
      c: sources.userAction$.map(x => `Component4 - user action : ${x}`)
    }
  };

  const switchComponent = Switch({
    on: 'sweatch$',
    as: 'switchedOn',
    sinkNames: ['DOM', 'a', 'b', 'c']
  }, [
    Case({ when: '' }, [childComponent3]),
    Case({ when: 'Y' }, [childComponent4]),
    Case({ when: 2 }, [childComponent1, childComponent2]),
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: ["<div></div>"],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [],
      successMessage: 'sink c produces the expected values',
    },
  }

  runTestScenario(inputs, expected, switchComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })

});

// 2.3 Switch on condition : switch source 1 match
QUnit.test("main cases - 1 match - 3 cases - switch on condition", function exec_test(assert) {
  const done = assert.async(4);

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1.take(4)
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`)
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };
  const childComponent3 = function childComponent3(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 3: '))
        .map(x => h('span', {}, `Component 3 : ${x}`)),
      b: sources.userAction$.map(x => `Component3 - user action : ${x}`)
    }
  };
  const childComponent4 = function childComponent4(sources, settings) {
    return {
      c: sources.userAction$.map(x => `Component4 - user action : ${x}`)
    }
  };

  const switchComponent = Switch({
    on: (sources, settings) => sources.sweatch$,
    as: 'switchedOn',
    sinkNames: ['DOM', 'a', 'b', 'c']
  }, [
    Case({ when: false }, [childComponent3]),
    Case({ when: false }, [childComponent4]),
    Case({ when: true }, [childComponent1, childComponent2]),
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<div></div>",
        "<div><div><span>Component 3 : c</span></div></div>",
        "<div></div>",
        "<div><div><span>Component 1 : c</span><span>Component 2 : d</span></div></div>",
        "<div></div>",
        "<div><div><span>Component 3 : f</span></div></div>",
        "<div><div><span>Component 3 : a</span></div></div>",
        "<div></div>",
        "<div><div><span>Component 1 : f</span><span>Component 2 : b</span></div></div>",
        "<div><div><span>Component 1 : f</span><span>Component 2 : c</span></div></div>",
        "<div><div><span>Component 1 : a</span><span>Component 2 : c</span></div></div>",
        "<div><div><span>Component 1 : a</span><span>Component 2 : d</span></div></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
        'Component1 - user action : click',
        'Component1 - user action : hover',
      ],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [
        // basically all userAction after first value of switch$ is emitted
        "Component2 - user action : hover",
        "Component3 - user action : select",
        "Component2 - user action : click",
        "Component2 - user action : hover",
        "Component2 - user action : click",
        "Component3 - user action : select",
        "Component2 - user action : hover"
      ],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [
        "Component4 - user action : select",
        "Component4 - user action : select"
      ],
      successMessage: 'sink c produces the expected values',
    },
  }

  runTestScenario(inputs, expected, switchComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })

});

// 2.5 Switch on condition : switch source 0 match
QUnit.test("main cases - 0 match - 3 cases - switch on condition", function exec_test(assert) {
  const done = assert.async(4);

  const childComponent1 = function childComponent1(sources, settings) {
    return {
      DOM: sources.DOM1.take(4)
        .tap(console.warn.bind(console, 'DOM : component 1: '))
        .map(x => h('span', {}, `Component 1 : ${x}`)),
      a: sources.userAction$.map(x => `Component1 - user action : ${x}`)
    }
  };
  const childComponent2 = function childComponent2(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 2: '))
        .map(x => h('span', {}, `Component 2 : ${x}`)),
      b: sources.userAction$.map(x => `Component2 - user action : ${x}`)
    }
  };
  const childComponent3 = function childComponent3(sources, settings) {
    return {
      DOM: sources.DOM2.take(4)
        .tap(console.warn.bind(console, 'DOM : component 3: '))
        .map(x => h('span', {}, `Component 3 : ${x}`)),
      b: sources.userAction$.map(x => `Component3 - user action : ${x}`)
    }
  };
  const childComponent4 = function childComponent4(sources, settings) {
    return {
      c: sources.userAction$.map(x => `Component4 - user action : ${x}`)
    }
  };

  const switchComponent = Switch({
    on: (sources, settings) => sources.sweatch$,
    as: 'switchedOn',
    sinkNames: ['DOM', 'a', 'b', 'c']
  }, [
    Case({ when: '' }, [childComponent3]),
    Case({ when: 'Y' }, [childComponent4]),
    Case({ when: 2 }, [childComponent1, childComponent2]),
  ]);

  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [
        "<div></div>"
      ],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [],
      successMessage: 'sink c produces the expected values',
    },
  }

  runTestScenario(inputs, expected, switchComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })

});

QUnit.test("edge cases - 0 case components- switch on condition", function exec_test(assert) {
  const inputs = [
    { DOM1: { diagram: '-a--b--c--d--e--f--a' } },
    { DOM2: { diagram: '-a-b-c-d-e-f-abb-c-d' } },
    {
      userAction$: {
        diagram: 'abc-b-ac--ab---c',
        values: { a: 'click', b: 'select', c: 'hover', }
      }
    },
    {
      'sweatch$': {
        //diagr: '-a--b--c--d--e--f--a',
        //diagr: '-a-b-c-d-e-f-abb-c-d',
        //userA: 'abc-b-ac--ab---c',
        diagram: '-t-f-tttttff-t', values: {
          t: true,
          f: false,
        }
      }
    }
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    a: {
      outputs: [],
      successMessage: 'sink a produces the expected values',
    },
    b: {
      outputs: [],
      successMessage: 'sink b produces the expected values',
    },
    c: {
      outputs: [],
      successMessage: 'sink c produces the expected values',
    },
  }

  assert.throws(function () {
    runTestScenario(inputs, expected, Switch({
      on: (sources, settings) => sources.sweatch$,
      sinkNames: ['DOM', 'a', 'b', 'c']
    }, []), {
      tickDuration: 5,
      waitForFinishDelay: 30
    })
  }, /contract/, 'Throws if the switch combinator is called with no  child component to switch to');

});
