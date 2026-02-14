/**
 * Re-export fumadocs-ui MDX components.
 * Use in mdx-components.tsx:
 *
 * import { getMDXComponents } from "@farming-labs/docs/theme/fumadocs/mdx"
 * export function useMDXComponents(components) {
 *   return { ...getMDXComponents(), ...components }
 * }
 */

import defaultMdxComponents from "fumadocs-ui/mdx";

export function getMDXComponents<T extends Record<string, unknown> = Record<string, unknown>>(
  overrides?: T
): typeof defaultMdxComponents & T {
  return {
    ...defaultMdxComponents,
    ...overrides,
  } as typeof defaultMdxComponents & T;
}

export { defaultMdxComponents };
