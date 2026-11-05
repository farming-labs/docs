import type { ReactNode } from "react";
import docsConfig from "@farming-labs/next-internal-docs-config";
import { DocsPageContent } from "@farming-labs/theme/internal/page";

export function DocsPageBoundary({ route, children }: { route: string; children: ReactNode }) {
  // Locale-aware and custom content roots retain the existing metadata path.
  if (docsConfig.i18n || docsConfig.components?.wrapper) return <>{children}</>;
  return (
    <DocsPageContent config={docsConfig} route={route}>
      {children}
    </DocsPageContent>
  );
}
