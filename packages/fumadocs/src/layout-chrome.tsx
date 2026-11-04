import type { HTMLAttributes } from "react";
import type { DocsConfig } from "@farming-labs/docs";

export type DocsLayoutContainerProps = HTMLAttributes<HTMLDivElement> & {
  [attribute: `data-${string}`]: string | undefined;
};

/** Attributes on the layout root (`#nd-docs-layout`) that theme CSS selects on. */
export function resolveLayoutContainerProps(
  config: DocsConfig,
  adapterProps?: DocsLayoutContainerProps,
): DocsLayoutContainerProps | undefined {
  const themeName = config.theme?.name;
  const props: DocsLayoutContainerProps = {
    ...(themeName ? { "data-fd-theme": themeName } : {}),
    ...adapterProps,
  };
  return Object.keys(props).length > 0 ? props : undefined;
}
