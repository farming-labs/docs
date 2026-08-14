import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

const repoRoot = path.resolve(process.cwd(), "../..");

export default withDocs({
  distDir: process.env.NODE_ENV === "production" && !process.env.VERCEL ? ".next-build" : ".next",
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  turbopack: {
    root: repoRoot,
  },
});
