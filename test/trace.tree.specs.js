import { convertVNodesToHTML, DOM_SINK } from "../utils/src"
import * as QUnit from "qunitjs"
import { runTestScenario } from "../testing/src/runTestScenario"
import {
  resetGraphCounter, traceApp, componentNameInSettings, traceDOMsinkFn, traceEventSinkFn, traceEventSourceFn, traceBehaviourSinkFn, traceBehaviourSourceFn
} from "../tracing/src"
import { getInjectedBehaviourName, Tree } from "../src/components/UI"
import * as Rx from 'rx'
import { always, evolve, flatten, identity, is, mapObjIndexed, omit, pipe, set } from 'ramda'
import { a, div, li, ol } from 'cycle-snabbdom'

const $ = Rx.Observable;

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

QUnit.test("Main cases - trace - tree depth 1", function exec_test(assert) {
  resetGraphCounter();
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
        [COMMAND_SOURCE_NAME] : [traceEventSourceFn, traceEventSinkFn],
        [getInjectedBehaviourName(LOCAL_STATE_SOURCE_NAME)] :  [traceBehaviourSourceFn, traceBehaviourSinkFn],
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
        values: { a: tree1, b: tree2 }
      }
    },
  ];

  const uiState = `{"0":{"isExpanded":true,"tree":{"label":"root","children":[{"label":"left"}]}},"0.0":{"isExpanded":true,"tree":{"label":"left"}}}`;
  const treeNodes = `
  <div>
    <iframe id="devtool" src="devtool.html" style="width: 450px; height: 200px"></iframe>
    <div class="tree left inspire-tree">
        <ol>
            <li class="collapsed"><a class="title">TreeNode@0 : root</a>
                <ol>
                    <li class="collapsed"><a class="title">TreeLeaf@0,0 : left | UI state :
                        ${uiState}</a>
                    </li>
                </ol>
            </li>
        </ol>
    </div>
</div>`
  /** @type TestResults */
  const expected = {
    DOM: {
      outputs: [cleanString(treeNodes)],
      successMessage: 'sink DOM produces the expected values',
      // NOTE : I need to keep an eye on the html to check the good behaviour, cannot strip the tags
      transform: pipe(convertVNodesToHTML)
    },
  }

  const expectedGraphs = [[
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    }
  ], [
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "id": 7,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "id": 8,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "id": 9,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "id": 10,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "id": 11,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "id": 12,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ]
    },
  ],];
  const expectedTraces = [[
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
  ], [
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol></ol></div>"
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol></ol></li>"
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 8,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 9,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 10,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 15,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "root",
        "path": [
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 16,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "left",
        "path": [
          0,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "left",
        "path": [
          0,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li>"
        },
        "type": 1
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0
      ]
    }
  ]];

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
      assert.deepEqual(
        removeFunctions(removeWhenField(traces)),
        flatten([expectedGraphs[0], expectedTraces[0], expectedGraphs[1], expectedTraces[1]]),
        `Traces are produced as expected!`
      );
      done()
    });
});

QUnit.test("Main cases - traced - tree depth 1, depth 2 and depth1", function exec_test(assert) {
  resetGraphCounter();
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
        [COMMAND_SOURCE_NAME] : [traceEventSourceFn, traceEventSinkFn],
        [getInjectedBehaviourName(LOCAL_STATE_SOURCE_NAME)] :  [traceBehaviourSourceFn, traceBehaviourSinkFn],
        [DOM_SINK]: [identity, traceDOMsinkFn]
      },
      sendMessage: msg => traces.push(msg)
    },
    _helpers: { getId: getId(0) }
  }, treeComponent);

  const inputs = [
    {
      [TREE_SOURCE_NAME]: {
        diagram: '-a-b-a',
        values: { a: tree1, b: treeDepth2 }
      }
    },
  ];

  const treeNodes = [`
<div>
    <iframe id="devtool" src="devtool.html" style="width: 450px; height: 200px"></iframe>
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
</div>`, `
<div>
    <iframe id="devtool" src="devtool.html" style="width: 450px; height: 200px"></iframe>
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
</div>
  `, `
<div>
    <iframe id="devtool" src="devtool.html" style="width: 450px; height: 200px"></iframe>
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

  const expectedGraphs = [[
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "id": 0,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "id": 1,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "id": 2,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "id": 3,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "id": 4,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    }
  ], [
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "id": 5,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "id": 6,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "id": 7,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "id": 8,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "id": 9,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "id": 10,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "id": 11,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "id": 12,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ]
    },
  ], [
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "id": 13,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "id": 14,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "id": 15,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "id": 16,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "id": 17,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "id": 18,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "id": 19,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "id": 20,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "id": 21,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "id": 22,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "id": 23,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "id": 24,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "id": 25,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "id": 26,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "id": 27,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        3
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "id": 28,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        3,
        0
      ]
    },
  ], [
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "id": 29,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "id": 30,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "id": 31,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "id": 32,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "id": 33,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "id": 34,
      "isContainerComponent": true,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "id": 35,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "id": 36,
      "isContainerComponent": false,
      "logType": "graph_structure",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ]
    },
  ]];
  const expectedTraces = [[
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 0,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 1,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 2,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 3,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 4,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
  ], [
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 5,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol></ol></div>"
        },
        "type": 1
      },
      "id": 6,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol></ol></li>"
        },
        "type": 1
      },
      "id": 7,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 8,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 9,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 10,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 11,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 12,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 13,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 14,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 15,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "root",
        "path": [
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 16,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "left",
        "path": [
          0,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 17,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "left",
        "path": [
          0,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 18,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 19,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li>"
        },
        "type": 1
      },
      "id": 20,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 21,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 22,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 23,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 24,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 25,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 26,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 27,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 28,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              },
              {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              },
              {
                "label": "right"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 29,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              },
              {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              },
              {
                "label": "right"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 30,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              },
              {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              },
              {
                "label": "right"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 31,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              },
              {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              },
              {
                "label": "right"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 32,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              },
              {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              },
              {
                "label": "right"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 33,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
  ], [
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol></ol></div>"
        },
        "type": 1
      },
      "id": 34,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol></ol></li>"
        },
        "type": 1
      },
      "id": 35,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 36,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol></ol></li>"
        },
        "type": 1
      },
      "id": 37,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 38,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 39,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 40,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 41,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 42,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 43,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "root",
        "path": [
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 44,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "left",
        "path": [
          0,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 45,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "middle",
        "path": [
          0,
          1
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 46,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        3
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "right",
        "path": [
          0,
          2
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 47,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "left",
        "path": [
          0,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 48,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "midleft",
        "path": [
          0,
          1,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 49,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "midright",
        "path": [
          0,
          1,
          1
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 50,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        3,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "right",
        "path": [
          0,
          2
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 51,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 52,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        1,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "midleft",
        "path": [
          0,
          1,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  },
                  {
                    "children": [
                      {
                        "label": "midleft"
                      },
                      {
                        "label": "midright"
                      }
                    ],
                    "label": "middle"
                  },
                  {
                    "label": "right"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            },
            "0.1": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "midleft"
                  },
                  {
                    "label": "midright"
                  }
                ],
                "label": "middle"
              }
            },
            "0.1.0": {
              "isExpanded": true,
              "tree": {
                "label": "midleft"
              }
            },
            "0.1.1": {
              "isExpanded": true,
              "tree": {
                "label": "midright"
              }
            },
            "0.2": {
              "isExpanded": true,
              "tree": {
                "label": "right"
              }
            }
          }
        },
        "type": 0
      },
      "id": 53,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            },
            {
              "children": [
                {
                  "label": "midleft"
                },
                {
                  "label": "midright"
                }
              ],
              "label": "middle"
            },
            {
              "label": "right"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "midright",
        "path": [
          0,
          1,
          1
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 54,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        3,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 55,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 56,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        1,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 57,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 58,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        3
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 59,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        1
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 60,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        2
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li>"
        },
        "type": 1
      },
      "id": 61,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li>"
        },
        "type": 1
      },
      "id": 62,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 63,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 64,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 65,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 66,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 67,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 68,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 69,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeNode@0,1 : middle</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,0 : midleft | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,1,1 : midright | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,2 : right | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"},{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]},{\"label\":\"right\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}},\"0.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"middle\",\"children\":[{\"label\":\"midleft\"},{\"label\":\"midright\"}]}},\"0.2\":{\"isExpanded\":true,\"tree\":{\"label\":\"right\"}},\"0.1.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"midleft\"}},\"0.1.1\":{\"isExpanded\":true,\"tree\":{\"label\":\"midright\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 70,
      "logType": "runtime",
      "path": [
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 71,
      "logType": "runtime",
      "path": [
        0
      ],
      "settings": {}
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 72,
      "logType": "runtime",
      "path": [
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 73,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 74,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ],
      "settings": {
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "TREE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "children": [
              {
                "label": "left"
              }
            ],
            "label": "root"
          }
        },
        "type": 0
      },
      "id": 75,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
  ], [
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol></ol></div>"
        },
        "type": 1
      },
      "id": 76,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol></ol></li>"
        },
        "type": 1
      },
      "id": 77,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "B$LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {}
        },
        "type": 0
      },
      "id": 78,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeRoot",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 79,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeNodeLight",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "error": undefined,
          "kind": "C"
        },
        "type": 1
      },
      "id": 80,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 81,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 82,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 83,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "root",
        "path": [
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 84,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "left",
        "path": [
          0,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "LOCAL_STATE_SOURCE_NAME",
        "notification": {
          "kind": "N",
          "value": {
            "0": {
              "isExpanded": true,
              "tree": {
                "children": [
                  {
                    "label": "left"
                  }
                ],
                "label": "root"
              }
            },
            "0.0": {
              "isExpanded": true,
              "tree": {
                "label": "left"
              }
            }
          }
        },
        "type": 0
      },
      "id": 85,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ],
      "settings": {
        "TREE_SETTING_NAME": {
          "children": [
            {
              "label": "left"
            }
          ],
          "label": "root"
        },
        "as": "TREE_SETTING_NAME",
        "from": "TREE_SOURCE_NAME",
        "label": "left",
        "path": [
          0,
          0
        ],
        "sinkNames": [
          "DOM"
        ],
        "treeSettings": {
          "defaultUIstateNode": {
            "isExpanded": true
          },
          "lenses": {
            "getChildren": "function getChildren",
            "getLabel": "function getLabel"
          },
          "localCommandSpecs": {
            "executeFn": "function commandExecFn",
            "source": "COMMAND_SOURCE_NAME"
          },
          "localStateSource": "LOCAL_STATE_SOURCE_NAME",
          "localTreeSetting": "TREE_SETTING_NAME",
          "sinkNames": [
            "DOM"
          ],
          "treeSource": "TREE_SOURCE_NAME"
        }
      }
    },
    {
      "combinatorName": undefined,
      "componentName": "TreeLeafWithPrintedUIstate",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 86,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        0
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Leaf",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li>"
        },
        "type": 1
      },
      "id": 87,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner|Node",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li>"
        },
        "type": 1
      },
      "id": 88,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0,
        1
      ]
    },
    {
      "combinatorName": "DisplayTree|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 89,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 90,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 91,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "ForEach",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 92,
      "logType": "runtime",
      "path": [
        0,
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources|Inner",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 93,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectCircularSources",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 94,
      "logType": "runtime",
      "path": [
        0,
        0,
        0
      ]
    },
    {
      "combinatorName": "InjectSourcesAndSettings",
      "componentName": "treeComponent",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 95,
      "logType": "runtime",
      "path": [
        0,
        0
      ]
    },
    {
      "combinatorName": "Combine",
      "componentName": "ROOT",
      "emits": {
        "identifier": "DOM",
        "notification": {
          "kind": "N",
          "value": "<div class=\"tree left inspire-tree\"><ol><li class=\"collapsed\"><a class=\"title\">TreeNode@0 : root</a><ol><li class=\"collapsed\"><a class=\"title\">TreeLeaf@0,0 : left | UI state : {\"0\":{\"isExpanded\":true,\"tree\":{\"label\":\"root\",\"children\":[{\"label\":\"left\"}]}},\"0.0\":{\"isExpanded\":true,\"tree\":{\"label\":\"left\"}}}</a></li></ol></li></ol></div>"
        },
        "type": 1
      },
      "id": 96,
      "logType": "runtime",
      "path": [
        0
      ]
    }
  ]];

  const testResult = runTestScenario(inputs, expected, tracedApp, {
    tickDuration: 3,
    waitForFinishDelay: 10,
    analyzeTestResults: analyzeTestResults(assert, done),
    errorHandler: function (err) {
      done(err)
    }
  });
  testResult
    .then(_ => {
      assert.deepEqual(
        removeFunctions(removeWhenField(traces)),
        expectedGraphs.reduce((acc, _, index) => acc.concat(expectedGraphs[index]).concat(expectedTraces[index]), []),
        `Traces are produced as expected!`
      );
      done()
    });
});

