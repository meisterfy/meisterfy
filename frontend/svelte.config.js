import adapter from '@sveltejs/adapter-static'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			pages: '../backend/cmd/server/ui/dist',
			assets: '../backend/cmd/server/ui/dist',
			fallback: '200.html',
			precompress: false
		}),
		paths: {
			relative: false
		}
	}
}

export default config
