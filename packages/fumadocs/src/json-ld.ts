export function escapeJsonLdForScript(json: string): string {
  return json.replace(/</g, "\\u003c");
}
