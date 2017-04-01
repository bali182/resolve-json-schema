import { resolve } from '../src/resolver'
import { schemaPath } from './utils'

const keys = object => Object.keys(object).sort()

describe('resolver', () => {

  const timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL

  beforeAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000
  })

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout
  })

  it('should properly resolve the person schema', () => resolve(schemaPath('person')).then(schema => {
    const { type, description, definitions, properties } = schema

    expect(type).toBe('object')
    expect(description).toBe('A simple person schema with a few properties')

    expect(keys(properties.name.properties)).toEqual(['first', 'last'])
    expect(keys(properties.dateOfBirth.properties)).toEqual(['day', 'month', 'year'])
    expect(keys(properties.address.properties)).toEqual(['city', 'country', 'state', 'street', 'zip'])
    expect(keys(definitions)).toEqual(['address', 'date', 'name', 'person'])
  }))
})
