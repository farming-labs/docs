/**
 * Fill a `github.editUrl` template: `{path}` becomes the page's source path relative to the
 * repository root, with each segment URL-encoded.
 */
export function formatGithubEditUrl(template: string, sourcePath: string): string {
  const path = sourcePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return template.replaceAll("{path}", path);
}
