

export const index = 3;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_page.svelte.js')).default;
export const imports = ["_app/immutable/nodes/3.D5ME1Yz_.js","_app/immutable/chunks/BVoj8vGL.js","_app/immutable/chunks/D-GgqtQO.js","_app/immutable/chunks/VDpXBhJE.js"];
export const stylesheets = ["_app/immutable/assets/3.B3yPjmqD.css"];
export const fonts = [];
