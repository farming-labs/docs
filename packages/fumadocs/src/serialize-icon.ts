/**
 * Server-only helper to convert a ReactNode icon into an HTML string
 * so it can be safely serialized across the server→client boundary.
 */
import type { ReactElement } from "react";

export function serializeIcon(icon: unknown): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;

  // Dynamic import to avoid static analysis detecting react-dom/server
  // in the same module graph as client components.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderToStaticMarkup } = require("react-dom/server") as {
      renderToStaticMarkup: (el: ReactElement) => string;
    };
    return renderToStaticMarkup(icon as ReactElement);
  } catch {
    return undefined;
  }
}
