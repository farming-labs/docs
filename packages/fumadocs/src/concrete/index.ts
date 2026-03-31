/**
 * Concrete theme preset.
 * Hard edges, strong borders, and high-contrast typography.
 *
 * CSS: `@import "@farming-labs/theme/concrete/css";`
 */
import { createTheme } from "@farming-labs/docs";
import { HardlineUIDefaults } from "../hardline/index.js";

export const concrete = createTheme({
  name: "concrete",
  ui: HardlineUIDefaults,
});

export { HardlineUIDefaults as ConcreteUIDefaults };
