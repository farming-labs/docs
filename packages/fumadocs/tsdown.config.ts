import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/**/*.{ts,tsx}"],
  format: "esm",
  unbundle: true,
  dts: true,
  clean: true,
  outDir: "dist",
});
