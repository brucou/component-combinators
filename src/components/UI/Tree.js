import { assertContract } from "../../../contracts/src"
import { InjectCircularSources } from "../Inject/InjectCircularSources"
import { InjectSources, InjectSourcesAndSettings } from "../.."
import { ForEach } from "../ForEach"
import { isNil, mergeAll, set, T, times , assoc} from 'ramda'
import { PATH_ROOT } from "../../../tracing/src/properties"
import { BFS, postOrderTraverseTree, reduceTree } from 'fp-rosetree'
import { m } from "../m"
import { combinatorNameInSettings } from "../../../tracing/src/helpers"
import * as jsonpatch from "fast-json-patch"

const stringify = path => path.join(".");
// TODO
const isValidTreeSignature = T;

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

function uiStateFactoryWith(injectedBehaviourName) {
  return function computeUIstate(sources, settings) {
    const injectedBehaviour$ = sources[injectedBehaviourName];
    const { treeSettings } = settings;
    const { localStateSource, localTreeSetting, defaultUIstateNode, localCommandSpecs, lenses } = treeSettings
    const newTree = settings[localTreeSetting];

    return injectedBehaviour$.map(currentUIstate => {
      // We need to ensure the invariant that for every node of the tree there is a corresponding ui state
      // That basically consists in, for every node of the tree for which we don't have a matching ui state, create a
      // default one
      debugger
      const newUIstate = reduceTree(lenses, {
        strategy: BFS,
        // NOTE : cloning the current UI state as we are going to mutate in place when traversing
        seed: currentUIstate,
        visit: function createMissingUIstate(uiState, traversalState, tree) {
          const { path } = traversalState.get(tree);
          const strPath = stringify(path);

          // update the dependent parts while making sure default values are set
          return assoc(strPath, mergeAll([defaultUIstateNode, uiState[strPath] || {}, { tree }]), uiState );
        }
      }, newTree)

      return newUIstate
    }).shareReplay(1)
  }
}

function DisplayTree(displayTreeSettings, componentTree) {
  return function mComponentDisplayTree(sources, settings) {
    // NOTE : here parentComponent is null by definition
    const [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] = componentTree;
    // NOTE : as those components are leaves in the component tree, they are advised automatically, so unadvise them
    // not to falsify the auto-generated location path in the component tree
    const childrenComponents = componentTree
    // .map(childComponent => isAdvised(childComponent) // TODO : remove when tested with tree depth 2
    // ? removeAdvice(childComponent)
    // : childComponent);
    const { treeSettings } = settings;
    const { localStateSource, localTreeSetting, defaultUIstateNode, localCommandSpecs, lenses } = treeSettings;
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

export function getInjectedBehaviourName(localStateSource){
  return 'B$' + localStateSource
}

export function Tree(_treeSettings, arrayComponents) {
  assertContract(isValidTreeSignature, [_treeSettings, arrayComponents], `Tree > isValidTreeSignature : wrong parameters ! `);

  // TODO : default values, some of those will be undefined and break down the road, so do some ramda magic somewhere
  // TODO : think about tracing : logging Map contents... circular sources are traced??
  const { treeSettings } = _treeSettings;
  const { treeSource, localStateSource, localTreeSetting, defaultUIstateNode, localCommandSpecs, lenses, sinkNames } = treeSettings;
  const [TreeEmpty, TreeRoot, TreeNode, TreeLeaf] = arrayComponents;
  const { source: localCommandSource, executeFn } = localCommandSpecs;

  const initialUserInterfaceState = {};
  const injectedBehaviourName = getInjectedBehaviourName(localStateSource);
  const injectedBehaviourConfig = {
    behaviourSourceName : injectedBehaviourName,
    initialBehaviorValue: initialUserInterfaceState,
    processingBehaviourFn : (patchCommands, behaviourCache) => {
      return jsonpatch.applyPatch(behaviourCache, patchCommands).newDocument
    } ,
    finalizeBehaviourSource : (behaviourCache) => behaviourCache = null
  };
  const injectedEventConfig = {
    eventSourceName : localCommandSource,
    processingEventFn : executeFn,
    finalizeEventSource : () => {}
  };

  const component =
    InjectSourcesAndSettings({ settings: _treeSettings }, [
      InjectCircularSources({ behaviour: injectedBehaviourConfig, event: injectedEventConfig }, [
        ForEach({ from: treeSource, as: localTreeSetting, sinkNames }, [
          InjectSources({ [localStateSource]: uiStateFactoryWith(injectedBehaviourName) }, [
            DisplayTree(set(combinatorNameInSettings, `DisplayTree`, {}), [
              TreeEmpty, TreeRoot, TreeNode, TreeLeaf
            ])
          ])
        ])
      ])
    ])
  ;

  return component
}

// DOC : the rule with ForEach (in tips in blog) is that the source used in the ForEach can never be reused down the
// component tree. That means also that no other streams depending on it can be used
// This is why that source downstream has already emitted its value for the branching to happen. So downstream sees
// another source which is next(source)!
