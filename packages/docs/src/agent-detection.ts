export const DOCS_AI_AGENT_USER_AGENT_PATTERNS = [
  "claudebot",
  "claude-searchbot",
  "claude-user",
  "anthropic-ai",
  "claude-web",
  "chatgpt",
  "gptbot",
  "oai-searchbot",
  "openai",
  "gemini",
  "bard",
  "google-cloudvertexbot",
  "google-extended",
  "meta-externalagent",
  "meta-externalfetcher",
  "meta-webindexer",
  "perplexity",
  "youbot",
  "you.com",
  "deepseekbot",
  "cursor",
  "github-copilot",
  "codeium",
  "tabnine",
  "sourcegraph",
  "cohere-ai",
  "bytespider",
  "amazonbot",
  "ai2bot",
  "diffbot",
  "omgili",
  "omgilibot",
] as const;
export const DOCS_TRADITIONAL_BOT_USER_AGENT_PATTERNS = [
  "googlebot",
  "bingbot",
  "yandexbot",
  "baiduspider",
  "duckduckbot",
  "slurp",
  "msnbot",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "pingdom",
  "uptimerobot",
  "newrelic",
  "datadog",
  "statuspage",
  "site24x7",
  "applebot",
] as const;
export const DOCS_BOT_LIKE_USER_AGENT_PATTERN = /bot|agent|fetch|crawl|spider|search/i;
const DOCS_BOT_LIKE_USER_AGENT_TERMS = ["bot", "agent", "fetch", "crawl", "spider", "search"];
export const DOCS_AI_AGENT_USER_AGENT_HEADER_PATTERN = buildDocsUserAgentHeaderPattern(
  DOCS_AI_AGENT_USER_AGENT_PATTERNS,
);
export const DOCS_TRADITIONAL_BOT_USER_AGENT_HEADER_PATTERN = buildDocsUserAgentHeaderPattern(
  DOCS_TRADITIONAL_BOT_USER_AGENT_PATTERNS,
);
export const DOCS_BOT_LIKE_USER_AGENT_HEADER_PATTERN = buildDocsUserAgentHeaderPattern(
  DOCS_BOT_LIKE_USER_AGENT_TERMS,
);

function buildDocsUserAgentHeaderPattern(patterns: readonly string[]): string {
  return `.*(?:${patterns.map(toCaseInsensitiveHeaderPattern).join("|")}).*`;
}

function toCaseInsensitiveHeaderPattern(value: string): string {
  return value
    .split("")
    .map((char) => {
      if (/^[a-z]$/i.test(char)) return `[${char.toLowerCase()}${char.toUpperCase()}]`;
      return escapeRegex(char);
    })
    .join("");
}

function escapeRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
