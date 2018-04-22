import { assertContract } from "../../../contracts/src"
import { InjectCircularSources } from "../Inject/InjectCircularSources"
import { InjectSourcesAndSettings } from "../.."
import { ForEach } from "../ForEach"
import { isNil, T, times, mergeAll, merge, set } from 'ramda'
import { PATH_ROOT } from "../../../tracing/src/properties"
import { BFS, postOrderTraverseTree, reduceTree} from 'fp-rosetree'
import { m } from "../m"
import { combinatorNameInSettings } from "../../../tracing/src/helpers"
import { isAdvised, removeAdvice } from "../../../utils/src"

const stringify = path => path.join(".");
// TODO
const isValidTreeSignature = T;

const displayTreeSpecs = {
  computeSinks: computeTreeSinks,
};

function computeTreeSinks(parentComponent, _childrenComponents, sources, settings){
  // NOTE : here parentComponent is null by definition
  const [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] = _childrenComponents;
  // NOTE : as those components are leaves in the component tree, they are advised automatically, so unadvise them
  // not to falsify the auto-generated location path in the component tree
  const childrenComponents = _childrenComponents.map(childComponent => isAdvised(childComponent)
    ? removeAdvice(childComponent)
    : childComponent);
  const { treeSettings } = settings;
  const { treeSource, localStateSource, localTreeSetting, defaultUIstateNode, localCommandSpecs, lenses } = treeSettings;
  // yeah I know, double indirection
  const tree = settings[localTreeSetting];

  if (isNil(tree)) {
    return m({}, set(combinatorNameInSettings, 'DisplayTree|Inner', {}), [TreeEmpty])(sources, settings)
  }
  else {
    // traverse the tree to build the displaying component
    const pathMap = postOrderTraverseTree(
      lenses,
      { seed: () => Map, visit: buildDisplayTreeComponentFrom(lenses, childrenComponents, settings) },
      tree
    );
    const displayTreeComponent = pathMap.get(stringify(PATH_ROOT));
    //  pathMap.clear(); don't clear, so use a weakmap, we will need this for all the life time of the component

    // Actually the root has already been dealt with as a regular node. This gives an opportunity to wrap the
    // component up as necessary (in additional to convenient html wrapping tags, `TreeRoot` could also gather event
    // handling for all nodes)
    return m({}, set(combinatorNameInSettings, 'DisplayTree|Inner', {}), [TreeRoot, [displayTreeComponent]])(sources, settings)
  }

}

function buildDisplayTreeComponentFrom(lenses, componentTree, settings) {
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
      ? m({}, set(combinatorNameInSettings, 'DisplayTree|Inner|Leaf', { path, label }), [TreeLeaf])
      : m({}, set(combinatorNameInSettings, 'DisplayTree|Inner|Node', { path, label }), [TreeNode, mappedChildren])
    ;

    pathMap.set(stringify(path), mappedTree);

    return pathMap;
  }
}

function uiStateFactoryWith(treeSettings, injectedBehaviourName) {
  const { treeSource, localStateSource, localTreeSetting, defaultUIstateNode: initState, localCommandSpecs, lenses } = treeSettings;

  return function computeUIstate(sources, settings) {
    const treeSource$ = sources[treeSource].tap(x => {debugger; console.log(`${treeSource}:`, x)});
    const injectedBehaviour$ = sources[injectedBehaviourName];

    return {
      [localStateSource]: treeSource$.withLatestFrom(injectedBehaviour$, (newTree, currentUIstate) => {
        // We need to ensure the invariant that for every node of the tree there is a corresponding ui state
        // That basically consists in, for every node of the tree for which we don't have a matching ui state, create a
        // default one
        const newUIstate = reduceTree(lenses, {
          strategy: BFS,
          // NOTE : cloning the current UI state as we are going to mutate in place when traversing
          seed: () => function cloneMap() { return new Map(currentUIstate)},
          visit: function createMissingUIstate(uiState, traversalState, tree) {
            const { path } = traversalState.get(tree);
            const strPath = stringify(path);

            // update the dependent parts while making sure default values are set
            uiState.set(strPath, mergeAll([initState, uiState.get(strPath) || {}, { tree }]));
            return uiState
          }
        }, newTree)

        debugger
        return newUIstate
      }).shareReplay(1)
    }
  }
}

function DisplayTree(displayTreeSettings, componentTree) {
  // !! dragons !!
  // To have proper path in component tree, we need to use [TreeRoot, [...]] instead of [TreeEmpty,...]
  // TODO : check it
  // DOC: this is because this `m` call is traced with TreeRoot not a container component hence it gets the path 1
  // instaed of 0
  // TODO : one alternative could be to pass componentTree in settings (in that case not propagate it down) or closure
  // try to use directly a function (sources, settings) which applies directly displayTreeSpecs.computeSinks
  return function mComponent(sources, settings){
      // NOTE : here parentComponent is null by definition
      const [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] = componentTree;
      // NOTE : as those components are leaves in the component tree, they are advised automatically, so unadvise them
      // not to falsify the auto-generated location path in the component tree
      const childrenComponents = componentTree.map(childComponent => isAdvised(childComponent)
        ? removeAdvice(childComponent)
        : childComponent);
      const { treeSettings } = settings;
      const { treeSource, localStateSource, localTreeSetting, defaultUIstateNode, localCommandSpecs, lenses } = treeSettings;
      // yeah I know, double indirection
      const tree = settings[localTreeSetting];

      if (isNil(tree)) {
        return m({}, set(combinatorNameInSettings, 'DisplayTree|Inner', {}), [TreeEmpty])(sources, settings)
      }
      else {
        // traverse the tree to build the displaying component
        const pathMap = postOrderTraverseTree(
          lenses,
          { seed: () => Map, visit: buildDisplayTreeComponentFrom(lenses, childrenComponents, settings) },
          tree
        );
        const displayTreeComponent = pathMap.get(stringify(PATH_ROOT));
        //  pathMap.clear(); don't clear, so use a weakmap, we will need this for all the life time of the component

        // Actually the root has already been dealt with as a regular node. This gives an opportunity to wrap the
        // component up as necessary (in additional to convenient html wrapping tags, `TreeRoot` could also gather event
        // handling for all nodes)
        return m({}, set(combinatorNameInSettings, 'DisplayTree|Inner', {}), [TreeRoot, [displayTreeComponent]])(sources, settings)
      }
    }
}

export function Tree(_treeSettings, arrayComponents) {
  assertContract(isValidTreeSignature, [_treeSettings, arrayComponents], `Tree > isValidTreeSignature : wrong parameters ! `);

  // TODO : default values, some of those will be undefined and break down the road, so do some ramda magic somewhere
  // TODO : think about tracing : logging Map contents... circular sources are traced??
  const { treeSettings } = _treeSettings;
  const { treeSource, localStateSource, localTreeSetting, defaultUIstateNode, localCommandSpecs, lenses, sinkNames } = treeSettings;
  const [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] = arrayComponents;
  const { source: localCommandSource, executeFn } = localCommandSpecs;

  const initialUserInterfaceState = () => Map;
  const injectedBehaviourName = 'B$' + localStateSource;
  const injectedBehaviour = [injectedBehaviourName, initialUserInterfaceState];
  const injectedEvent = [localCommandSource, executeFn];

  const component =
    InjectCircularSources({ behaviour: injectedBehaviour, event: injectedEvent }, [
      InjectSourcesAndSettings({
        sourceFactory: uiStateFactoryWith(treeSettings, injectedBehaviourName),
        settings: _treeSettings
      }, [
        ForEach({ from: treeSource, as: localTreeSetting, sinkNames }, [
          DisplayTree(set(combinatorNameInSettings, `DisplayTree`, {}), [
            TreeEmpty, TreeRoot, TreeNode, TreeLeaf
          ])
        ])
      ])
    ])
  ;

  // TODO : Remove from the passed settings the one I don't need (tree source etc.)
  return component
}
