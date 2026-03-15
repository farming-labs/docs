"use client";

import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/tanstack";
import type { ComponentPropsWithoutRef } from "react";

type FumadocsProviderProps = ComponentPropsWithoutRef<typeof FumadocsRootProvider>;

export interface DocsTanstackRootProviderProps extends FumadocsProviderProps {}

export function RootProvider({ children, search, ...props }: DocsTanstackRootProviderProps) {
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
