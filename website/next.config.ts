import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

const repoRoot = path.resolve(process.cwd(), "..");

export default withDocs({
  turbopack: {
    root: repoRoot,
  },
  outputFileTracingIncludes: {
    "/api/agent-score": ["../node_modules/.pnpm/afdocs@*/node_modules/afdocs/package.json"],
    "/api/agent-score/leaderboard": [
      "../node_modules/.pnpm/afdocs@*/node_modules/afdocs/package.json",
    ],
  },
});
