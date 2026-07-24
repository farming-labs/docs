import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

const repoRoot = path.resolve(process.cwd(), "..");

export default withDocs({
  async headers() {
    return [
      {
        source: "/schema/agent-manifest.v1.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/schema+json; charset=utf-8",
          },
        ],
      },
    ];
  },
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
