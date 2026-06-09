import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enAds from '../../locales/en/ads.json'
import enAuth from '../../locales/en/auth.json'
import enGlobals from '../../locales/en/globals.json'
import enIntegrations from '../../locales/en/integrations.json'
import enPermissions from '../../locales/en/permissions.json'
import enSettings from '../../locales/en/settings.json'
import enSocial from '../../locales/en/social-media.json'
import enTenants from '../../locales/en/tenants.json'

import ptAds from '../../locales/pt-BR/ads.json'
import ptAuth from '../../locales/pt-BR/auth.json'
import ptGlobals from '../../locales/pt-BR/globals.json'
import ptIntegrations from '../../locales/pt-BR/integrations.json'
import ptPermissions from '../../locales/pt-BR/permissions.json'
import ptSettings from '../../locales/pt-BR/settings.json'
import ptSocial from '../../locales/pt-BR/social-media.json'
import ptTenants from '../../locales/pt-BR/tenants.json'

export const resources = {
  en: {
    ads: enAds,
    auth: enAuth,
    globals: enGlobals,
    integrations: enIntegrations,
    permissions: enPermissions,
    settings: enSettings,
    'social-media': enSocial,
    tenants: enTenants
  },
  'pt-BR': {
    ads: ptAds,
    auth: ptAuth,
    globals: ptGlobals,
    integrations: ptIntegrations,
    permissions: ptPermissions,
    settings: ptSettings,
    'social-media': ptSocial,
    tenants: ptTenants
  }
} as const

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'globals',
  interpolation: { escapeValue: false }
})

export default i18n
