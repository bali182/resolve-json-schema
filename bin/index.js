'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var uriJs = _interopDefault(require('uri-js'));
var isNil = _interopDefault(require('lodash/isNil'));
var isEmpty = _interopDefault(require('lodash/isEmpty'));
var assign = _interopDefault(require('lodash/assign'));
var clone = _interopDefault(require('lodash/clone'));
var isArray = _interopDefault(require('lodash/isArray'));
var values = _interopDefault(require('lodash/values'));
var createVisitor = _interopDefault(require('json-schema-visitor'));
var fs = require('fs');
var os = require('os');
var axios = _interopDefault(require('axios'));
var trimStart = _interopDefault(require('lodash/trimStart'));
var lodash_memoize = _interopDefault(require('lodash/memoize'));
var omit = _interopDefault(require('lodash/omit'));
var isObject = _interopDefault(require('lodash/isObject'));

var readJson = function readJson(path) {
  return new Promise(function (resolve, reject) {
    fs.readFile(path, 'UTF-8', function (error, data) {
      if (error) {
        reject(error);
      } else {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      }
    });
  });
};

var loadFileSchema = function loadFileSchema(uri) {
  return readJson(os.platform() === 'win32' ? trimStart(uri.path, '/') : uri.path);
};

var loadHttpSchema = function loadHttpSchema(uri) {
  var url = uriJs.serialize(omit(uri, ['fragment']));
  return axios.get(url).then(function (response) {
    return response.data;
  });
};

var loadSchema = function loadSchema(input) {
  var uri = isObject(input) ? input : uriJs.parse(input);
  switch (uri.scheme) {
    case 'file':
      return loadFileSchema(uri);
    case 'http':
      return loadHttpSchema(uri);
    default:
      return Promise.reject(new Error('Unknown URI format ' + JSON.stringify(uri)));
  }
};

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

var updateSchema = function updateSchema(node) {
  return function (schema) {
    // mutation, not pretty
    delete node['$ref'];
    assign(node, schema);
  };
};

var resolveInSameDocument = function resolveInSameDocument(schema, segments) {
  if (isEmpty(segments)) {
    return schema;
  }

  var _segments = _toArray(segments),
      key = _segments[0],
      tail = _segments.slice(1);

  if (key === '#') {
    return resolveInSameDocument(schema, tail);
  }
  var subSchema = schema[key];
  return resolveInSameDocument(subSchema, tail);
};

var resolveDocument = function resolveDocument(root, node) {
  var $ref = node.$ref;


  if (isNil($ref)) {
    return Promise.resolve(root);
  }

  var uri = uriJs.parse($ref);

  if (uri.reference === 'same-document') {
    updateSchema(node)(resolveInSameDocument(root, $ref.split('/')));
    return resolveDocument(root, node);
  }

  return loadSchema($ref).then(function (schema) {
    return resolveInSameDocument(schema, (uri.fragment || '').split('/'));
  }).then(updateSchema(node)).then(function () {
    return node.$ref ? resolveDocument(root, node) : null;
  });
};

var findChildNodesVisitor = createVisitor({
  allOf: function allOf(node) {
    return node.allOf;
  },
  anyOf: function anyOf(node) {
    return node.anyOf;
  },
  oneOf: function oneOf(node) {
    return node.oneOf;
  },
  array: function array(_ref) {
    var items = _ref.items;
    return [items || {}];
  },
  object: function object(_ref2) {
    var properties = _ref2.properties;
    return values(properties || {});
  }
}, function () {
  return [];
});

var findChildNodes = function findChildNodes(node) {
  // mutation, not pretty but has to be done somewhere
  if (isArray(node.type)) {
    var childSchemas = node.type.map(function (type) {
      return assign(clone(node), { type: type });
    });
    delete node['type'];
    node.oneOf = childSchemas;
  }
  return findChildNodesVisitor(node);
};

var traverseResolve = function traverseResolve(root, node) {
  var resolvedNode = node.$ref ? resolveDocument(root, node) : Promise.resolve();
  return resolvedNode.then(function () {
    var childNodes = findChildNodes(node);
    var childResolvePromises = childNodes.map(function (childNode) {
      return traverseResolve(root, childNode);
    });
    return Promise.all(childResolvePromises);
  });
};

var resolve = function resolve(uri) {
  return loadSchema(uri).then(function (root) {
    return traverseResolve(root, root).then(function () {
      return root;
    });
  });
};

module.exports = resolve;
