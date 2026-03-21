/**
 * Server-only helper to convert a ReactNode icon into an HTML string
 * so it can be safely serialized across the server→client boundary.
 */
import type { ReactElement } from "react";

export function serializeIcon(icon: unknown): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;

  try {
    const runtimeRequire = eval("require") as (id: string) => {
      renderToStaticMarkup: (el: ReactElement) => string;
    };
    const { renderToStaticMarkup } = runtimeRequire("react-dom/server");
    return renderToStaticMarkup(icon as ReactElement);
  } catch {
    return undefined;
  }
}
