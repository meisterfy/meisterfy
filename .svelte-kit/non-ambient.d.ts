
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/ads" | "/api/ads/google" | "/api/ads/google/[client_id]" | "/api/ads/google/[client_id]/import" | "/api/ads/google/[client_id]/live" | "/api/ads/google/[client_id]/live/[campaign_id]" | "/api/ads/google/[client_id]/live/[campaign_id]/export" | "/api/ads/google/[client_id]/[filename]" | "/api/ads/google/[client_id]/[filename]/deploy" | "/api/ads/google/[client_id]/[filename]/status" | "/api/alerts" | "/api/alerts/[client_id]" | "/api/auth" | "/api/auth/google-ads" | "/api/auth/google-ads/callback" | "/api/media" | "/api/media/[client_id]" | "/api/media/[client_id]/[filename]" | "/api/posts" | "/api/posts/[client_id]" | "/api/posts/[client_id]/import" | "/api/posts/[client_id]/[filename]" | "/api/posts/[client_id]/[filename]/media" | "/api/posts/[client_id]/[filename]/status" | "/login" | "/mcp" | "/settings" | "/settings/integrations" | "/setup" | "/[tenant]" | "/[tenant]/ads" | "/[tenant]/ads/google" | "/[tenant]/ads/google/live" | "/[tenant]/ads/google/live/[campaign_id]" | "/[tenant]/ads/google/[filename]" | "/[tenant]/alerts" | "/[tenant]/reports" | "/[tenant]/reports/[slug]" | "/[tenant]/schedule" | "/[tenant]/settings" | "/[tenant]/settings/general" | "/[tenant]/social" | "/[tenant]/social/drafts" | "/[tenant]/social/[filename]";
		RouteParams(): {
			"/api/ads/google/[client_id]": { client_id: string };
			"/api/ads/google/[client_id]/import": { client_id: string };
			"/api/ads/google/[client_id]/live": { client_id: string };
			"/api/ads/google/[client_id]/live/[campaign_id]": { client_id: string; campaign_id: string };
			"/api/ads/google/[client_id]/live/[campaign_id]/export": { client_id: string; campaign_id: string };
			"/api/ads/google/[client_id]/[filename]": { client_id: string; filename: string };
			"/api/ads/google/[client_id]/[filename]/deploy": { client_id: string; filename: string };
			"/api/ads/google/[client_id]/[filename]/status": { client_id: string; filename: string };
			"/api/alerts/[client_id]": { client_id: string };
			"/api/media/[client_id]": { client_id: string };
			"/api/media/[client_id]/[filename]": { client_id: string; filename: string };
			"/api/posts/[client_id]": { client_id: string };
			"/api/posts/[client_id]/import": { client_id: string };
			"/api/posts/[client_id]/[filename]": { client_id: string; filename: string };
			"/api/posts/[client_id]/[filename]/media": { client_id: string; filename: string };
			"/api/posts/[client_id]/[filename]/status": { client_id: string; filename: string };
			"/[tenant]": { tenant: string };
			"/[tenant]/ads": { tenant: string };
			"/[tenant]/ads/google": { tenant: string };
			"/[tenant]/ads/google/live": { tenant: string };
			"/[tenant]/ads/google/live/[campaign_id]": { tenant: string; campaign_id: string };
			"/[tenant]/ads/google/[filename]": { tenant: string; filename: string };
			"/[tenant]/alerts": { tenant: string };
			"/[tenant]/reports": { tenant: string };
			"/[tenant]/reports/[slug]": { tenant: string; slug: string };
			"/[tenant]/schedule": { tenant: string };
			"/[tenant]/settings": { tenant: string };
			"/[tenant]/settings/general": { tenant: string };
			"/[tenant]/social": { tenant: string };
			"/[tenant]/social/drafts": { tenant: string };
			"/[tenant]/social/[filename]": { tenant: string; filename: string }
		};
		LayoutParams(): {
			"/": { client_id?: string; campaign_id?: string; filename?: string; tenant?: string; slug?: string };
			"/api": { client_id?: string; campaign_id?: string; filename?: string };
			"/api/ads": { client_id?: string; campaign_id?: string; filename?: string };
			"/api/ads/google": { client_id?: string; campaign_id?: string; filename?: string };
			"/api/ads/google/[client_id]": { client_id: string; campaign_id?: string; filename?: string };
			"/api/ads/google/[client_id]/import": { client_id: string };
			"/api/ads/google/[client_id]/live": { client_id: string; campaign_id?: string };
			"/api/ads/google/[client_id]/live/[campaign_id]": { client_id: string; campaign_id: string };
			"/api/ads/google/[client_id]/live/[campaign_id]/export": { client_id: string; campaign_id: string };
			"/api/ads/google/[client_id]/[filename]": { client_id: string; filename: string };
			"/api/ads/google/[client_id]/[filename]/deploy": { client_id: string; filename: string };
			"/api/ads/google/[client_id]/[filename]/status": { client_id: string; filename: string };
			"/api/alerts": { client_id?: string };
			"/api/alerts/[client_id]": { client_id: string };
			"/api/auth": Record<string, never>;
			"/api/auth/google-ads": Record<string, never>;
			"/api/auth/google-ads/callback": Record<string, never>;
			"/api/media": { client_id?: string; filename?: string };
			"/api/media/[client_id]": { client_id: string; filename?: string };
			"/api/media/[client_id]/[filename]": { client_id: string; filename: string };
			"/api/posts": { client_id?: string; filename?: string };
			"/api/posts/[client_id]": { client_id: string; filename?: string };
			"/api/posts/[client_id]/import": { client_id: string };
			"/api/posts/[client_id]/[filename]": { client_id: string; filename: string };
			"/api/posts/[client_id]/[filename]/media": { client_id: string; filename: string };
			"/api/posts/[client_id]/[filename]/status": { client_id: string; filename: string };
			"/login": Record<string, never>;
			"/mcp": Record<string, never>;
			"/settings": Record<string, never>;
			"/settings/integrations": Record<string, never>;
			"/setup": Record<string, never>;
			"/[tenant]": { tenant: string; campaign_id?: string; filename?: string; slug?: string };
			"/[tenant]/ads": { tenant: string; campaign_id?: string; filename?: string };
			"/[tenant]/ads/google": { tenant: string; campaign_id?: string; filename?: string };
			"/[tenant]/ads/google/live": { tenant: string; campaign_id?: string };
			"/[tenant]/ads/google/live/[campaign_id]": { tenant: string; campaign_id: string };
			"/[tenant]/ads/google/[filename]": { tenant: string; filename: string };
			"/[tenant]/alerts": { tenant: string };
			"/[tenant]/reports": { tenant: string; slug?: string };
			"/[tenant]/reports/[slug]": { tenant: string; slug: string };
			"/[tenant]/schedule": { tenant: string };
			"/[tenant]/settings": { tenant: string };
			"/[tenant]/settings/general": { tenant: string };
			"/[tenant]/social": { tenant: string; filename?: string };
			"/[tenant]/social/drafts": { tenant: string };
			"/[tenant]/social/[filename]": { tenant: string; filename: string }
		};
		Pathname(): "/" | `/api/ads/google/${string}/import` & {} | `/api/ads/google/${string}/live/${string}/export` & {} | `/api/ads/google/${string}/${string}/deploy` & {} | `/api/ads/google/${string}/${string}/status` & {} | `/api/alerts/${string}` & {} | "/api/auth/google-ads" | "/api/auth/google-ads/callback" | `/api/media/${string}/${string}` & {} | `/api/posts/${string}/import` & {} | `/api/posts/${string}/${string}` & {} | `/api/posts/${string}/${string}/media` & {} | `/api/posts/${string}/${string}/status` & {} | "/login" | "/mcp" | "/settings" | "/settings/integrations" | "/setup" | `/${string}/ads/google` & {} | `/${string}/ads/google/live/${string}` & {} | `/${string}/ads/google/${string}` & {} | `/${string}/alerts` & {} | `/${string}/reports` & {} | `/${string}/reports/${string}` & {} | `/${string}/schedule` & {} | `/${string}/settings` & {} | `/${string}/settings/general` & {} | `/${string}/social` & {} | `/${string}/social/drafts` & {} | `/${string}/social/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/robots.txt" | string & {};
	}
}