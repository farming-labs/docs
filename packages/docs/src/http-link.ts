export interface ParsedHttpLinkValue {
  href: string;
  relations: string[];
}

export interface HttpLinkExpectation {
  href: string;
  rel: string;
}

/** Split an HTTP list without treating delimiters inside quotes or URI references as separators. */
export function splitHttpList(value: string, delimiter: "," | ";"): string[] {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  let angleDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quoted && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && character === "<") angleDepth += 1;
    if (!quoted && character === ">" && angleDepth > 0) angleDepth -= 1;
    if (!quoted && angleDepth === 0 && character === delimiter) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

export function unquoteHttpValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  return trimmed.slice(1, -1).replace(/\\(.)/g, "$1");
}

/** Parse Link header values while preserving the target/relation association. */
export function parseHttpLinkHeader(header: string | null | undefined): ParsedHttpLinkValue[] {
  if (!header) return [];

  const links: ParsedHttpLinkValue[] = [];
  for (const value of splitHttpList(header, ",")) {
    const target = value.match(/^\s*<([^>]*)>/);
    if (!target) continue;

    const relations: string[] = [];
    for (const rawParameter of splitHttpList(value.slice(target[0].length), ";")) {
      const separator = rawParameter.indexOf("=");
      if (separator < 0 || rawParameter.slice(0, separator).trim().toLowerCase() !== "rel") {
        continue;
      }
      relations.push(
        ...unquoteHttpValue(rawParameter.slice(separator + 1))
          .toLowerCase()
          .split(/\s+/),
      );
    }
    links.push({ href: target[1], relations: relations.filter(Boolean) });
  }

  return links;
}

export function httpLinkMatchesExpectation(
  links: readonly ParsedHttpLinkValue[],
  expectation: HttpLinkExpectation,
  responseUrl: string,
): boolean {
  let expectedUrl: string;
  try {
    expectedUrl = new URL(expectation.href, responseUrl).toString();
  } catch {
    return false;
  }

  return links.some((link) => {
    try {
      return (
        new URL(link.href, responseUrl).toString() === expectedUrl &&
        link.relations.includes(expectation.rel.toLowerCase())
      );
    } catch {
      return false;
    }
  });
}

export function httpLinkHeaderHasTargetRelation(
  header: string | null | undefined,
  href: string,
  rel: string,
  responseUrl: string,
): boolean {
  return httpLinkMatchesExpectation(parseHttpLinkHeader(header), { href, rel }, responseUrl);
}
