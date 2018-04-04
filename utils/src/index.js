import {
  assoc, clone, cond, curry, defaultTo, equals, flatten, isNil, keys, map, mapObjIndexed, merge, pipe, reduce, reject,
  T, tap, times, uniq, values
} from "ramda";
import Rx from "rx";
import { div, nav } from "cycle-snabbdom";
import toHTML from "snabbdom-to-html";
// import { StandardError } from "standard-error"
import formatObj from "pretty-format";

const $ = Rx.Observable;
const ERROR_MESSAGE_PREFIX = "ERROR : ";
const DOM_SINK = "DOM";

// Type checking typings
/**
 * @typedef {String} ErrorMessage
 */
/**
 * @typedef {Boolean|Array<ErrorMessage>} SignatureCheck
 * Note : The booleam can only be true
 */

// Component typings
/**
 * @typedef {String} SourceName
 */
/**
 * @typedef {String} SinkName
 */
/**
 * @typedef {Rx.Observable} Source
 */
/**
 * @typedef {Rx.Observable|Null} Sink
 */
/**
 * @typedef {Object.<string, Source>} Sources
 */
/**
 * @typedef {Object.<string, Sink>} Sinks
 */
/**
 * @typedef {?Object.<string, ?Object>} Settings
 */
/**
 * @typedef {function(Sink, Array<Sink>, Settings):Sink} mergeSink
 */
/**
 * @typedef {Object} DetailedComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings):Sinks} makeOwnSinks
 * @property {Object.<SinkName, mergeSink> | function} mergeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */

/**
 * @typedef {Object} ShortComponentDef
 * @property {?function(Sources, Settings)} makeLocalSources
 * @property {?function(Settings)} makeLocalSettings
 * @property {?function(Sources, Settings):Sinks} makeOwnSinks
 * @property {function(Component, Array<Component>, Sources, Settings)}
 * computeSinks
 * @property {function(Sinks):Boolean} sinksContract
 * @property {function(Sources):Boolean} sourcesContract
 */

/**
 * @typedef {function(Sources, Settings):Sinks} Component
 */

function isUndefined(obj) {
  return typeof obj === "undefined";
}

function removeEmptyVNodes(arrVNode) {
  return reduce(
    (accNonEmptyVNodes, vNode) => {
      return isNullVNode(vNode)
        ? accNonEmptyVNodes
        : (accNonEmptyVNodes.push(vNode), accNonEmptyVNodes);
    },
    [],
    arrVNode
  );
}

function isNullVNode(vNode) {
  return (
    equals(vNode.children, []) &&
    equals(vNode.data, {}) &&
    isUndefined(vNode.elm) &&
    isUndefined(vNode.key) &&
    isUndefined(vNode.sel) &&
    isUndefined(vNode.text)
  );
}

/**
 * For each element object of the array, returns the indicated property of
 * that object, if it exists, null otherwise.
 * For instance, `projectSinksOn('a', obj)` with obj :
 * - [{a: ..., b: ...}, {b:...}]
 * - result : [..., null]
 * @param {String} prop
 * @param {Array<*>} obj
 * @returns {Array<*>}
 */
function projectSinksOn(prop, obj) {
  return map(x => (x ? x[prop] : null), obj);
}

/**
 * Returns an array with the set of sink names extracted from an array of
 * sinks. The ordering of those names should not be relied on.
 * For instance:
 * - [{DOM, auth},{DOM, route}]
 * results in ['DOM','auth','route']
 * @param {Array<Sinks>} aSinks
 * @returns {Array<String>}
 */
function getSinkNamesFromSinksArray(aSinks) {
  return uniq(flatten(map(getValidKeys, aSinks)));
}

function getValidKeys(obj) {
  let validKeys = [];
  mapObjIndexed((value, key) => {
    if (value != null) {
      validKeys.push(key);
    }
  }, obj);

  return validKeys;
}

function makeDivVNode(x) {
  return {
    children: undefined,
    data: {},
    elm: undefined,
    key: undefined,
    sel: "div",
    text: x
  };
}

function vLift(vNode) {
  return function vLift(sources, settings) {
    return {
      [DOM_SINK]: $.of(vNode)
    };
  };
}

/**
 * Lifts a div function into a Div component which only has a DOM sink, whose only value emitted
 * is computed from the arguments passed
 * @returns {Component}
 */
function Div() {
  return vLift(div.apply(null, arguments));
}

function Nav() {
  return vLift(nav.apply(null, arguments));
}

/**
 *
 * @param {String} label
 * @param {Rx.Observable} source
 */
function labelSourceWith(label, source) {
  return source.map(x => ({ [label]: x }));
}

function EmptyComponent(sources, settings) {
  return {
    [DOM_SINK]: $.of(div(""))
  };
}

function DummyComponent(sources, settings) {
  return {
    [DOM_SINK]: $.of(div("dummy content"))
  };
}

/**
 * Turns a sink which is empty into a sink which emits `Null`
 * This is necessary for use in combination with `combineLatest`
 * As a matter of fact, `combineLatest(obs1, obs2)` will block till both
 * observables emit at least one value. So if `obs2` is empty, it will
 * never emit anything
 * @param sink
 * @returns {Observable|*}
 */
function emitNullIfEmpty(sink) {
  return isNil(sink)
    ? null
    : $.create(function emitNullIfEmptyObs(observer) {
      let isEmpty = true;

      sink.subscribe(
        function next(x) {
          isEmpty = false;
          observer.onNext(x);
        },
        function error(e) {
          console.error(`emitNullIfEmpty > Error!`, e);
          observer.onError(e);
        },
        function completed() {
          if (isEmpty) {
            observer.onNext(null);
          }
          observer.onCompleted();
        }
      );

      return function dispose() {
        // No clean-up necessary
      };
    });
  /*
    return isNil(sink) ?
      null :
      $.merge(
        sink,
        sink.isEmpty().filter(x => x).map(x => null)
      )
  */
}

/**
 * Returns an object whose keys :
 * - the first key found in `obj` for which the matching predicate was
 * fulfilled. Predicates are tested in order of indexing of the array.
 * - `_index` the index in the array where a predicate was fulfilled if
 * any, undefined otherwise
 * Ex : unfoldObjOverload('DOM', {sourceName: isString, predicate: isPredicate})
 * Result : {sourceName : 'DOM'}
 * @param obj
 * @param {Array<Object.<string, Predicate>>} overloads
 * @returns {{}}
 */
function unfoldObjOverload(obj, overloads) {
  let result = {};
  let index = 0;

  overloads.some(overload => {
    // can only be one property
    const property = keys(overload)[0];
    const predicate = values(overload)[0];
    const predicateEval = predicate(obj);

    if (predicateEval) {
      result[property] = obj;
      result._index = index;
    }
    index++;

    return predicateEval;
  });
  return result;
}

function isBoolean(obj) {
  return typeof obj === "boolean";
}

function isString(obj) {
  return typeof obj === "string";
}

// from https://github.com/substack/deep-freeze/blob/master/index.js
function deepFreeze(o) {
  Object.freeze(o);

  Object.getOwnPropertyNames(o).forEach(function (prop) {
    if (o.hasOwnProperty(prop)
      && o[prop] !== null
      && (typeof o[prop] === "object" || typeof o[prop] === "function")
      && !Object.isFrozen(o[prop])) {
      deepFreeze(o[prop]);
    }
  });

  return o;
}

function makeErrorMessage(errorMessage) {
  return ERROR_MESSAGE_PREFIX + errorMessage;
}

function removeNullsFromArray(arr) {
  return reject(isNil, arr);
}

//IE workaround for lack of function name property on Functions
//getFunctionName :: (* -> *) -> String
const getFunctionName = (r => fn => {
  return fn.name || ((("" + fn).match(r) || [])[1] || "Anonymous");
})(/^\s*function\s*([^\(]*)/i);

// cf.
// http://stackoverflow.com/questions/9479046/is-there-any-non-eval-way-to-create-a-function-with-a-runtime-determined-name
/**
 *
 * @param name
 * @param {Array<String>} args Names for the arguments of the function
 * @param {String} body Body of the function (source string)
 * @param {Object | Array} scope Extra VALUES to pass to the function, addressable by their name.
 * Note that
 * the values that will be seen are the ones at the moment of the call, i.e. eager eval, NOT
 * closure, those are CONSTANT values, not variables. BUT among those values can be functions!
 * so useful to put functions in scope. Those functions can have their own closure. That helps
 * solving the issue (or advantage) that Function does not create closure from its environment.
 * @param {null | Array} values if `values` is an array, so must be `scope`. In this case,
 * `scope` must be an array of property keys, `values` being the corresponding array of values
 * NOTE : very poorly written function in terms of readability...
 * @returns {Function}
 * @example
 * --
 * var f = NamedFunction("fancyname", ["hi"], "display(hi);", {display:display});
 * f.toString(); // "function fancyname(hi) {
 *               // display(hi);
 *               // }"
 *  f("Hi");
 *  --
 *  `display` can be defined anywhere and as any function can close over its context
 * @constructor
 */
function NamedFunction(name, args, body, scope, values) {
  if (typeof args == "string")
    values = scope, scope = body, body = args, args = [];
  if (!Array.isArray(scope) || !Array.isArray(values)) {
    if (typeof scope == "object") {
      var keys = Object.keys(scope);
      values = keys.map(function (p) { return scope[p]; });
      scope = keys;
    } else {
      values = [];
      scope = [];
    }
  }
  return Function(scope, "function " + name + "(" + args.join(", ") + ") {\n" + body + "\n}\nreturn " + name + ";").apply(null, values);
}

// decorateWith(decoratingFn, fnToDecorate), where log :: fn -> fn such as both have same name
// and possibly throw exception if that make sense to decoratingFn
function decorateWithOne(decoratorSpec, fnToDecorate) {
  const fnToDecorateName = getFunctionName(fnToDecorate);

  return NamedFunction(
    fnToDecorateName,
    [],
    `
      const args = [].slice.call(arguments);
      const decoratingFn = makeFunctionDecorator(decoratorSpec);
      return decoratingFn(args, fnToDecorateName, fnToDecorate);
`,
    { makeFunctionDecorator, decoratorSpec, fnToDecorate, fnToDecorateName },
    undefined
  );
}

const decorateWith = curry(function decorateWith(decoratingFnsSpecs, fnToDecorate) {
  return decoratingFnsSpecs.reduce((acc, decoratingFn) => {
    return decorateWithOne(decoratingFn, acc);
  }, fnToDecorate);
});

/**
 * NOTE : incorrect declaration... TODO : correct one day
 * before(fnToDecorate, fnToDecorateName, args) or nil
 * after(fnToDecorate, fnToDecorateName, result) or nil
 * but not both nil
 * TODO : incoherent! after can modify returned value but before cannot
 * TODO : refactor as standard advice : before, around, after - only around can modify flow/args
 * TODO : edge case not dealt with : throwing?
 * @returns {function(fnToDecorate: Function, fnToDecorateName:String, args:Array<*>)}
 */
function makeFunctionDecorator({ before, after, name }) {
  // we can have one of the two not specified, but if we have none, there is no decorator to make
  if (typeof before !== "function" && typeof after !== "function") {
    throw `makeFunctionDecorator: you need to specify 'before' OR 'after' as decorating functions. You passed falsy values for both!`;
  }

  const decoratorFnName = defaultTo("anonymousDecorator", name);

  // trick to get the same name for the returned function
  // cf.
  // http://stackoverflow.com/questions/9479046/is-there-any-non-eval-way-to-create-a-function-with-a-runtime-determined-name
  // BUG : does not seem to work in chrome actually. HAve to use Function constructor, hence eval... NOTE :
  // NamedFunction hence works
  const obj = {
    [decoratorFnName](args, fnToDecorateName, fnToDecorate) {
      before && before(args, fnToDecorateName, fnToDecorate);

      const result = fnToDecorate(...args);

      return after ? after(result, fnToDecorateName, fnToDecorate) : result;
    }
  };

  return obj[decoratorFnName];
}

const assertFunctionContractDecoratorSpecs = fnContract => ({
  before: (args, fnToDecorateName) => {
    const checkDomain = fnContract.checkDomain;
    const contractFnName = getFunctionName(checkDomain);
    const passed = checkDomain(...args);

    if (!isBoolean(passed) || (isBoolean(passed) && !passed)) {
      // contract is failed
      console.error(`assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName} \n
${isString(passed) ? passed : ""}`);
      throw `assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName}`;
    }
  },
  after: (result, fnToDecorateName) => {
    const checkCodomain = fnContract.checkCodomain;
    const contractFnName = getFunctionName(checkCodomain);
    const passed = checkCodomain(result);

    if (!isBoolean(passed) || (isBoolean(passed) && !passed)) {
      // contract is failed
      console.error(`assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName} \n
${isString(passed) ? passed : ""}`);
      throw `assertFunctionContractDecorator: ${fnToDecorateName} fails contract ${contractFnName}`;
    }

    return result;
  }
});

function preventDefault(ev) {
  if (ev) ev.preventDefault();
}

function addPrefix(prefix) {
  return function (str) {
    return prefix + str;
  };
}

function noop() {}

function toBoolean(x) {
  return !!x;
}

/**
 * Returns a function which turns an object to be put at a given path location into an array of
 * JSON patch operations
 * @param {JSON_Pointer} path
 * @returns {Function}
 */
function toJsonPatch(path) {
  return pipe(
    mapObjIndexed((value, key) => ({ op: "add", path: [path, key].join("/"), value: value })),
    values
  );
}

function stripHtmlTags(html) {
  let tmp = document.createElement("DIV");
  tmp.innerHTML = html;

  const strippedContent = tmp.textContent || tmp.innerText || "";

  tmp.remove();

  return strippedContent;
}

/**
 * Iterative tree traversal generic algorithm
 * @param StoreConstructor a constructor for either a queue (breadth-first) or a stack
 * structure (depth-first)
 * @param {Function} pushFn queue or push instruction
 * @param {Function} popFn dequeue or pop instruction
 * @param {Function} isEmptyStoreFn check if the data structure used to store node to
 * process is empty
 * @param {Function} visitFn the visiting function on the node. Its results are accumulated
 * into the final result of the traverseTree function
 * @param {Function} getChildrenFn give the children for a given node
 * @param root the root node of the tree to traverse
 */
function traverseTree({ StoreConstructor, pushFn, popFn, isEmptyStoreFn, visitFn, getChildrenFn }, root) {
  const traversalResult = [];
  const store = new StoreConstructor();
  pushFn(store, root);
  while ( !isEmptyStoreFn(store) ) {
    const vnode = popFn(store);
    traversalResult.push(visitFn(vnode));
    getChildrenFn(vnode).forEach((child, index) => pushFn(store, child));
  }

  return traversalResult;
}

// TODO : traverseTree, adding concat monoidal function, and monoidal empty
// then store: { empty, add, take, isEmpty}
// then take :: store -> Maybe Tree (maybe, because the store could be empty...)
//      add :: [Tree] -> store -> store, automatically derived from below
//      add :: Tree -> store -> store // NO: use the array form
//      add :: [] -> store -> store (the store is left unchanged)
// T must have getChildrenFn :: Tree -> [] | [Tree], i.e. it is a prism!!
// Tree T :: Leaf T | [Tree T]
// visitFn should be a reducer :: acc -> Tree -> acc'
const PATH_ROOT = [0];
export const POST_ORDER = "POST_ORDER";
export const PRE_ORDER = "PRE_ORDER";
export const BFS = "BFS";

/**
 *
 * @param {Map} traversalState
 * @param subTree
 * @param {Array} subTreeChildren
 * @modifies {traversalState}
 */
function updatePathInTraversalState(traversalState, subTree, subTreeChildren) {
  subTreeChildren.forEach((subTreeChild, index) => {
    const traversalStateParent = traversalState.get(subTree);
    // NOTE : if the path is already set we do not modify it. This allows for post-order traversal, which puts back
    // the parent node into the children nodes to keep the original path for the parent node. So at any time, the
    // `path` value can be trusted to be accurately describing the location of the node in the tree
    const traversalStateChild = traversalState.get(subTreeChild);
    const currentChildPath = traversalStateChild && traversalStateChild.path;

    traversalState.set(
      subTreeChild,
      merge(traversalStateChild, {
        isAdded: true,
        isVisited: false,
        path: currentChildPath || traversalStateParent.path.concat(index)
      })
    );
  });
}

/**
 *
 * @param {Map} traversalState
 * @param tree
 * @modifies {traversalState}
 */
function updateVisitInTraversalState(traversalState, tree) {
  traversalState.set(
    tree,
    merge(traversalState.get(tree), { isVisited: true })
  );
}

function visitTree(traversalSpecs, tree) {
  const { store, lenses, traverse } = traversalSpecs;
  const { empty, add, takeAndRemoveOne, isEmpty } = store;
  const { getChildren, getLabel, setChildren, setLabel } = lenses;
  const { visit, seed } = traverse;
  const traversalState = new Map();

  // necessary to avoid destructive updates on input parameters
  let currentStore = clone(empty);
  let visitAcc = clone(seed);
  add([tree], currentStore);
  traversalState.set(tree, { isAdded: true, isVisited: false, path: PATH_ROOT });

  while ( !isEmpty(currentStore) ) {
    const subTree = takeAndRemoveOne(currentStore);
    const subTreeChildren = getChildren(traversalState, subTree);

    add(subTreeChildren, currentStore);
    updatePathInTraversalState(traversalState, subTree, subTreeChildren);
    visitAcc = visit(visitAcc, traversalState, subTree);
    updateVisitInTraversalState(traversalState, subTree);
  }

  traversalState.clear();

  return visitAcc;
}

function breadthFirstTraverseTree(lenses, traverse, tree) {
  const { getChildren } = lenses;
  const traversalSpecs = {
    store: {
      empty: [],
      takeAndRemoveOne: store => store.shift(),
      isEmpty: store => store.length === 0,
      add: (subTrees, store) => store.push.apply(store, subTrees)
    },
    lenses: { getChildren: (traversalState, subTree) => getChildren(subTree) },
    traverse
  };

  return visitTree(traversalSpecs, tree);
}

function preorderTraverseTree(lenses, traverse, tree) {
  const { getChildren } = lenses;
  const traversalSpecs = {
    store: {
      empty: [],
      takeAndRemoveOne: store => store.shift(),
      isEmpty: store => store.length === 0,
      // NOTE : vs. bfs, only `add` changes
      add: (subTrees, store) => store.unshift(...subTrees)
    },
    lenses: { getChildren: (traversalState, subTree) => getChildren(subTree) },
    traverse
  };

  return visitTree(traversalSpecs, tree);
}

function postOrderTraverseTree(lenses, traverse, tree) {
  const { getChildren } = lenses;
  const isLeaf = tree => getChildren(tree).length === 0;
  const { seed, visit } = traverse;
  const decoratedLenses = {
    // For post-order, add the parent at the end of the children, that simulates the stack for the recursive function
    // call in the recursive post-order traversal algorithm
    getChildren: (traversalState, tree) =>
      traversalState.get(tree).isVisited || isLeaf(tree)
        ? []
        : getChildren(tree).concat(tree)
  };
  const traversalSpecs = {
    store: {
      empty: [],
      takeAndRemoveOne: store => store.shift(),
      isEmpty: store => store.length === 0,
      add: (subTrees, store) => store.unshift(...subTrees)
    },
    lenses: decoratedLenses,
    traverse: {
      seed: seed,
      visit: (result, traversalState, tree) => {
        const localTraversalState = traversalState.get(tree);
        // Cases :
        // 1. label has been visited already : visit
        // 2. label has not been visited, and there are no children : visit
        // 3. label has not been visited, and there are children : don't visit, will do it later
        if (localTraversalState.isVisited) {
          visit(result, traversalState, tree);
        } else {
          if (isLeaf(tree)) {
            visit(result, traversalState, tree);
          } else {
            //
          }
        }

        return result;
      }
    }
  };

  return visitTree(traversalSpecs, tree);
}

// DOC:  because this uses Map, every node MUST be a different object. It is easy to be the case for nodes, but less
// obvious for leaves. Leaves MUST all be different object!!!
// TODO : put in separate library

/**
 *
 * @param {{getChildren : function}} lenses
 * @param {{strategy : *, seed : *, visit : function}} traverse
 * @param tree
 * @returns {*}
 */
function reduceTree(lenses, traverse, tree) {
  const strategy = traverse.strategy;
  const strategies = {
    BFS: breadthFirstTraverseTree,
    PRE_ORDER: preorderTraverseTree,
    POST_ORDER: postOrderTraverseTree
  };

  if (!(strategy in strategies)) throw `Unknown tree traversal strategy!`;

  return strategies[strategy](lenses, traverse, tree);
}

/**
 * Applies a function to every node of a tree. Note that the traversal strategy does matter, as the function to
 * apply might perform effects.
 * @param {{getChildren : function}} lenses
 * @param {{strategy : *, action : function}} traverse
 * @param tree
 * @returns {*}
 */
function forEachInTree(lenses, traverse, tree) {
  const { strategy, action } = traverse;

  const strategies = {
    [BFS]: breadthFirstTraverseTree,
    [PRE_ORDER]: preorderTraverseTree,
    [POST_ORDER]: postOrderTraverseTree
  };

  if (!(strategy in strategies)) throw `Unknown tree traversal strategy!`;

  const treeTraveerse = {
    seed: void 0,
    visit: (accumulator, traversalState, tree) => action(tree, traversalState)
  };
  return strategies[strategy](lenses, treeTraveerse, tree);
}

/**
 * Applies a function to every node of a tree, while keeping the tree structure. Note that the traversal strategy in
 * that case does not matter, as all nodes will be traversed anyway, and the function to apply is assumed to be a
 * pure function.
 * @param {{getChildren : function, setChildren : function, setLabel : function}} lenses
 * @param {function} mapFn Function to apply to each node.
 * @param tree
 * @returns {*}
 */
function mapOverTree(lenses, mapFn, tree) {
  const { getChildren, constructTree, getLabel } = lenses;
  const getChildrenNumber = tree => getChildren(tree).length;
  const stringify = path => path.join(".");
  const treeTraveerse = {
    seed: new Map(),
    visit: (pathMap, traversalState, tree) => {
      const { path } = traversalState.get(tree);
      // Paths are *stringified* because Map with non-primitive objects uses referential equality
      const mappedLabel = mapFn(getLabel(tree));
      const mappedChildren = times(index => pathMap.get(stringify(path.concat(index))), getChildrenNumber(tree));
      const mappedTree= constructTree(mappedLabel, mappedChildren) ;
      pathMap.set(stringify(path), mappedTree);

      return pathMap;
    }
  };
  const pathMap = postOrderTraverseTree(lenses, treeTraveerse, tree);
  const mappedTree = pathMap.get(stringify(PATH_ROOT));
  pathMap.clear();

  return mappedTree;
}

function firebaseListToArray(fbList) {
  // will have {key1:element, key2...}
  return values(fbList);
}

function getInputValue(document, sel) {
  const el = document.querySelector(sel);
  return el ? el.value : "";
}

function filterNull(driver) {
  return function filteredDOMDriver(sink$) {
    return driver(sink$.filter(Boolean));
  };
}

// debug
/**
 * Adds `tap` logging/tracing information to all sinks
 * @param {String} traceInfo
 * @param {Sinks} sinks
 * @returns {*}
 */
function traceSinks(traceInfo, sinks) {
  return mapObjIndexed((sink$, sinkName) => {
    return sink$
      ? sink$.tap(function log(x) {
        console.debug(`traceSinks > ${traceInfo} > sink ${sinkName} emits :`, x)
      })
      // Pass on null and undefined values as they are, they will be filtered out downstream
      : sink$
  }, sinks)
}

const logFnTrace = (title, paramSpecs) => ({
  before: (args, fnToDecorateName) =>
    console.info(`==> ${title.toUpperCase()} | ${fnToDecorateName}(${paramSpecs.join(', ')}): `, args),
  after: (result, fnToDecorateName) => {
    console.info(`<== ${title.toUpperCase()} | ${fnToDecorateName} <- `, result);
    return result;
  }
});

function toHTMLorNull(x) {
  return x ? toHTML(x) : null;
}

function convertVNodesToHTML(vNodeOrVnodes) {
  if (Array.isArray(vNodeOrVnodes)) {
    console.debug(`toHTML: ${vNodeOrVnodes.map(x => (x ? toHTML(x) : null))}`);
    return vNodeOrVnodes.map(toHTMLorNull);
  } else {
    console.debug(`toHTML: ${toHTMLorNull(vNodeOrVnodes)}`);
    return toHTMLorNull(vNodeOrVnodes);
  }
}

function formatArrayObj(arr, separator) {
  return arr.map(format).join(separator);
}

function format(obj) {
  // basically if obj is an object, use formatObj, else use toString
  if (obj === "null") {
    return "<null>";
  } else if (obj === "undefined") {
    return "<undefined>";
  } else if (typeof obj === "string" && obj.length === 0) {
    return "<empty string>";
  } else if (Array.isArray(obj)) {
    return formatArrayObj(obj, " ; ");
  } else if (typeof obj === "object") {
    if (keys(obj).length === 0) {
      // i.e. object is {}
      return "<empty object>";
    } else return formatObj(obj, { maxDepth: 3 });
  } else {
    return "" + obj;
  }
}

function traceFn(fn, text) {
  return pipe(fn, tap(console.warn.bind(console, text ? text + ":" : "")));
}

/**
 * @typedef {{before:Function, after:Function, afterThrowing:Function, afterReturning:Function, around:Function}} Advice
 */
/**
 * @typedef {Object} JoinPoint
 * @property {Array} args
 * @property {Function} fnToDecorateName
 * @property {*} [returnedValue]
 * @property {Error} [exception]
 */
const decorateWithAdvices = curry(_decorateWithAdvices);

/**
 *
 * @param {Array<Advice>} advices
 * @param {Function} fnToAdvise
 * @returns {Function} function decorated with the advices
 */
function _decorateWithAdvices(advices, fnToAdvise) {
  return advices.reduce((acc, advice) => {
    return decorateWithAdvice(advice, acc);
  }, fnToAdvise);
}

function isAdvised(fn) {
  return Boolean(fn && fn.isAdvised);
}

function decorateWithAdvice(advice, fnToAdvise) {
  const fnToDecorateName = getFunctionName(fnToAdvise);

  const advisedFn = NamedFunction(
    fnToDecorateName,
    [],
    `
      const args = [].slice.call(arguments);
      const decoratingFn = makeAdvisedFunction(advice);
      const joinpoint = {args, fnToDecorateName};
      return decoratingFn(joinpoint, fnToAdvise);
`,
    { makeAdvisedFunction, advice, fnToAdvise, fnToDecorateName }, undefined);
  advisedFn.isAdvised = true;
  // keep track of the original function, to be able to remove advice down the road
  advisedFn.fn = fnToAdvise;

  return advisedFn;
}

function makeAdvisedFunction(advice) {
  // Contract :
  // if `around` is correctly set, then there MUST NOT be a `before` and `after`
  // if `around` is not set, there MUST be EITHER `before` OR `after`
  if ("around" in advice && typeof advice.around === "function") {
    if ("before" in advice || "after" in advice) {
      throw `makeAdvisedFunction: if 'around' is set, then there MUST NOT be a 'before' or 'after' property`;
    } else {
      // Main case : AROUND advice
      return function aroundAdvisedFunction(joinpoint, fnToDecorate) {
        // NOTE : could be shorten, but left as is for readability
        return advice.around(joinpoint, fnToDecorate);
      };
    }
  } else if (!("before" in advice || "after" in advice)) {
    throw `makeAdvisedFunction: if 'around' is not set, then there MUST be EITHER 'before' OR 'after' property`;
  } else {
    // Main case : BEFORE or/and AFTER advice
    return function advisedFunction(joinpoint, fnToDecorate) {
      const { args, fnToDecorateName } = joinpoint;
      const { before, after, afterThrowing, afterReturning, around } = advice;

      before && before(joinpoint, fnToDecorate);
      let result;
      let exception;

      try {
        result = fnToDecorate.apply(null, args);

        // if advised function does not throw, then we execute `afterReturning` advice
        // TODO : Contract : if `after` then MUST NOT have `afterThrowing` or `afterReturning`
        afterReturning && afterReturning(assoc('returnedValue', result, joinpoint), fnToDecorate);
        return result
      }
      catch (_exception) {
        // Include the exception information in the joinpoint
        afterThrowing && afterThrowing(assoc('exception', _exception, joinpoint), fnToDecorate);
        exception = _exception;
        throw _exception;
      } finally {
        // We execute `after` advice even if advised function throws
        after && after(merge({ returnedValue: result, exception }, joinpoint), fnToDecorate);
      }
    };
  }
}

function removeAdvice(advisedFn) {
  if (!isAdvised(advisedFn)) {
    throw `removeAdvice : cannot remove advice on function : it is not advised in the first place!`;
  } else {
    return advisedFn.fn;
  }
}

const ONE_COMPONENT_ONLY = "one_component_only";
const CONTAINER_AND_CHILDREN = "container_and_children";
const CHILDREN_ONLY = "children_only";
/** @type Array<[]>*/
const componentTreePatternMatchingPredicates = [
  [ONE_COMPONENT_ONLY, componentTree => isNil(componentTree[1])],
  [CONTAINER_AND_CHILDREN, componentTree => Array.isArray(componentTree[1])],
  [CHILDREN_ONLY, T]
];

/**
 * @typedef {Function} Predicate
 */
/**
 * @typedef {Function} Expression
 * Function which takes any number or no arguments and returns or not a value
 * MUST be a pure function (otherwise we will call it Procedure)
 */

/**
 * @typedef {String} CaseName
 * Identifier for a case expression in a pattern matching section
 * MUST be non-empty
 */
/**
 *
 * @param {Array<[CaseName, Predicate]>} patternMatchingPredicates
 * @param {Object.<CaseName, Expression>} patternMatchingExpressions
 */
function makePatternMatcher(
  patternMatchingPredicates,
  patternMatchingExpressions
) {
  // TODO : check inputs' type contracts

  const conditions = patternMatchingPredicates.map(([caseName, predicate]) => {
    const caseHandler = patternMatchingExpressions[caseName];

    if (!caseHandler) {
      console.error(`makePatternMatcher : case ${caseName} does not have matching expression!`, patternMatchingExpressions);
      throw `makePatternMatcher : case ${caseName} does not have matching expression!`
    }
  });

  return cond(conditions);
}

function isNextNotification(notification) {
  return notification.kind === "N";
}

function isCompletedNotification(notification) {
  return notification.kind === "C";
}

function isErrorNotification(notification) {
  return notification.kind === "E";
}

export {
  // Helpers
  emitNullIfEmpty,
  EmptyComponent,
  DummyComponent,
  vLift,
  Div,
  Nav,
  DOM_SINK,
  projectSinksOn,
  getSinkNamesFromSinksArray,
  removeEmptyVNodes,
  makeDivVNode,
  labelSourceWith,
  // Misc. utils
  unfoldObjOverload,
  removeNullsFromArray,
  deepFreeze,
  makeErrorMessage,
  decorateWithOne,
  decorateWith,
  makeFunctionDecorator,
  assertFunctionContractDecoratorSpecs,
  preventDefault,
  addPrefix,
  noop,
  toJsonPatch,
  toBoolean,
  stripHtmlTags,
  ERROR_MESSAGE_PREFIX,
  traverseTree,
  visitTree,
  breadthFirstTraverseTree,
  preorderTraverseTree,
  postOrderTraverseTree,
  reduceTree,
  forEachInTree,
  mapOverTree,
  firebaseListToArray,
  getInputValue,
  filterNull,
  // debug
  traceSinks,
  getFunctionName,
  logFnTrace,
  convertVNodesToHTML,
  formatArrayObj,
  format,
  traceFn,
  isAdvised,
  decorateWithAdvices,
  decorateWithAdvice,
  removeAdvice,
  ONE_COMPONENT_ONLY,
  CONTAINER_AND_CHILDREN,
  CHILDREN_ONLY,
  componentTreePatternMatchingPredicates,
  makePatternMatcher,
  isNextNotification,
  isCompletedNotification,
  isErrorNotification
};
