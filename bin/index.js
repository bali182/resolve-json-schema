'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var uriJs = _interopDefault(require('uri-js'));
var isNil = _interopDefault(require('lodash/isNil'));
var isEmpty = _interopDefault(require('lodash/isEmpty'));
var assign = _interopDefault(require('lodash/assign'));
var clone = _interopDefault(require('lodash/clone'));
var isArray = _interopDefault(require('lodash/isArray'));
var values = _interopDefault(require('lodash/values'));
var fs = _interopDefault(require('fs'));
var os = _interopDefault(require('os'));
var axios = _interopDefault(require('axios'));
var trimStart = _interopDefault(require('lodash/trimStart'));
var memoize = _interopDefault(require('lodash/memoize'));
var omit = _interopDefault(require('lodash/omit'));
var isObject = _interopDefault(require('lodash/isObject'));

var loadFileSchema = function loadFileSchema(uri) {
  return new Promise(function (resolve, reject) {
    var path = os.platform() === 'win32' ? trimStart(uri.path, '/') : uri.path;
    fs.readFile(path, 'UTF-8', /* TODO think about detecting this */function (error, data) {
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

var loadHttpSchema = function loadHttpSchema(uri) {
  var url = uriJs.serialize(omit(uri, ['fragment']));
  return axios.get(url).then(function (response) {
    return response.data;
  });
};

var anySchemaLoader = function anySchemaLoader(uri) {
  switch (uri.scheme) {
    case 'file':
      return loadFileSchema(uri);
    case 'http':
      return loadHttpSchema(uri);
    default:
      throw new Error('Unknown URI format ' + JSON.stringify(uri));
  }
};

var loadSchema = memoize(function (uri) {
  return anySchemaLoader(uriJs.parse(uri));
});

var ANY_TYPE = 'any';
var OBJECT_TYPE = 'object';
var ARRAY_TYPE = 'array';
var ONE_OF_TYPE = 'oneOf';
var ANY_OF_TYPE = 'anyOf';
var ALL_OF_TYPE = 'allOf';
var ENUM_TYPE = 'enum';
var BOOLEAN_TYPE = 'boolean';
var NUMBER_TYPE = 'number';
var STRING_TYPE = 'string';
var NULL_TYPE = 'null';

var schemaType = function schemaType(schema) {
  if (isNil(schema)) {
    return ANY_TYPE;
  }

  if (!schema.allOf && !schema.anyOf && !schema.oneOf) {
    if (schema.type === 'object' || isObject(schema.properties) && !schema.type) {
      return OBJECT_TYPE;
    } else if (schema.type === 'array' || isObject(schema.items) && !schema.type) {
      return ARRAY_TYPE;
    }
  }

  if (isArray(schema.oneOf)) {
    return ONE_OF_TYPE;
  } else if (isArray(schema.anyOf)) {
    return ANY_OF_TYPE;
  } else if (isArray(schema.allOf)) {
    return ALL_OF_TYPE;
  } else if (isObject(schema.enum)) {
    return ENUM_TYPE;
  }

  switch (schema.type) {
    case 'boolean':
      return BOOLEAN_TYPE;
    case 'number':
      return NUMBER_TYPE;
    case 'integer':
      return NUMBER_TYPE;
    case 'string':
      return STRING_TYPE;
    case 'null':
      return NULL_TYPE;
    default:
      break;
  }

  return ANY_TYPE;
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

var findChildNodes = function findChildNodes(node) {
  // mutation, not pretty but has to be done somewhere
  if (isArray(node.type)) {
    var childSchemas = node.type.map(function (type) {
      return assign(clone(node), { type: type });
    });
    delete node['type'];
    node.oneOf = childSchemas;
  }

  switch (schemaType(node)) {
    case ALL_OF_TYPE:
      return node.allOf;
    case ANY_OF_TYPE:
      return node.anyOf;
    case ONE_OF_TYPE:
      return node.oneOf;
    case OBJECT_TYPE:
      return values(node.properties || {});
    case ARRAY_TYPE:
      return [node.items || {}];
    default:
      return [];
  }
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
