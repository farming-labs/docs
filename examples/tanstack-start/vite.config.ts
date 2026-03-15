import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { docsMdx } from "../../packages/tanstack-start/src/vite";

export default defineConfig({
  plugins: [tailwindcss(), docsMdx(), tsconfigPaths({ ignoreConfigErrors: true }), tanstackStart()],
});
