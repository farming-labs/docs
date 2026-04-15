/**
 * Server-only helper to convert a ReactNode icon into an HTML string
 * so it can be safely serialized across the server→client boundary.
 */
import { createRequire } from "node:module";
import type { ReactElement } from "react";

const require = createRequire(import.meta.url);

export function serializeIcon(icon: unknown): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;

  try {
    const { renderToStaticMarkup } = require("react-dom/server") as {
      renderToStaticMarkup: (el: ReactElement) => string;
    };
    return renderToStaticMarkup(icon as ReactElement);
  } catch {
    return undefined;
  }
}
