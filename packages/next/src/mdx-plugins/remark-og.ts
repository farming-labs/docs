/**
 * Remark plugin that augments frontmatter with Open Graph metadata.
 *
 * Runs between remark-frontmatter and remark-mdx-frontmatter.
 * Reads title/description from the YAML node and appends openGraph + twitter
 * fields so that remark-mdx-frontmatter exports them as part of `metadata`.
 */

interface RemarkOgOptions {
  endpoint?: string;
}

function extractField(yaml: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:\\s*(?:"([^"]*?)"|'([^']*?)'|(.+?))\\s*$`, "m");
  const m = yaml.match(re);
  return m?.[1] ?? m?.[2] ?? m?.[3];
}

export default function remarkOg(options: RemarkOgOptions = {}) {
  const { endpoint = "/api/og" } = options;

  return (tree: { children: Array<{ type: string; value: string }> }) => {
    const yamlNode = tree.children.find((n) => n.type === "yaml");
    if (!yamlNode) return;

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
