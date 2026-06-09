import { cpSync, mkdirSync } from 'node:fs'

const src = '../frontend/locales'
const dst = './src/locales'

mkdirSync(dst, { recursive: true })
cpSync(src, dst, { recursive: true })
console.log('i18n locales copied')
