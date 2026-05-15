import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import Button from './button.svelte'

test('default variant applies indigo background class', async () => {
  const screen = await render(Button)
  await expect.element(screen.getByRole('button')).toHaveClass('bg-indigo-600')
})

test('outline variant applies slate border class', async () => {
  const screen = await render(Button, { variant: 'outline' })
  await expect.element(screen.getByRole('button')).toHaveClass('border-slate-200')
})

test('red variant applies red border class', async () => {
  const screen = await render(Button, { variant: 'red' })
  await expect.element(screen.getByRole('button')).toHaveClass('border-red-200')
})

test('transparent variant applies transparent border class', async () => {
  const screen = await render(Button, { variant: 'transparent' })
  await expect.element(screen.getByRole('button')).toHaveClass('border-transparent')
})

test('disabled button has disabled attribute', async () => {
  const screen = await render(Button, { disabled: true })
  await expect.element(screen.getByRole('button')).toBeDisabled()
})

test('disabled button applies pointer-events-none class', async () => {
  const screen = await render(Button, { disabled: true })
  await expect.element(screen.getByRole('button')).toHaveClass('disabled:pointer-events-none')
})
