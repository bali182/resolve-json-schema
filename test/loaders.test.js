import { loadSchema } from '../src/loader'
import { schemaPath } from './utils'

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000

describe('http and file loader', () => {
  it('should load the same package.json schema from schemastore and a file', () => Promise.all([
    loadSchema('http://json.schemastore.org/package'),
    loadSchema(schemaPath('package'))
  ]).then(([httpSchema, fileSchema]) => expect(httpSchema).toEqual(fileSchema)))
})
