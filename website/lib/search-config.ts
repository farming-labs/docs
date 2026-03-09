export type DocsSearchType = "local" | "remote";

export interface DocsSearchConfig {
  type: DocsSearchType;
  endpoint?: string;
  apiKey?: string;
}

// Read from NEXT_PUBLIC_* so it is safe on the client.
const rawType = (process.env.NEXT_PUBLIC_DOCS_SEARCH_TYPE as DocsSearchType | undefined) ?? "local";

export const docsSearchConfig: DocsSearchConfig = {
  type: rawType === "remote" ? "remote" : "local",
  endpoint: process.env.NEXT_PUBLIC_DOCS_SEARCH_ENDPOINT,
  apiKey: process.env.NEXT_PUBLIC_DOCS_SEARCH_API_KEY,
};

