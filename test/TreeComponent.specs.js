import * as QUnit from "qunitjs"
import * as Rx from 'rx'
import { convertVNodesToHTML, DOM_SINK } from "../utils/src"
import { runTestScenario } from "../testing/src/runTestScenario"
import { div, strong } from "cycle-snabbdom"
import { Tree } from "../src/components/UI"
import {pipe} from 'ramda'

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

const TREE_SOURCE_NAME = 'TREE_SOURCE_NAME';
const LOCAL_STATE_SOURCE_NAME = 'LOCAL_STATE_SOURCE_NAME';
const TREE_SETTING_NAME = 'TREE_SETTING_NAME';
const COMMAND_SOURCE_NAME = 'COMMAND_SOURCE_NAME';
const A_SINK = 'A_SINK';
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

function TreeEmpty(sources, settings){
  return {
    [DOM_SINK] : $.of(div('TreeEmpty'))
  }
}

function TreeRoot(sources, settings){
  return {
    [DOM_SINK] : $.of(div('TreeRoot'))
  }
}

function TreeNode(sources, settings){
  const {path, label} = settings;

  return {
    [DOM_SINK] : $.of(div(`TreeNode@${path} : ${label}`))
  }
}

function TreeLeaf(sources, settings){
  const {path, label} = settings;

  return {
    [DOM_SINK] : $.of(div(`TreeLeaf@${path} : ${label}`))
  }
}

function commandExecFn(command){
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
    treeSettings : {
      treeSource : TREE_SOURCE_NAME,
      localStateSource : LOCAL_STATE_SOURCE_NAME,
      localTreeSetting : TREE_SETTING_NAME,
      defaultUIstateNode : {isExpanded : true},
      localCommandSpecs : {source : COMMAND_SOURCE_NAME, executeFn : commandExecFn},
      lenses : {getChildren : tree => tree.children || [], getLabel : tree => tree.label || ''},
      sinkNames : [A_SINK, DOM_SINK]
    }
  };

  const arrayComponents = [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] ;

  const treeComponent = Tree(_treeSettings, arrayComponents);

  const inputs = [
    {
      [TREE_SOURCE_NAME]: {
        diagram: '-a',
        values: { a: treeDepth2}
      }
    },
  ];

  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [],
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
