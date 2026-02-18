
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
	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/search" | "/docs" | "/docs/concepts" | "/docs/concepts/database" | "/docs/concepts/session-management" | "/docs/get-started" | "/docs/installation" | "/docs/[...slug]";
		RouteParams(): {
			"/docs/[...slug]": { slug: string }
		};
		LayoutParams(): {
			"/": { slug?: string };
			"/api": Record<string, never>;
			"/api/search": Record<string, never>;
			"/docs": { slug?: string };
			"/docs/concepts": Record<string, never>;
			"/docs/concepts/database": Record<string, never>;
			"/docs/concepts/session-management": Record<string, never>;
			"/docs/get-started": Record<string, never>;
			"/docs/installation": Record<string, never>;
			"/docs/[...slug]": { slug: string }
		};
		Pathname(): "/" | "/api/search" | "/docs" | `/docs/${string}` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}