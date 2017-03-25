import { readFile } from 'fs'
import { platform } from 'os'
import uriJs from 'uri-js'
import axios from 'axios'
import trimStart from 'lodash/trimStart'
import omit from 'lodash/omit'
import isObject from 'lodash/isObject'

const readJson = path => new Promise((resolve, reject) => {
  readFile(path, 'UTF-8', (error, data) => {
    if (error) {
      reject(error)
    } else {
      try {
        resolve(JSON.parse(data))
      } catch (e) {
        reject(e)
      }
    }
  })
})

export const loadFileSchema = uri => readJson(platform() === 'win32' ? trimStart(uri.path, '/') : uri.path)

export const loadHttpSchema = uri => {
  const url = uriJs.serialize(omit(uri, ['fragment']))
  return axios.get(url).then(response => response.data)
}

export const loadSchema = input => {
  const uri = isObject(input) ? input : uriJs.parse(input)
  switch (uri.scheme) {
    case 'file': return loadFileSchema(uri)
    case 'http': return loadHttpSchema(uri)
    default: return Promise.reject(new Error(`Unknown URI format ${JSON.stringify(uri)}`))
  }
}
