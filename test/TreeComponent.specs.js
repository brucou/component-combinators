import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { convertVNodesToHTML, DOM_SINK } from "../utils/src"
import { runTestScenario } from "../testing/src/runTestScenario"
import { a, div, li, ol } from "cycle-snabbdom"
import { Tree } from "../src/components/UI"
import { always, evolve, is, mapObjIndexed, omit, pipe, set } from 'ramda'
import { componentNameInSettings, resetGraphCounter } from "../tracing/src"

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

function removeFunctions(traces) {
  function mapFn(x) {
    return typeof x === 'function' ? `function ${x.name}` : x
  }

  function mapLeafObj(obj) {
    if (is(Object, obj) && !is(Array, obj) && !is(Function, obj)) {
      return evolve(mapObjIndexed(always(mapLeafObj), obj), obj)
    }
    else {
      return mapFn(obj)
    }
  }

  return traces.map(mapLeafObj)
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
        a(".title", {}, [`TreeNode@${path} : ${label}`]),
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
  const {treeSettings : {localTreeSetting, localStateSource}} = settings;
  const uiState$ = sources[localStateSource];
  const { path, label } = settings;
  const tree = settings[localTreeSetting];

  return {
    [DOM_SINK]: uiState$.map(uiState => {
      const uiStateToString = JSON.stringify(uiState);

      return li(".collapsed", { slot: NODE_SLOT }, [
        a(".title", {}, [`TreeLeaf@${path} : ${label} | UI state : ${uiStateToString}`])
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
  resetGraphCounter();
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
});

QUnit.test("Main cases - tree depth 1, depth 2 and depth1", function exec_test(assert) {
  resetGraphCounter();
  const done = assert.async(1);
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

  const inputs = [
    {
      [TREE_SOURCE_NAME]: {
        diagram: '-a-b-a',
        values: { a: tree1, b: treeDepth2 }
      }
    },
  ];

  const treeNodes = [`
    <div class="tree left inspire-tree">
        <ol>
            <li class="collapsed"><a class="title">TreeNode@0 : root</a>
                <ol>
                    <li class="collapsed"><a class="title">TreeLeaf@0,0 : left | UI state :
                        {"0":{"isExpanded":true,"tree":{"label":"root","children":[{"label":"left"}]}},"0.0":{"isExpanded":true,"tree":{"label":"left"}}}</a>
                    </li>
                </ol>
            </li>
        </ol>
    </div>
`, `
    <div class="tree left inspire-tree">
        <ol>
            <li class="collapsed"><a class="title">TreeNode@0 : root</a>
                <ol>
                    <li class="collapsed"><a class="title">TreeLeaf@0,0 : left | UI state :
                        {"0":{"isExpanded":true,"tree":{"label":"root","children":[{"label":"left"},{"label":"middle","children":[{"label":"midleft"},{"label":"midright"}]},{"label":"right"}]}},"0.0":{"isExpanded":true,"tree":{"label":"left"}},"0.1":{"isExpanded":true,"tree":{"label":"middle","children":[{"label":"midleft"},{"label":"midright"}]}},"0.2":{"isExpanded":true,"tree":{"label":"right"}},"0.1.0":{"isExpanded":true,"tree":{"label":"midleft"}},"0.1.1":{"isExpanded":true,"tree":{"label":"midright"}}}</a>
                    </li>
                    <li class="collapsed"><a class="title">TreeNode@0,1 : middle</a>
                        <ol>
                            <li class="collapsed"><a class="title">TreeLeaf@0,1,0 : midleft | UI
                                state :
                                {"0":{"isExpanded":true,"tree":{"label":"root","children":[{"label":"left"},{"label":"middle","children":[{"label":"midleft"},{"label":"midright"}]},{"label":"right"}]}},"0.0":{"isExpanded":true,"tree":{"label":"left"}},"0.1":{"isExpanded":true,"tree":{"label":"middle","children":[{"label":"midleft"},{"label":"midright"}]}},"0.2":{"isExpanded":true,"tree":{"label":"right"}},"0.1.0":{"isExpanded":true,"tree":{"label":"midleft"}},"0.1.1":{"isExpanded":true,"tree":{"label":"midright"}}}</a>
                            </li>
                            <li class="collapsed"><a class="title">TreeLeaf@0,1,1 : midright | UI
                                state :
                                {"0":{"isExpanded":true,"tree":{"label":"root","children":[{"label":"left"},{"label":"middle","children":[{"label":"midleft"},{"label":"midright"}]},{"label":"right"}]}},"0.0":{"isExpanded":true,"tree":{"label":"left"}},"0.1":{"isExpanded":true,"tree":{"label":"middle","children":[{"label":"midleft"},{"label":"midright"}]}},"0.2":{"isExpanded":true,"tree":{"label":"right"}},"0.1.0":{"isExpanded":true,"tree":{"label":"midleft"}},"0.1.1":{"isExpanded":true,"tree":{"label":"midright"}}}</a>
                            </li>
                        </ol>
                    </li>
                    <li class="collapsed"><a class="title">TreeLeaf@0,2 : right | UI state :
                        {"0":{"isExpanded":true,"tree":{"label":"root","children":[{"label":"left"},{"label":"middle","children":[{"label":"midleft"},{"label":"midright"}]},{"label":"right"}]}},"0.0":{"isExpanded":true,"tree":{"label":"left"}},"0.1":{"isExpanded":true,"tree":{"label":"middle","children":[{"label":"midleft"},{"label":"midright"}]}},"0.2":{"isExpanded":true,"tree":{"label":"right"}},"0.1.0":{"isExpanded":true,"tree":{"label":"midleft"}},"0.1.1":{"isExpanded":true,"tree":{"label":"midright"}}}</a>
                    </li>
                </ol>
            </li>
        </ol>
    </div>
  `, `
    <div class="tree left inspire-tree">
        <ol>
            <li class="collapsed"><a class="title">TreeNode@0 : root</a>
                <ol>
                    <li class="collapsed"><a class="title">TreeLeaf@0,0 : left | UI state :
                        {"0":{"isExpanded":true,"tree":{"label":"root","children":[{"label":"left"}]}},"0.0":{"isExpanded":true,"tree":{"label":"left"}}}</a>
                    </li>
                </ol>
            </li>
        </ol>
    </div>
  `];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: treeNodes.map(cleanString),
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
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
});

