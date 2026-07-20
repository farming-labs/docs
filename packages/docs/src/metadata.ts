import type {
  DocsConfig,
  DocsMetadata,
  OGConfig,
  PageFrontmatter,
  PageAgentFrontmatter,
  PageOpenGraph,
  PageTwitter,
} from "./types.js";
import { hasStructuredPageAgentContract, normalizePageAgentFrontmatter } from "./agent-contract.js";

export interface DocsStructuredDataBreadcrumb {
  name: string;
  url: string;
}

export interface DocsPageStructuredDataInput {
  title: string;
  description?: string;
  url: string;
  baseUrl?: string;
  entry?: string;
  dateModified?: string;
  breadcrumbs?: DocsStructuredDataBreadcrumb[];
  /** Optional actionable page contract represented as a Schema.org HowTo. */
  agent?: PageAgentFrontmatter;
}

/**
 * Resolve page title using metadata titleTemplate.
 * %s is replaced with page title.
 */
export function resolveTitle(pageTitle: string, metadata?: DocsMetadata): string {
  const template = metadata?.titleTemplate ?? "%s";
  return template.replace("%s", pageTitle);
}

/**
 * Resolve OG image URL for a page.
 * Prefers page.openGraph.images[0], then page.ogImage, then config endpoint/default.
 */
export function resolveOGImage(
  page: PageFrontmatter,
  ogConfig?: OGConfig,
  baseUrl?: string,
): string | undefined {
  if (page.openGraph?.images?.length) {
    return resolveImageUrl(page.openGraph.images[0].url, baseUrl);
  }
  if (!ogConfig?.enabled) return undefined;

  if (page.ogImage) {
    return resolveImageUrl(page.ogImage, baseUrl);
  }

  if (ogConfig.type === "dynamic" && ogConfig.endpoint) {
    return `${baseUrl ?? ""}${ogConfig.endpoint}`;
  }

  return ogConfig.defaultImage;
}

function resolveImageUrl(url: string, baseUrl?: string): string {
  if (url.startsWith("/") || url.startsWith("http")) return url;
  const base = baseUrl ?? "";
  const sep = base.length > 0 && !base.endsWith("/") ? "/" : "";
  return `${base}${sep}${url}`;
}

/**
 * Build the Open Graph metadata object for a page.
 * When the page has openGraph in frontmatter, uses it (with title/description filled from page if omitted).
 * Otherwise uses ogImage or config (dynamic endpoint / defaultImage).
 */
export function buildPageOpenGraph(
  page: Pick<PageFrontmatter, "title" | "description" | "ogImage" | "openGraph">,
  ogConfig?: OGConfig,
  baseUrl?: string,
): PageOpenGraph | undefined {
  if (page.openGraph) {
    const images = page.openGraph.images?.length
      ? page.openGraph.images.map((img) => ({
          url: resolveImageUrl(img.url, baseUrl),
          width: img.width ?? 1200,
          height: img.height ?? 630,
        }))
      : undefined;
    return {
      title: page.openGraph.title ?? page.title,
      description: page.openGraph.description ?? page.description,
      ...(images && { images }),
    };
  }
  const url = resolveOGImage(page as PageFrontmatter, ogConfig, baseUrl);
  if (!url) return undefined;
  return {
    title: page.title,
    ...(page.description && { description: page.description }),
    images: [{ url, width: 1200, height: 630 }],
  };
}

/**
 * Build the Twitter card metadata object for a page.
 * When the page has twitter in frontmatter, uses it.
 * Otherwise builds from ogImage or config (dynamic endpoint).
 */
export function buildPageTwitter(
  page: Pick<PageFrontmatter, "title" | "description" | "ogImage" | "openGraph" | "twitter">,
  ogConfig?: OGConfig,
  baseUrl?: string,
): PageTwitter | undefined {
  if (page.twitter) {
    const images = page.twitter.images?.length
      ? page.twitter.images.map((url) => resolveImageUrl(url, baseUrl))
      : undefined;
    return {
      ...(page.twitter.card && { card: page.twitter.card }),
      ...(page.twitter.title !== undefined && { title: page.twitter.title }),
      ...(page.twitter.description !== undefined && { description: page.twitter.description }),
      ...(images && { images }),
    };
  }
  const url = resolveOGImage(page as PageFrontmatter, ogConfig, baseUrl);
  if (!url) return undefined;
  return {
    card: "summary_large_image",
    title: page.title,
    ...(page.description && { description: page.description }),
    images: [url],
  };
}

function normalizeBaseUrl(value?: string): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function absolutizeUrl(url: string, baseUrl?: string): string {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return url;

  try {
    return new URL(url, `${base}/`).toString();
  } catch {
    return url;
  }
}

function titleFromSegment(segment: string): string {
  return segment
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeRoutePath(url: string): string {
  try {
    const parsed = new URL(url, "https://farming-labs.local");
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return `/${url.replace(/^\/+/, "")}`.replace(/\/+$/, "") || "/";
  }
}

function buildDefaultBreadcrumbs(
  input: DocsPageStructuredDataInput,
): DocsStructuredDataBreadcrumb[] {
  const routePath = normalizeRoutePath(input.url);
  const entry = (input.entry ?? "docs").replace(/^\/+|\/+$/g, "") || "docs";
  const segments = routePath.split("/").filter(Boolean);
  const entryParts = entry.split("/").filter(Boolean);
  const contentSegments =
    segments.slice(0, entryParts.length).join("/") === entryParts.join("/")
      ? segments.slice(entryParts.length)
      : segments;

  const breadcrumbs: DocsStructuredDataBreadcrumb[] = [
    {
      name: titleFromSegment(entryParts[entryParts.length - 1] ?? "Docs"),
      url: `/${entry}`,
    },
  ];

  let current = `/${entry}`;
  contentSegments.forEach((segment, index) => {
    current = `${current}/${segment}`.replace(/\/+/g, "/");
    breadcrumbs.push({
      name: index === contentSegments.length - 1 ? input.title : titleFromSegment(segment),
      url: current,
    });
  });

  return breadcrumbs;
}

function normalizeDateModified(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function buildAgentContractHowTo(
  value: unknown,
  fallback: { title: string; description?: string },
): Record<string, unknown> | undefined {
  const agent = normalizePageAgentFrontmatter(value);
  if (!agent || !hasStructuredPageAgentContract(agent)) return undefined;

  const steps: Array<Record<string, unknown>> = [];
  for (const command of agent.commands ?? []) {
    const run = typeof command === "string" ? command : command.run;
    const description = typeof command === "string" ? undefined : command.description;
    const cwd = typeof command === "string" ? undefined : command.cwd;
    steps.push({
      "@type": "HowToStep",
      position: steps.length + 1,
      name: description ?? "Run command",
      text: cwd ? `${run} (from ${cwd})` : run,
    });
  }
  for (const verification of agent.verification ?? []) {
    const description =
      typeof verification === "string"
        ? verification
        : (verification.description ?? "Verify the result");
    const details =
      typeof verification === "string"
        ? verification
        : [verification.run, verification.expect ? `Expected: ${verification.expect}` : undefined]
            .filter(Boolean)
            .join(". ");
    steps.push({
      "@type": "HowToStep",
      position: steps.length + 1,
      name: description,
      text: details || description,
    });
  }

  const supplies = [
    ...(agent.prerequisites ?? []).map((name) => ({
      "@type": "HowToSupply",
      name,
    })),
    ...(agent.files ?? []).map((name) => ({
      "@type": "HowToSupply",
      name,
    })),
  ];
  const about = Object.entries(agent.appliesTo ?? {}).flatMap(([kind, values]) =>
    (typeof values === "string" ? [values] : (values ?? [])).map((name: string) => ({
      "@type": "Thing",
      name: `${kind}: ${name}`,
    })),
  );

  return {
    "@type": "HowTo",
    name: agent.task ?? fallback.title,
    ...((agent.outcome ?? fallback.description)
      ? { description: agent.outcome ?? fallback.description }
      : {}),
    ...(about.length > 0 ? { about } : {}),
    ...(supplies.length > 0 ? { supply: supplies } : {}),
    ...(steps.length > 0 ? { step: steps } : {}),
  };
}

/**
 * Resolve the public docs site URL from existing agent-facing config.
 *
 * The framework intentionally reuses `sitemap.baseUrl`, `llmsTxt.baseUrl`,
 * `robots.baseUrl`, or `ai.docsUrl` instead of requiring another setting.
 */
export function resolveDocsMetadataBaseUrl(config: DocsConfig): string | undefined {
  const sitemapBaseUrl = typeof config.sitemap === "object" ? config.sitemap.baseUrl : undefined;
  const llmsBaseUrl = typeof config.llmsTxt === "object" ? config.llmsTxt.baseUrl : undefined;
  const robotsBaseUrl = typeof config.robots === "object" ? config.robots.baseUrl : undefined;
  return [sitemapBaseUrl, llmsBaseUrl, robotsBaseUrl, config.ai?.docsUrl]
    .map((value) => normalizeBaseUrl(value))
    .find((value): value is string => Boolean(value));
}

/**
 * Build Schema.org JSON-LD for a docs page.
 *
 * The shape follows Vercel's agent readability guidance: a `TechArticle`
 * with title, description, canonical URL, freshness, and breadcrumbs.
 */
export function buildDocsPageStructuredData(input: DocsPageStructuredDataInput) {
  const breadcrumbs = input.breadcrumbs?.length
    ? input.breadcrumbs
    : buildDefaultBreadcrumbs(input);

  const result: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: input.title,
    name: input.title,
    url: absolutizeUrl(input.url, input.baseUrl),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absolutizeUrl(input.url, input.baseUrl),
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absolutizeUrl(item.url, input.baseUrl),
      })),
    },
  };

  if (input.description) result.description = input.description;

  const agentContract = buildAgentContractHowTo(input.agent, input);
  if (agentContract) result.mainEntity = agentContract;

  const dateModified = normalizeDateModified(input.dateModified);
  if (dateModified) result.dateModified = dateModified;

  return result;
}

/**
 * Serialize Schema.org JSON-LD for safe insertion into a `<script>` tag.
 */
export function renderDocsPageStructuredDataJson(input: DocsPageStructuredDataInput): string {
  return JSON.stringify(buildDocsPageStructuredData(input)).replace(/</g, "\\u003c");
}
