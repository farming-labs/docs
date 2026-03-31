import { createTheme } from "@farming-labs/docs";
import { HardlineUIDefaults } from "./hardline.js";

export const concrete = createTheme({
  name: "concrete",
  ui: HardlineUIDefaults,
});

export { HardlineUIDefaults as ConcreteUIDefaults };
