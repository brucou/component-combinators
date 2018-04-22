import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { convertVNodesToHTML, DOM_SINK } from "../utils/src"
import { runTestScenario } from "../testing/src/runTestScenario"
import { a, div, li, ol } from "cycle-snabbdom"
import { Tree } from "../src/components/UI"
import { omit, identity, pipe, set } from 'ramda'
import { componentNameInSettings, traceApp, traceBehaviourSinkFn, traceBehaviourSourceFn } from "../tracing/src"
import { traceDOMsinkFn, traceEventSinkFn, traceEventSourceFn } from "../tracing/src/helpers"

const $ = Rx.Observable;

// Test plan
// We assume Good ComponentTree
// Edge cases :
// E1. Bad settings
// E2. Tree depth 0 e.g. only root
// E3. Empty tree
// Main cases :
// M1. Tree depth 2
// M2. Tree sequence : Tree depth 2, then Tree depth 1, then Tree depth 2 again

const NODE_SLOT = 'node_slot';
const TREE_SOURCE_NAME = 'TREE_SOURCE_NAME';
const LOCAL_STATE_SOURCE_NAME = 'LOCAL_STATE_SOURCE_NAME';
const TREE_SETTING_NAME = 'TREE_SETTING_NAME';
const COMMAND_SOURCE_NAME = 'COMMAND_SOURCE_NAME';
const A_SINK = 'A_SINK';
const treeDepth1 = {
  label: "root",
  children: [
    { label: "gauche" },
    {
      label: "milieu",
    },
    { label: "droite" }
  ]
};
const treeDepth2 = {
  label: "root",
  children: [
    { label: "left" },
    {
      label: "middle",
      children: [{ label: "midleft" }, { label: "midright" }]
    },
    { label: "right" }
  ]
};
const tree1 = {
  label: "root",
  children: [
    { label: "left" },
  ]
};
const tree2 = {
  label: "root",
  children: [
    { label: "right" },
  ]
};
function removeWhenField(traces) {
  return traces.map(trace => omit(['when'], trace))
}

function getId(start) {
  let counter = start;
  return function () {
    return counter++
  }
}

function cleanString(str) {
  return str.trim().replace(/\s\s+|\n|\r/g, ' ').replace(/> </g, '><')
}

function TreeEmpty(sources, settings) {
  return {
    [DOM_SINK]: $.of(div('TreeEmpty'))
  }
}

function TreeRoot(sources, settings) {
  return {
    [DOM_SINK]: $.of(div('.tree.left.inspire-tree', {}, [
      ol({ slot: NODE_SLOT }, [])
    ]))
  }
}

function TreeNode(sources, settings) {
  const { path, label } = settings;

  return {
    [DOM_SINK]: $.of(
      li(".collapsed.selectable.draggable.drop-target.rendered.folder", { slot: NODE_SLOT }, [
        div(".title-wrap", [
          a(".toggle.icon.icon-expand"),
          a(".title.icon.icon-folder", {
            "attrs": {
              "tabindex": "1",
              "unselectable": "on",
            }
          }, [`TreeNode@${path} : ${label}`])
        ]),
        div(".wholerow"),
        ol({ slot: NODE_SLOT }, [])
      ])
    )
  }
}

function TreeNodeLight(sources, settings) {
  const { path, label } = settings;

  return {
    [DOM_SINK]: $.of(
      li(".collapsed", { slot: NODE_SLOT }, [
        a(".title.icon.icon-folder", {
          "attrs": {
            "tabindex": "1",
            "unselectable": "on",
          }
        }, [`TreeNode@${path} : ${label}`]),
        ol({ slot: NODE_SLOT }, [])
      ])
    )
  }
}

function TreeLeaf(sources, settings) {
  const { path, label } = settings;

  return {
    [DOM_SINK]: $.of(
      li(".collapsed.selectable.draggable.drop-target.leaf", { slot: NODE_SLOT }, [
        div(".title-wrap", [
          a(".title.icon.icon-file-empty", {
            "attrs": {
              "tabindex": "1",
              "unselectable": "on",
            }
          }, [`TreeLeaf@${path} : ${label}`])
        ]),
        div(".wholerow")
      ])
    )
  }
}

function TreeLeafWithPrintedUIstate(sources, settings) {
  const { LOCAL_STATE_SOURCE_NAME: uiState$ } = sources;
  const { path, label } = settings;

  return {
    [DOM_SINK]: uiState$.map(uiStateMap => {
      const uiStateToString = JSON.stringify([...uiStateMap]);

      return li(".collapsed", { slot: NODE_SLOT }, [
        a(".title.icon.icon-file-empty", {}, [`TreeLeaf@${path} : ${label} | UI state : ${uiStateToString}`])
      ])
    })

  }
}

function commandExecFn(command) {
  return $.of('response computed')
}

function analyzeTestResults(assert, done) {
  return function analyzeTestResults(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    done()
  }
}

QUnit.module("Testing Tree component", {})

QUnit.test("Main cases - tree depth 2", function exec_test(assert) {
  const done = assert.async(2);
  const _treeSettings = {
    treeSettings: {
      treeSource: TREE_SOURCE_NAME,
      localStateSource: LOCAL_STATE_SOURCE_NAME,
      localTreeSetting: TREE_SETTING_NAME,
      defaultUIstateNode: { isExpanded: true },
      localCommandSpecs: { source: COMMAND_SOURCE_NAME, executeFn: commandExecFn },
      lenses: { getChildren: tree => tree.children || [], getLabel: tree => tree.label || '' },
      sinkNames: [A_SINK, DOM_SINK]
    }
  };

  const arrayComponents = [TreeEmpty, TreeRoot, TreeNode, TreeLeaf];

  const treeComponent = Tree(_treeSettings, arrayComponents);

  const inputs = [
    {
      [TREE_SOURCE_NAME]: {
        diagram: '-a',
        values: { a: treeDepth2 }
      }
    },
  ];

  const treeNodes = `
  <div class="tree left inspire-tree">
    <ol>
        <li class="collapsed selectable draggable drop-target rendered folder">
            <div class="title-wrap"><a class="toggle icon icon-expand"></a><a
                    class="title icon icon-folder" tabindex="1" unselectable="on">TreeNode@0 :
                root</a></div>
            <div class="wholerow"></div>
            <ol>
                <li class="collapsed selectable draggable drop-target leaf">
                    <div class="title-wrap"><a class="title icon icon-file-empty" tabindex="1"
                                               unselectable="on">TreeLeaf@0,0 : left</a></div>
                    <div class="wholerow"></div>
                </li>
                <li class="collapsed selectable draggable drop-target rendered folder">
                    <div class="title-wrap"><a class="toggle icon icon-expand"></a><a
                            class="title icon icon-folder" tabindex="1" unselectable="on">TreeNode@0,1
                        : middle</a></div>
                    <div class="wholerow"></div>
                    <ol>
                        <li class="collapsed selectable draggable drop-target leaf">
                            <div class="title-wrap"><a class="title icon icon-file-empty"
                                                       tabindex="1" unselectable="on">TreeLeaf@0,1,0
                                : midleft</a></div>
                            <div class="wholerow"></div>
                        </li>
                        <li class="collapsed selectable draggable drop-target leaf">
                            <div class="title-wrap"><a class="title icon icon-file-empty"
                                                       tabindex="1" unselectable="on">TreeLeaf@0,1,1
                                : midright</a></div>
                            <div class="wholerow"></div>
                        </li>
                    </ol>
                </li>
                <li class="collapsed selectable draggable drop-target leaf">
                    <div class="title-wrap"><a class="title icon icon-file-empty" tabindex="1"
                                               unselectable="on">TreeLeaf@0,2 : right</a></div>
                    <div class="wholerow"></div>
                </li>
            </ol>
        </li>
    </ol>
</div>
  `
  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [cleanString(treeNodes)],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
    [A_SINK]: {
      outputs: [],
      successMessage: 'sink produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
    },
  }

  runTestScenario(inputs, expected, treeComponent, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })

  // const div = document.createElement('div');
  // div.innerHTML = treeNodes.trim();
  // document.body.appendChild(div);
});

QUnit.test("Main cases - tree depth 2, depth 1 and depth2", function exec_test(assert) {
  const traces = [];
  const done = assert.async(2);
  const _treeSettings = {
    treeSettings: {
      treeSource: TREE_SOURCE_NAME,
      localStateSource: LOCAL_STATE_SOURCE_NAME,
      localTreeSetting: TREE_SETTING_NAME,
      defaultUIstateNode: { isExpanded: true },
      localCommandSpecs: { source: COMMAND_SOURCE_NAME, executeFn: commandExecFn },
      lenses: { getChildren: tree => tree.children || [], getLabel: tree => tree.label || '' },
      sinkNames: [DOM_SINK]
    }
  };

  const arrayComponents = [TreeEmpty, TreeRoot, TreeNodeLight, TreeLeafWithPrintedUIstate];

  const treeComponent = Tree(set(componentNameInSettings, 'treeComponent', _treeSettings), arrayComponents);

  const tracedApp = traceApp({
    _trace: {
      traceSpecs: {
        [LOCAL_STATE_SOURCE_NAME]: [traceBehaviourSourceFn, traceBehaviourSinkFn],
        [TREE_SOURCE_NAME]: [traceEventSourceFn, traceEventSinkFn],
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, treeComponent);

  const inputs = [
    {
      [TREE_SOURCE_NAME]: {
        diagram: '-a---',
        values: { a: tree1, b: tree2}
      }
    },
  ];

  const treeNodes = `
  <div class="tree left inspire-tree">
    <ol>
        <li class="collapsed selectable draggable drop-target rendered folder">
            <div class="title-wrap"><a class="toggle icon icon-expand"></a><a
                    class="title icon icon-folder" tabindex="1" unselectable="on">TreeNode@0 :
                root</a></div>
            <div class="wholerow"></div>
            <ol>
                <li class="collapsed selectable draggable drop-target leaf">
                    <div class="title-wrap"><a class="title icon icon-file-empty" tabindex="1"
                                               unselectable="on">TreeLeaf@0,0 : left</a></div>
                    <div class="wholerow"></div>
                </li>
                <li class="collapsed selectable draggable drop-target rendered folder">
                    <div class="title-wrap"><a class="toggle icon icon-expand"></a><a
                            class="title icon icon-folder" tabindex="1" unselectable="on">TreeNode@0,1
                        : middle</a></div>
                    <div class="wholerow"></div>
                    <ol>
                        <li class="collapsed selectable draggable drop-target leaf">
                            <div class="title-wrap"><a class="title icon icon-file-empty"
                                                       tabindex="1" unselectable="on">TreeLeaf@0,1,0
                                : midleft</a></div>
                            <div class="wholerow"></div>
                        </li>
                        <li class="collapsed selectable draggable drop-target leaf">
                            <div class="title-wrap"><a class="title icon icon-file-empty"
                                                       tabindex="1" unselectable="on">TreeLeaf@0,1,1
                                : midright</a></div>
                            <div class="wholerow"></div>
                        </li>
                    </ol>
                </li>
                <li class="collapsed selectable draggable drop-target leaf">
                    <div class="title-wrap"><a class="title icon icon-file-empty" tabindex="1"
                                               unselectable="on">TreeLeaf@0,2 : right</a></div>
                    <div class="wholerow"></div>
                </li>
            </ol>
        </li>
    </ol>
</div>
  `
  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [cleanString(treeNodes)],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
  }

  const expectedGraph = [2];
  const expectedTraces = [1];

  const testResult = runTestScenario(inputs, expected, tracedApp, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  })
  testResult
    .then(_ => {
      console.error('traces', traces)
      assert.deepEqual(removeWhenField(traces), expectedGraph.concat(expectedTraces), `Traces are produced as expected!`);
      done()
    });

  // const div = document.createElement('div');
  // div.innerHTML = treeNodes.trim();
  // document.body.appendChild(div);
});

// TODO : run examples and see that they still work
// TODO : 2 main case test, cf test plan
