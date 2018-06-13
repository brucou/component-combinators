export const DEVTOOL_STATE_CHANNEL = 'devtool_state';
export const SELECTED_STATE_CHANNEL = 'deevtool_selected_state';
export const SEP = '.';

/**
 * @typedef {Object} TreeStructureMsg
 * @property {String} combinatorName For instance ListOf, ForEach, etc.
 * @property {String} componentName Name given to the component which may or may not be furher broken down into a
 * component tree
 * @property {String} id Id for the message
 * @property {Boolean} isContainerComponent Flags whether the component constructed through the component combinator
 * is a container component
 * @property {String} logType Should be always the same value encoding for TreeStructureMsg
 * @property {Array<Number>} path path in the component tree for the component constructed through the component
 * combinator
 * @property {Date} when timestamp for the moment the trace was emitted
 */
/**
 * @typedef {Object} EmissionMsg
 * @property {String} combinatorName For instance ListOf, ForEach, etc.
 * @property {String} componentName Name given to the component which may or may not be furher broken down into a
 * component tree
 * @property {RunTrace} emits Name given to the component which may or may not be furher broken down into a
 * component tree
 * @property {String} id Id for the message
 * @property {String} logType Should be always the same value encoding for EmissionMsg
 * @property {Array<Number>} path path in the component tree for the component constructed through the component
 * combinator
 * @property {*} settings Settings passed at **runtime** in parameter by the component contructed through the component
 * combinator.
 * @property {Date} when timestamp for the moment the trace was emitted
 */
/**
 * @typedef {Object} RunTrace
 * @property {SOURCE_TYPE | SINK_TYPE} type Encodes whether the trace for the data flow is a source or a sink
 * @property {String} identifier dxxxxxthe trace for the data flow is a source or a sink
 * @property {RunTraceNoification} notification sxxx
 */
/**
 * @typedef {Object} RunTraceNoification
 * @property {"N" | "E" | "C"} kind Encodes whether the trace for the data flow is an error, completion, or mext meesage
 * @property {*} value the actual data emitted (in case of a data message) for the traced emission
 * @property {RunTraceNoification} notification sxxx
 */
/**
 * @typedef {Number} SOURCE_TYPE
 */
/**
 * @typedef {Number} SINK_TYPE
 */
/**
 * @typedef {Object} DevtoolState
 * @property {Number} primarySelection the **id** for the trace data point primarily selected by the user through GUI
 * @property {Number} secondarySelection the **id** for the trace data point secondarily selected by the user
 * through GUI
 * @property {Number} selectionRushIndex rush index for the primary selection
 * @property {*} sourcesForSelectedTrace xxx
 * @property {*} sinksForSelectedTrace xx
 * @property {Number} currentRushIndex current rush of traces. Rushes are a sequence of `TreeStructureMsg`s followed
 * by a sequence of `EmissionMsg`s.
 * @property {Object.<Number, EmissionMsg>} emissionTracesById Maps a `EmissionMsg` id to the actual `EmissionMsg`
 * @property {Object.<Number, TreeStructureMsg>} treeStructureTracesById Maps a `TreeStructureMsg` id to the actual
 * `TreeStructureMsg`
 * @property {Object.<Number, Array<Number>>} treeStructureTraces Maps `TreeStructureMsg` ids (value in the dictionnary)
 * to the rush in which they occurred (key in the dictionnary)
 * @property {Object.<Number, Array<Number>>} emissionTraces Maps `EmissionMsg` ids (value in the dictionnary)
 * to the rush in which they occurred (key in the dictionnary)
 * @property {*} componentTrees xxx
 * // TODO : finish
 */
