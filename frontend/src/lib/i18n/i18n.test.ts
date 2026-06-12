import { describe, it, expect } from 'vitest'
import i18n from './index'

describe('i18n', () => {
  it('resolves a known globals key', () => {
    expect(i18n.t('globals:profile_subtitle')).toBe('Manage your personal preferences')
  })

  it('switches to pt-BR and returns a different translation', async () => {
    await i18n.changeLanguage('pt-BR')
    // 'save' exists in both locales: en='Save', pt-BR='Salvar'
    expect(i18n.t('globals:save')).toBe('Salvar')
    // restore to en so other tests are unaffected
    await i18n.changeLanguage('en')
  })
})
