import { assertContract } from "../../../contracts/src"
import { InjectCircularSources } from "../Inject/InjectCircularSources"
import { InjectSources } from "../.."
import { ForEach } from "../ForEach"
import { times, isNil, T } from 'ramda'
import { PATH_ROOT } from "../../../tracing/src/properties"
import {postOrderTraverseTree, BFS, } from 'fp-rosetree'
import { m } from "../m"

const stringify = path => path.join(".");
// TODO
const isValidTreeSignature = T;

export function Tree(_treeSettings, arrayComponents) {
  assertContract(isValidTreeSignature, [_treeSettings, arrayComponents], `Tree > isValidTreeSignature : wrong parameters ! `);

  // TODO : default values, some of those will be undefined and break down the road, so do some ramda magic somewhere
  // TODO : think about tracing : logging Map contents... circular sources are traced??
  const { treeSettings } = _treeSettings;
  const { treeSource, localStateSource, localTreeSetting, defaultUIstateNode: initState, localCommandSpecs, lenses, sinkNames } = treeSettings;
  const [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] = arrayComponents;
  const { source: localCommandSource, executeFn } = localCommandSpecs;

  const initialUserInterfaceState = new WeakMap();
  const injectedBehaviour = ['B$' + localStateSource, initialUserInterfaceState];
  const injectedEvent = [localCommandSource, executeFn];

  debugger
  const component =
    InjectCircularSources({ behaviour: injectedBehaviour, event: injectedEvent }, [
      InjectSources({ [localStateSource]: computeUIstateFrom(treeSource, injectedBehaviour[0], initState, lenses) }, [
        ForEach({ from: treeSource, as: localTreeSetting, sinkNames }, [
          DisplayTree({ treeSettings }, [
            TreeEmpty, TreeRoot, TreeNode, TreeLeaf
          ])
        ])
      ])
    ])
  ;

  // TODO : Remove from the passed settings the one I don't need (tree source etc.)
  return m({}, _treeSettings, [component])
}

function computeUIstateFrom(treeSource, injectedBehaviourName, defaultUIstateNode, lenses) {
  return function computeUIstate(sources, settings) {
    const treeSource$ = sources[treeSource];
    const injectedBehaviour$ = sources[injectedBehaviourName];

    return treeSource$.withLatestFrom(injectedBehaviour$, (tree, uiState) => {
      // We need to ensure the invariant that for every node of the tree there is a corresponding ui state
      // That basically consists in, for every node of the tree for which we don't have a matching ui state, create a
      // default one
      const newUIstate = reduceTree(lenses, {
        strategy: BFS,
        seed: uiState,
        visit: createMissingUIstateFrom(defaultUIstateNode)
      }, tree);

      return newUIstate
    })
  }
}

function createMissingUIstateFrom(defaultUIstateNode) {
  return function createMissingUIstate(uiState, traversalState, tree) {
    const { path } = traversalState.get(tree);
    const strPath = stringify(path);

    // update the dependent parts while making sure default values are set
    uiState.set(strPath, mergeAll([defaultUIstateNode, uiState.get(strPath) || {}, { tree }]));
  }
}

function DisplayTree(displayTreeSettings, componentTree) {
  // NOTE : signature already checked at Tree component level
  // NOTE : those four components have access to source.uistate and path
  // or whatever the configured name to display their content
  const [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] = componentTree;
  const { treeSettings } = displayTreeSettings;
  const { treeSource, localStateSource, localTreeSetting, defaultUIstateNode, localCommandSpecs, lenses, sinkNames } = treeSettings;
  // yeah I know, double indirection
  const tree = displayTreeSettings[localTreeSetting];

  if (isNil(tree)) {
    return m({}, {}, [TreeEmpty])
  }
  else {
    // traverse the tree to build the displaying component
    const pathMap = postOrderTraverseTree(
      lenses,
      { seed: () => WeakMap, visit: buildDisplayTreeComponentFrom(lenses, componentTree) },
      tree
    );
    const displayTreeComponent = pathMap.get(stringify(PATH_ROOT));
    //  pathMap.clear(); don't clear, so use a weakmap, we will need this for all the life time of the component

    // Actually the root has already been dealt with as a regular node. This gives an opportunity to wrap the
    // component up as necessary (in additional to convenient html wrapping tags, `TreeRoot` could also gather event
    // handling for all nodes)
    return m({}, {}, [TreeRoot, displayTreeComponent])
  }
}

function buildDisplayTreeComponentFrom(lenses, componentTree) {
  const { getChildren, getLabel } = lenses;
  const [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] = componentTree;

  return function buildDisplayTreeComponent(pathMap, traversalState, tree) {
    const { path } = traversalState.get(tree);
    const label = getLabel(tree);
    const getChildrenNumber = (tree, traversalState) => getChildren(tree, traversalState).length;
    const mappedChildren = times(
      index => pathMap.get(stringify(path.concat(index))),
      getChildrenNumber(tree, traversalState)
    );
    const mappedTree = (mappedChildren.length === 0)
      ? m({}, { path, label }, [TreeLeaf])
      : m({}, { path, label }, [TreeNode, mappedChildren])
    ;

    pathMap.set(stringify(path), mappedTree);

    return pathMap;
  }
}

