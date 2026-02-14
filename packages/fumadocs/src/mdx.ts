/**
 * Re-export fumadocs-ui MDX components.
 *
 * Usage in mdx-components.tsx:
 *   import { getMDXComponents } from "@farming-labs/fumadocs/mdx";
 */

import defaultMdxComponents from "fumadocs-ui/mdx";

export function getMDXComponents<
  T extends Record<string, unknown> = Record<string, unknown>,
>(overrides?: T): typeof defaultMdxComponents & T {
  return {
    ...defaultMdxComponents,
    ...overrides,
  } as typeof defaultMdxComponents & T;
}

export { defaultMdxComponents };
