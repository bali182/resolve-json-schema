import { loadSchema } from '../src/loader'
import { schemaPath } from './utils'

describe('http and file loader', () => {

  const timeout = jasmine.DEFAULT_TIMEOUT_INTERVAL

  beforeAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000
  })

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout
  })

  it('should load the same package.json schema from schemastore and a file', () => Promise.all([
    loadSchema('http://json.schemastore.org/package'),
    loadSchema(schemaPath('package'))
  ]).then(([httpSchema, fileSchema]) => expect(httpSchema).toEqual(fileSchema)))
})
