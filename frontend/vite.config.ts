import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'baseLocale']
		})
	],
	server: {
		proxy: {
			'^/(admin|auth|setup|health|mcp|ai)': 'http://localhost:8181'
		}
	},
	optimizeDeps: {
		include: ['marked']
	},
	test: {
		expect: { requireAssertions: true },
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/lib/**'],
			exclude: ['src/lib/paraglide/**', 'src/lib/vitest-examples/**', 'src/lib/**/*.d.ts'],
			thresholds: {
				'src/lib/api/**': {
					lines: 70,
					functions: 65
				}
			}
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: []
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
})
