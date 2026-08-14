import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { DocsOpenApiMcpConfig } from "./types.js";

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isDocsOpenApiMcpPrivateAddress(address: string): boolean {
  const normalized = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/gu, "");
  const family = isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family !== 6) return true;
  const mappedIpv4 = normalized.match(/^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith("ff")
  );
}

async function defaultResolveHost(hostname: string): Promise<readonly string[]> {
  if (isIP(hostname)) return [hostname];
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

export async function validateDocsOpenApiMcpUrl(
  url: URL,
  config: DocsOpenApiMcpConfig,
): Promise<void> {
  if (url.protocol !== "https:" && !(url.protocol === "http:" && config.allowInsecureHttp)) {
    throw new Error("OpenAPI MCP destinations must use HTTPS unless allowInsecureHttp is enabled.");
  }
  if (url.username || url.password) {
    throw new Error("OpenAPI MCP destinations cannot contain URL credentials.");
  }
  if (config.allowPrivateNetwork) return;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error(`OpenAPI MCP blocked private destination: ${hostname}`);
  }
  let addresses: readonly string[];
  try {
    addresses = await (config.resolveHost ?? defaultResolveHost)(hostname);
  } catch {
    throw new Error(`OpenAPI MCP could not safely resolve destination: ${hostname}`);
  }
  if (addresses.length === 0 || addresses.some(isDocsOpenApiMcpPrivateAddress)) {
    throw new Error(`OpenAPI MCP blocked private or unresolved destination: ${hostname}`);
  }
}
