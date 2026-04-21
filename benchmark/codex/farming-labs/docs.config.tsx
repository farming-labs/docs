import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme/default";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s | Northstar CRM Developer Docs",
    description: "Benchmark docs for the Northstar CRM support-agent prompting contract.",
  },
  mcp: {
    enabled: true,
  },
  llmsTxt: {
    enabled: true,
  },
  pageActions: {
    copyMarkdown: true,
    openDocs: {
      providers: ["chatgpt", "claude"],
    },
  },
  feedback: {
    enabled: true,
    agent: true,
  },
});
