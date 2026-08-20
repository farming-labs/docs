/**
 * Server-only helper to convert a ReactNode icon into an HTML string
 * so it can be safely serialized across the server→client boundary.
 */
import { createRequire } from "node:module";
import type { ReactElement } from "react";

export function serializeIcon(icon: unknown): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;

  try {
    // createRequire must stay inside the try: import.meta.url is undefined in
    // some server runtimes (e.g. Cloudflare workerd), and calling it at module
    // scope would throw at import time and break the whole server bundle.
    const require = createRequire(import.meta.url);
    const { renderToStaticMarkup } = require("react-dom/server") as {
      renderToStaticMarkup: (el: ReactElement) => string;
    };
    return renderToStaticMarkup(icon as ReactElement);
  } catch {
    return undefined;
  }
}
