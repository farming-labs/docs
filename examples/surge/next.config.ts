import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

const repoRoot = path.resolve(process.cwd(), "../..");

export default withDocs({
  distDir: process.env.NODE_ENV === "production" && !process.env.VERCEL ? ".next-build" : ".next",
  turbopack: {
    root: repoRoot,
  },
});
