"use client";

/**
 * RootProvider wrapper — thin layer over fumadocs-ui's RootProvider.
 *
 * Defaults the search API to `/api/docs` (unified handler).
 * AI features are handled automatically by `createDocsLayout`
 * based on the `ai` config in `docs.config.tsx` — no props needed here.
 */

import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/next";
import type { ComponentPropsWithoutRef } from "react";

type FumadocsProviderProps = ComponentPropsWithoutRef<typeof FumadocsRootProvider>;

export interface DocsRootProviderProps extends FumadocsProviderProps {}

export function RootProvider({ children, search, ...props }: DocsRootProviderProps) {
  return (
    <FumadocsRootProvider
      search={{
        ...search,
        options: {
          api: "/api/docs",
          ...search?.options,
        },
      }}
      {...props}
    >
      {children}
    </FumadocsRootProvider>
  );
}
