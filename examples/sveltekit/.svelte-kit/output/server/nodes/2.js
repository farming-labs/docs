import * as server from '../entries/pages/docs/_layout.server.js';

export const index = 2;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/docs/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/docs/+layout.server.js";
export const imports = ["_app/immutable/nodes/2.B9gjVRvd.js","_app/immutable/chunks/BVoj8vGL.js","_app/immutable/chunks/D-GgqtQO.js","_app/immutable/chunks/MG1D6kW9.js","_app/immutable/chunks/BVZwaBIl.js","_app/immutable/chunks/DT0OoDi0.js","_app/immutable/chunks/DzywazqE.js","_app/immutable/chunks/aCuBA-jg.js","_app/immutable/chunks/B7Q7N9RP.js","_app/immutable/chunks/Gx5tdX3N.js"];
export const stylesheets = [];
export const fonts = [];
