import uriJs from 'uri-js'
import isNil from 'lodash/isNil'
import isEmpty from 'lodash/isEmpty'
import assign from 'lodash/assign'
import clone from 'lodash/clone'
import isArray from 'lodash/isArray'
import values from 'lodash/values'
import createVisitor from 'json-schema-visitor'

import { loadSchema } from './loader'

const findChildNodesVisitor = createVisitor({
  allOf: node => node.allOf,
  anyOf: node => node.anyOf,
  oneOf: node => node.oneOf,
  array: ({ items }) => [items || {}],
  object: ({ properties }) => values(properties || {}),
}, () => [])

const addToIds = (schema, ids) => {
  if (schema && schema.id) {
    ids[schema.id] = schema
  }
  return ids
}

const collectIdsVisitor = createVisitor({
  allOf(schema, ids) {
    (schema.allOf || []).forEach(childSchema => collectIdsVisitor(childSchema, ids))
    return ids
  },
  anyOf(schema, ids) {
    (schema.anyOf || []).forEach(childSchema => collectIdsVisitor(childSchema, ids))
    return ids
  },
  oneOf(schema, ids) {
    (schema.oneOf || []).forEach(childSchema => collectIdsVisitor(childSchema, ids))
    return ids
  },
  object(schema, ids) {
    values(schema.properties || {}).forEach(childSchema => collectIdsVisitor(childSchema, ids))
    return addToIds(schema, ids)
  },
  array(schema, ids) {
    collectIdsVisitor(schema.items || {}, ids)
    return addToIds(schema, ids)
  }
}, addToIds)

// TODO in progress
/* 
const allIds = schemas => {
  const ids = {}
  schemas.forEach(schema => collectIdsVisitor(schema, ids))
  return ids
}
*/

const updateSchema = node => schema => {
  // mutation, not pretty
  delete node['$ref']
  assign(node, schema)
}

const resolveInSameDocument = (schema, segments) => {
  if (isEmpty(segments)) {
    return schema
  }
  const [key, ...tail] = segments
  if (key === '#') {
    return resolveInSameDocument(schema, tail)
  }
  const subSchema = schema[key]
  return resolveInSameDocument(subSchema, tail)
}

const resolveDocument = (root, node) => {
  const { $ref } = node

  if (isNil($ref)) {
    return Promise.resolve(root)
  }

  const uri = uriJs.parse($ref)

  if (uri.reference === 'same-document') {
    updateSchema(node)(resolveInSameDocument(root, $ref.split('/')))
    return resolveDocument(root, node)
  }

  return loadSchema($ref)
    .then(schema => resolveInSameDocument(schema, (uri.fragment || '').split('/')))
    .then(updateSchema(node))
    .then(() => node.$ref ? resolveDocument(root, node) : null)
}

const findChildNodes = node => {
  // mutation, not pretty but has to be done somewhere
  if (isArray(node.type)) {
    const childSchemas = node.type.map(type => assign(clone(node), { type }))
    delete node['type']
    node.oneOf = childSchemas
  }
  return findChildNodesVisitor(node)
}

const traverseResolve = (root, node) => {
  const resolvedNode = node.$ref ? resolveDocument(root, node) : Promise.resolve()
  return resolvedNode.then(() => {
    const childNodes = findChildNodes(node)
    const childResolvePromises = childNodes.map(childNode => traverseResolve(root, childNode))
    return Promise.all(childResolvePromises)
  })
}

export const resolve = uri => loadSchema(uri)
  .then(root => traverseResolve(root, root).then(() => root))

// TODO in progress
/*
const resolve2 = ({uri, dependencies = [], loader = loadSchema} = {}) => {
  Promise.all([uri, ...dependencies].map(loader)).then(schemas => {
    const [rootSchema, ...subSchemas] = schemas
    const ids = allIds(schemas)
  })
}
*/
