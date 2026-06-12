import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import Input from './input.svelte'

test('renders text input with placeholder', async () => {
	const screen = await render(Input, { placeholder: 'Enter value' })
	await expect.element(screen.getByPlaceholder('Enter value')).toBeVisible()
})

test('text input accepts typed value', async () => {
	const screen = await render(Input, { type: 'text', placeholder: 'Name' })
	await screen.getByPlaceholder('Name').fill('Hello')
	await expect.element(screen.getByPlaceholder('Name')).toHaveValue('Hello')
})

test('password input is hidden by default', async () => {
	const screen = await render(Input, { type: 'password', placeholder: 'Password' })
	const input = screen.getByPlaceholder('Password')
	await expect.element(input).toHaveAttribute('type', 'password')
})

test('password toggle button reveals the password', async () => {
	const screen = await render(Input, { type: 'password', placeholder: 'Secret' })
	const toggle = screen.getByRole('button')
	await toggle.click()
	const input = screen.getByPlaceholder('Secret')
	await expect.element(input).toHaveAttribute('type', 'text')
})

test('clicking toggle again re-hides the password', async () => {
	const screen = await render(Input, { type: 'password', placeholder: 'Secret' })
	const toggle = screen.getByRole('button')
	await toggle.click()
	await toggle.click()
	const input = screen.getByPlaceholder('Secret')
	await expect.element(input).toHaveAttribute('type', 'password')
})

test('disabled input has disabled attribute', async () => {
	const screen = await render(Input, { disabled: true, placeholder: 'Locked' })
	await expect.element(screen.getByPlaceholder('Locked')).toBeDisabled()
})
