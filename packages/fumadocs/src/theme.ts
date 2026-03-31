/**
 * @deprecated — Import theme presets from sub-paths instead:
 *   `@farming-labs/theme/default`   → fumadocs()
 *   `@farming-labs/theme/darksharp` → darksharp()
 *   `@farming-labs/theme/concrete`  → concrete()
 *   `@farming-labs/theme/monolith`  → monolith()
 *
 * This file re-exports from `./default` for backward compatibility.
 */

export { fumadocs, DefaultUIDefaults as FumadocsUIDefaults } from "./default/index.js";
