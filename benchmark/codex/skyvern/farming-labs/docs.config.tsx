import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme/default";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s | Skyvern Docs Benchmark",
    description: "Skyvern docs mirrored into Farming Labs/docs with agent-optimized runbooks.",
  },
  llmsTxt: {
    enabled: true,
  },
  mcp: {
    enabled: true,
  },
  feedback: {
    enabled: true,
    agent: true,
  },
  pageActions: {
    copyMarkdown: true,
    openDocs: {
      providers: ["chatgpt", "claude"],
    },
  },
});
