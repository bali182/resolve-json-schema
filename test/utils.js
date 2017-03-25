import { join } from 'path'

export const schemaPath = name => `file://${join(__dirname, `schemas/${name}.schema.json`)}`
