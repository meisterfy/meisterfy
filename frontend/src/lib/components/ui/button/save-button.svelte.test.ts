import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import SaveButton from './save-button.svelte'

test('shows text when not saving and not saved', async () => {
  const screen = await render(SaveButton, {
    isSaving: false,
    saved: false,
    text: 'Save',
    savingText: 'Saving…',
    savedText: 'Saved'
  })
  await expect.element(screen.getByRole('button', { name: 'Save' })).toBeVisible()
})

test('shows savingText when isSaving', async () => {
  const screen = await render(SaveButton, {
    isSaving: true,
    saved: false,
    text: 'Save',
    savingText: 'Saving…',
    savedText: 'Saved'
  })
  await expect.element(screen.getByText('Saving…')).toBeVisible()
})

test('button is disabled when isSaving', async () => {
  const screen = await render(SaveButton, {
    isSaving: true,
    saved: false,
    text: 'Save',
    savingText: 'Saving…',
    savedText: 'Saved'
  })
  await expect.element(screen.getByRole('button')).toBeDisabled()
})

test('shows savedText feedback when saved', async () => {
  const screen = await render(SaveButton, {
    isSaving: false,
    saved: true,
    text: 'Save',
    savingText: 'Saving…',
    savedText: 'Changes saved'
  })
  await expect.element(screen.getByText('Changes saved')).toBeVisible()
})

test('does not show savedText when not saved', async () => {
  const screen = await render(SaveButton, {
    isSaving: false,
    saved: false,
    text: 'Save',
    savingText: 'Saving…',
    savedText: 'Changes saved'
  })
  expect(screen.getByText('Changes saved').elements()).toHaveLength(0)
})
