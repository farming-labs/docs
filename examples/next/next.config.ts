import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

export default withDocs({
  // Keep local dev on `.next`, but build/start on a separate directory so
  // workspace builds don't fail when example dev is already running.
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
  turbopack: {
    // Resolve linked workspace packages from the repo root even when a parent
    // directory also has a lockfile and Turbopack guesses the wrong root.
    root: path.resolve(process.cwd(), "../.."),
    resolveAlias: {
      "@farming-labs/docs": "./packages/docs/dist/index.mjs",
    },
  },
});
