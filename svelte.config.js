import adapter from '@sveltejs/adapter-auto';
import path from 'node:path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		alias: {
			'@': path.resolve('./src'),
			'$db': path.resolve('./src/lib/server/db'),
			'$db/*': path.resolve('./src/lib/server/db') + '/*',
		}
	}
};

export default config;
