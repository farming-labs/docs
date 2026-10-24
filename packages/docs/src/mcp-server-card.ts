import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/server";
import { createDocsCacheableResponse } from "./http-cache.js";

/**
 * MCP server cards (SEP-2127): a small JSON document served at
 * `<streamable-http-url>/server-card` that names the server and its endpoint, so a
 * client can discover it from the URL alone. The card carries identity only, never
 * tools or resources, so it reveals nothing the endpoint does not already answer.
 */
export const DOCS_MCP_SERVER_CARD_SUFFIX = "/server-card";

const SERVER_CARD_SCHEMA =
  "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";
const SERVER_CARD_CONTENT_TYPE = "application/mcp-server-card+json; charset=utf-8";
// The card schema's limit on `description`.
const CARD_DESCRIPTION_MAX = 100;
const REVERSE_DNS_NAME = /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/;

export interface DocsMcpServerCard {
  $schema: string;
  name: string;
  version: string;
  description: string;
  title?: string;
  websiteUrl?: string;
  remotes: Array<{
    type: "streamable-http";
    url: string;
    supportedProtocolVersions: string[];
  }>;
}

export interface CreateDocsMcpServerCardOptions {
  /** Absolute URL of the Streamable HTTP endpoint the card describes. */
  endpointUrl: string;
  /** The MCP server name reported in `serverInfo`. */
  name: string;
  /** The MCP server version reported in `serverInfo`. */
  version: string;
  /** What the server offers; the card keeps the first 100 characters. */
  description?: string;
  /** Documentation site the server reads from. */
  websiteUrl?: string;
}

function cardNamespace(host: string): string {
  // An IP address or bracketed IPv6 host is not a domain to reverse.
  if (host.includes(":") || /^\d+(?:\.\d+){3}$/.test(host)) return "local";
  return host.split(".").reverse().join(".");
}

function truncateDescription(text: string): string {
  return text.length <= CARD_DESCRIPTION_MAX
    ? text
    : `${text.slice(0, CARD_DESCRIPTION_MAX - 1).trimEnd()}…`;
}

/**
 * Build the server card for a docs MCP endpoint. The card's `name` must be
 * reverse-DNS, so a plain server name such as a site title becomes the
 * card's `title` and the name is namespaced by the endpoint's host.
 */
export function createDocsMcpServerCard(
  options: CreateDocsMcpServerCardOptions,
): DocsMcpServerCard {
  const endpoint = new URL(options.endpointUrl);
  const reverseDns = REVERSE_DNS_NAME.test(options.name);
  const description = truncateDescription(
    options.description?.trim() || `Search and read the ${options.name} documentation.`,
  );
  return {
    $schema: SERVER_CARD_SCHEMA,
    name: reverseDns ? options.name : `${cardNamespace(endpoint.hostname)}/docs`,
    version: options.version,
    description,
    ...(reverseDns ? {} : { title: options.name }),
    ...(options.websiteUrl ? { websiteUrl: options.websiteUrl } : {}),
    remotes: [
      {
        type: "streamable-http",
        url: endpoint.href,
        supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
      },
    ],
  };
}

const SERVER_CARD_CORS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-None-Match",
});

/**
 * Answer a request for a server card: public, read-only metadata with CORS for
 * any origin and an ETag. The body names the request's origin, so caches
 * revalidate instead of reusing it.
 */
export function createDocsMcpServerCardResponse(
  request: Request,
  card: DocsMcpServerCard,
): Response {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: SERVER_CARD_CORS_HEADERS });
  }
  if (method !== "GET" && method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        ...SERVER_CARD_CORS_HEADERS,
        Allow: "GET, HEAD, OPTIONS",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
  return createDocsCacheableResponse({
    request,
    content: JSON.stringify(card),
    headers: {
      ...SERVER_CARD_CORS_HEADERS,
      "Content-Type": SERVER_CARD_CONTENT_TYPE,
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
