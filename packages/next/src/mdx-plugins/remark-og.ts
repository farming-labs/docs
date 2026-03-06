/**
 * Remark plugin that augments frontmatter with Open Graph metadata.
 *
 * Runs between remark-frontmatter and remark-mdx-frontmatter.
 * Reads title/description from the YAML node and appends openGraph + twitter
 * fields so that remark-mdx-frontmatter exports them as part of `metadata`.
 *
 * Skips injection when frontmatter already has `openGraph:` or `ogImage:`, so
 * pages can use static OG images from frontmatter instead of the dynamic endpoint.
 */

interface RemarkOgOptions {
  endpoint?: string;
}

function extractField(yaml: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(?:"([^"]*?)"|'([^']*?)'|(.+?))\\s*$`, "m");
  const m = yaml.match(re);
  return m?.[1] ?? m?.[2] ?? m?.[3];
}

/** True if the YAML already defines openGraph or ogImage (static OG). */
function hasStaticOg(yaml: string): boolean {
  return /^\s*openGraph\s*:/m.test(yaml) || /^\s*ogImage\s*:/m.test(yaml);
}

export default function remarkOg(options: RemarkOgOptions = {}) {
  const { endpoint = "/api/og" } = options;

  return (tree: { children: Array<{ type: string; value: string }> }) => {
    const yamlNode = tree.children.find((n) => n.type === "yaml");
    if (!yamlNode) return;

    if (hasStaticOg(yamlNode.value)) return;

    const title = extractField(yamlNode.value, "title");
    if (!title) return;

    const description = extractField(yamlNode.value, "description");
    const params = new URLSearchParams({ title });
    if (description) params.set("description", description);

    const ogUrl = `${endpoint}?${params.toString()}`;

    yamlNode.value +=
      `\nopenGraph:` +
      `\n  images:` +
      `\n    - url: "${ogUrl}"` +
      `\n      width: 1200` +
      `\n      height: 630` +
      `\ntwitter:` +
      `\n  card: "summary_large_image"` +
      `\n  images:` +
      `\n    - "${ogUrl}"`;
  };
}
