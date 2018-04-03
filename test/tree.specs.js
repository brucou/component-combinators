// Test reduceTree, foreachInTree, and mapOverTree!!

import * as QUnit from "qunitjs"
import { runTestScenario } from "../testing/src/runTestScenario"
import { Combine } from "../src/components/Combine"
import { iframeId, iframeSource } from "../tracing/src/properties"
import { componentNameInSettings, traceDOMsinkFn, traceEventSinkFn, traceEventSourceFn } from "../tracing/src/helpers"
import { DOM_SINK } from "../utils/src"
import { resetGraphCounter, traceApp } from "../tracing/src"

const tree = {label : 'root', children : [{label : 'left'}, {label: 'middle', children : [{label : 'midleft'}, {label:'midright'}]}, {label: 'right'}]}
const lenses = {
  getChildren : tree => tree.children || [],
};
const traverse = {seed:[], visit : (result, traversalState, tree) => {result.push(tree.label); return result;}}

QUnit.module("Testing tree traversal", {});

QUnit.test("main case - reduceTree", function exec_test(assert) {

  /**
   *
   * @param {{getChildren : function}} lenses
   * @param {{strategy : *, seed : *, visit : function}} traverse
   * @param tree
   * @returns {*}
   */
  const reduceTraverse = assoc('strategy', BFS, traverse)
  reduceTree(lenses, {strategy: , seed : [], }, tree)

  const testResult = runTestScenario(inputs, expectedMessages, tracedApp, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });

});
