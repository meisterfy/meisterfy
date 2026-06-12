import { resources } from './src/lib/i18n'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'globals'
    resources: (typeof resources)['en']
  }
}
