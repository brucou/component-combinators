import forOwn from "./lodash/forOwn"
import remove from "./lodash/remove"
import uniq from "./lodash/uniq"
import escape from "./lodash/escape"
import kebabCase from "./lodash/kebabCase"

// https://github.com/Matt-Esch/virtual-dom/blob/master/virtual-hyperscript/parse-tag.js
var classIdSplit = /([\.#]?[a-zA-Z0-9\u007F-\uFFFF_:-]+)/
var notClassId = /^\.|#/

var split =
  /*!
   * Cross-Browser Split 1.1.1
   * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
   * Available under the MIT License
   * ECMAScript compliant, uniform cross-browser split method
   */

  /**
   * Splits a string into an array of strings using a regex or string separator. Matches of the
   * separator are not included in the result array. However, if `separator` is a regex that
   * contains capturing groups, backreferences are spliced into the result each time `separator` is
   * matched. Fixes browser bugs compared to the native `String.prototype.split` and can be used
   * reliably cross-browser.
   * @param {String} str String to split.
   * @param {RegExp|String} separator Regex or string to use for separating the string.
   * @param {Number} [limit] Maximum number of items to include in the result array.
   * @returns {Array} Array of substrings.
   * @example
   *
   * // Basic use
   * split('a b c d', ' ');
   * // -> ['a', 'b', 'c', 'd']
   *
   * // With limit
   * split('a b c d', ' ', 2);
   * // -> ['a', 'b']
   *
   * // Backreferences in result array
   * split('..word1 word2..', /([a-z]+)(\d+)/i);
   * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
   */
  (function split(undef) {

    var nativeSplit = String.prototype.split,
      compliantExecNpcg = /()??/.exec("")[1] === undef,
      // NPCG: nonparticipating capturing group
      self;

    self = function (str, separator, limit) {
      // If `separator` is not a regex, use `nativeSplit`
      if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
        return nativeSplit.call(str, separator, limit);
      }
      var output = [],
        flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
          (separator.sticky ? "y" : ""),
        // Firefox 3+
        lastLastIndex = 0,
        // Make `global` and avoid `lastIndex` issues by working with a copy
        separator = new RegExp(separator.source, flags + "g"),
        separator2, match, lastIndex, lastLength;
      str += ""; // Type-convert
      if (!compliantExecNpcg) {
        // Doesn't need flags gy, but they don't hurt
        separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
      }
      /* Values for `limit`, per the spec:
       * If undefined: 4294967295 // Math.pow(2, 32) - 1
       * If 0, Infinity, or NaN: 0
       * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
       * If negative number: 4294967296 - Math.floor(Math.abs(limit))
       * If other: Type-convert, then use the above rules
       */
      limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
        limit >>> 0; // ToUint32(limit)
      while ( match = separator.exec(str) ) {
        // `separator.lastIndex` is not reliable cross-browser
        lastIndex = match.index + match[0].length;
        if (lastIndex > lastLastIndex) {
          output.push(str.slice(lastLastIndex, match.index));
          // Fix browsers whose `exec` methods don't consistently return `undefined` for
          // nonparticipating capturing groups
          if (!compliantExecNpcg && match.length > 1) {
            match[0].replace(separator2, function () {
              for (var i = 1; i < arguments.length - 2; i++) {
                if (arguments[i] === undef) {
                  match[i] = undef;
                }
              }
            });
          }
          if (match.length > 1 && match.index < str.length) {
            Array.prototype.push.apply(output, match.slice(1));
          }
          lastLength = match[0].length;
          lastLastIndex = lastIndex;
          if (output.length >= limit) {
            break;
          }
        }
        if (separator.lastIndex === match.index) {
          separator.lastIndex++; // Avoid an infinite loop
        }
      }
      if (lastLastIndex === str.length) {
        if (lastLength || !separator.test("")) {
          output.push("");
        }
      } else {
        output.push(str.slice(lastLastIndex));
      }
      return output.length > limit ? output.slice(0, limit) : output;
    };

    return self;
  })();

function parseSelector(selector, upper) {
  selector = selector || ''
  var tagName
  var id = ''
  var classes = []

  var tagParts = split(selector, classIdSplit)

  if (notClassId.test(tagParts[1]) || selector === '') {
    tagName = 'div'
  }

  var part, type, i

  for (i = 0; i < tagParts.length; i++) {
    part = tagParts[i]

    if (!part) {
      continue
    }

    type = part.charAt(0)

    if (!tagName) {
      tagName = part
    } else if (type === '.') {
      classes.push(part.substring(1, part.length))
    } else if (type === '#') {
      id = part.substring(1, part.length)
    }
  }

  return {
    tagName: upper === true ? tagName.toUpperCase() : tagName,
    id: id,
    className: classes.join(' ')
  }
}

////// elements
// All SVG children elements, not in this list, should self-close

const elements = {
  CONTAINER: {
    // http://www.w3.org/TR/SVG/intro.html#TermContainerElement
    'a': true,
    'defs': true,
    'glyph': true,
    'g': true,
    'marker': true,
    'mask': true,
    'missing-glyph': true,
    'pattern': true,
    'svg': true,
    'switch': true,
    'symbol': true,

    // http://www.w3.org/TR/SVG/intro.html#TermDescriptiveElement
    'desc': true,
    'metadata': true,
    'title': true
  },
  VOID: {
    area: true,
    base: true,
    br: true,
    col: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    keygen: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true
  }
}

// http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements


var VOID_ELEMENTS = elements.VOID
var CONTAINER_ELEMENTS = elements.CONTAINER

function init(modules) {
  function parse(vnode, node) {
    var result = []
    var attributes = new Map([
      // These can be overwritten because that’s what happens in snabbdom
      ['id', node.id],
      ['class', node.className]
    ])

    modules.forEach(function (fn, index) {
      fn(vnode, attributes)
    })
    attributes.forEach(function (value, key) {
      if (value && value !== '') {
        result.push(key + '="' + value + '"')
      }
    })

    return result.join(' ')
  }

  return function renderToString(vnode) {
    if (!vnode.sel && vnode.text) {
      return vnode.text
    }

    vnode.data = vnode.data || {}

    // Support thunks
    if (vnode.data.hook &&
      typeof vnode.data.hook.init === 'function' &&
      typeof vnode.data.fn === 'function') {
      vnode.data.hook.init(vnode)
    }

    var node = parseSelector(vnode.sel)
    var tagName = node.tagName
    var attributes = parse(vnode, node)
    var svg = vnode.data.ns === 'http://www.w3.org/2000/svg'
    var tag = []

    // Open tag
    tag.push('<' + tagName)
    if (attributes.length) {
      tag.push(' ' + attributes)
    }
    if (svg && CONTAINER_ELEMENTS[tagName] !== true) {
      tag.push(' /')
    }
    tag.push('>')

    // Close tag, if needed
    if ((VOID_ELEMENTS[tagName] !== true && !svg) ||
      (svg && CONTAINER_ELEMENTS[tagName] === true)) {
      if (vnode.data.props && vnode.data.props.innerHTML) {
        tag.push(vnode.data.props.innerHTML)
      } else if (vnode.text) {
        tag.push(vnode.text)
      } else if (vnode.children) {
        vnode.children.forEach(function (child) {
          tag.push(renderToString(child))
        })
      }
      tag.push('</' + tagName + '>')
    }

    return tag.join('')
  }
}

var assign = Object.assign

var modules = {
  class: function classModule(vnode, attributes) {
    var values
    var _add = []
    var _remove = []
    var classes = vnode.data.class || {}
    var existing = attributes.get('class')
    existing = existing.length > 0 ? existing.split(' ') : []

    forOwn(classes, function (value, key) {
      if (value === true) {
        _add.push(key)
      } else {
        _remove.push(key)
      }
    })

    values = remove(uniq(existing.concat(_add)), function (value) {
      return _remove.indexOf(value) < 0
    })

    if (values.length) {
      attributes.set('class', values.join(' '))
    }
  },
  props: function propsModule(vnode, attributes) {
    var omit = [
      'attributes',
      'childElementCount',
      'children',
      'classList',
      'clientHeight',
      'clientLeft',
      'clientTop',
      'clientWidth',
      'currentStyle',
      'firstElementChild',
      'innerHTML',
      'lastElementChild',
      'nextElementSibling',
      'ongotpointercapture',
      'onlostpointercapture',
      'onwheel',
      'outerHTML',
      'previousElementSibling',
      'runtimeStyle',
      'scrollHeight',
      'scrollLeft',
      'scrollLeftMax',
      'scrollTop',
      'scrollTopMax',
      'scrollWidth',
      'tabStop',
      'tagName'
    ]

    var props = vnode.data.props || {}

    forOwn(props, function (value, key) {
      if (omit.indexOf(key) > -1) {
        return
      }
      if (key === 'htmlFor') {
        key = 'for'
      }
      if (key === 'className') {
        key = 'class'
      }

      attributes.set(key.toLowerCase(), escape(value))
    })
  },
  attributes: function attrsModule(vnode, attributes) {
    var attrs = vnode.data.attrs || {}

    forOwn(attrs, function (value, key) {
      attributes.set(key, escape(value))
    })
  },
  style: function styleModule(vnode, attributes) {
    var values = []
    var style = vnode.data.style || {}

    // merge in `delayed` properties
    if (style.delayed) {
      assign(style, style.delayed)
    }

    forOwn(style, function (value, key) {
      // omit hook objects
      if (typeof value === 'string' || typeof value === 'number') {
        values.push(`${kebabCase(key)}: ${escape(value)}`)
      }
    })

    if (values.length) {
      attributes.set('style', values.join('; '))
    }
  }
}

const toHTML = init([
  modules.attributes,
  modules.props,
  modules.class,
  modules.style
])

export default toHTML

