import {
  schemaType, ALL_OF_TYPE, ANY_OF_TYPE, ANY_TYPE, ARRAY_TYPE, BOOLEAN_TYPE,
  ENUM_TYPE, NULL_TYPE, NUMBER_TYPE, OBJECT_TYPE, ONE_OF_TYPE, STRING_TYPE
} from '../src/types'

describe('types', () => {
  it('should classify as ANY_TYPE', () => {
    expect(schemaType(undefined)).toBe(ANY_TYPE)
    expect(schemaType(null)).toBe(ANY_TYPE)
    expect(schemaType({})).toBe(ANY_TYPE)
    expect(schemaType({ foo: 1, bar: 2 })).toBe(ANY_TYPE)
    expect(schemaType({ type: 'non-existing-type' })).toBe(ANY_TYPE)
  })

  it('should classify as STRING_TYPE', () => {
    expect(schemaType({ type: 'string' })).toBe(STRING_TYPE)
    expect(schemaType({ type: 'string', description: 'foo' })).toBe(STRING_TYPE)
  })
})
