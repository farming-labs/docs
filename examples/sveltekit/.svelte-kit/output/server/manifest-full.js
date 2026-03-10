export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.CO5KxfR1.js",app:"_app/immutable/entry/app.CSDp3ydD.js",imports:["_app/immutable/entry/start.CO5KxfR1.js","_app/immutable/chunks/BKoKeb-V.js","_app/immutable/chunks/D-GgqtQO.js","_app/immutable/chunks/DzywazqE.js","_app/immutable/entry/app.CSDp3ydD.js","_app/immutable/chunks/D-GgqtQO.js","_app/immutable/chunks/aCuBA-jg.js","_app/immutable/chunks/BVoj8vGL.js","_app/immutable/chunks/DzywazqE.js","_app/immutable/chunks/B7Q7N9RP.js","_app/immutable/chunks/BVZwaBIl.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/api/docs",
				pattern: /^\/api\/docs\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/docs/_server.js'))
			},
			{
				id: "/docs/[...slug]",
				pattern: /^\/docs(?:\/([^]*))?\/?$/,
				params: [{"name":"slug","optional":false,"rest":true,"chained":true}],
				page: { layouts: [0,2,], errors: [1,,], leaf: 4 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
