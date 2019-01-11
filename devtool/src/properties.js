export const DEVTOOL_STATE_CHANNEL = 'devtool_state';
export const SELECTED_STATE_CHANNEL = 'deevtool_selected_state';
export const SEP = '.';
export const COMBINATOR_SECTION_SELECTOR = '.combinator';

export const CONTROL_CHANNEL = 'control';
export const DATA_CHANNEL = 'data';

// cf. https://www.w3schools.com/charsets/ref_utf_arrows.asp
export const UPWARDS_DOUBLE_ARROW = "\u21D1";
export const DOWNWARDS_DOUBLE_ARROW = "\u21D3";
const EMITTED_MESSAGE_NEXT_SELECTOR = '.next-notification';
const EMITTED_MESSAGE_ERROR_SELECTOR = '.error-notification';
const EMITTED_MESSAGE_COMPLETED_SELECTOR = '.completed-notification';
export const EMITTED_MESSAGE_TYPE_SELECTOR = {
  N: EMITTED_MESSAGE_NEXT_SELECTOR,
  E: EMITTED_MESSAGE_ERROR_SELECTOR,
  C: EMITTED_MESSAGE_COMPLETED_SELECTOR
};
export const EMITTED_MESSAGE_SECTION_SELECTOR = '.trace';


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
 * @property {RunTraceNotification} notification sxxx
 */
/**
 * @typedef {Object} RunTraceNotification
 * @property {"N" | "E" | "C"} kind Encodes whether the trace for the data flow is an error, completion, or mext meesage
 * @property {*} value the actual data emitted (in case of a data message) for the traced emission
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
 * @property {DisplayTraceTreeSpecs} renderSpecs specs, i.e. functions which specify how specific parts of the UI should
 * be represented
 * // TODO : finish
 */
/**
 * @typedef {{combinators : CombinatorMap, channels : ChannelMap}} DisplayTraceTreeSpecs Specifications for
 * the visual appearance of combinators, and sources/sinks a.k.a channels
*/
/**
 * @typedef {Object.<String, function (strPath:string, treeStructureTraceMsg:TreeStructureMsg, selectedTraceMsg:EmissionMsg)>} CombinatorMap
 * Specifications for the visual appearance of combinators, and sources/sinks a.k.a channels
 * - `strPath` is the path at which the component node to display is in the component tree
 * - `treeStructureTraceMsg` is the parameters of the component node being displayed in the component tree
 * - `selectedTraceMsg` is the emitted message corresponding to the selection made by the user in the UI
 */
/**
 * @typedef {Object.<String, Function>} ChannelMap Specifications for
 * the visual appearance of combinators, and sources/sinks a.k.a channels // TODO : finish
 */
