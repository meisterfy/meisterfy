import * as client_hooks from '../../../src/hooks.client.ts';


export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21')
];

export const server_loads = [];

export const dictionary = {
		"/": [5],
		"/login": [9],
		"/settings": [6,[2]],
		"/settings/integrations": [7,[2]],
		"/setup": [8],
		"/[tenant]/ads/google": [16,[3]],
		"/[tenant]/ads/google/live/[campaign_id]": [18,[3]],
		"/[tenant]/ads/google/[filename]": [17,[3]],
		"/[tenant]/alerts": [21,[3]],
		"/[tenant]/reports": [19,[3]],
		"/[tenant]/reports/[slug]": [20,[3]],
		"/[tenant]/schedule": [13,[3]],
		"/[tenant]/settings": [14,[3]],
		"/[tenant]/settings/general": [15,[3]],
		"/[tenant]/social": [10,[3,4]],
		"/[tenant]/social/drafts": [12,[3,4]],
		"/[tenant]/social/[filename]": [11,[3,4]]
	};

export const hooks = {
	handleError: client_hooks.handleError || (({ error }) => { console.error(error) }),
	init: client_hooks.init,
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';