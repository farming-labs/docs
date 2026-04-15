declare module "@farming-labs/next-internal-docs-config" {
  import type { DocsConfig } from "@farming-labs/docs";

  const docsConfig: DocsConfig;

  export default docsConfig;
}

declare module "fumadocs-openapi/ui" {
  import type { ReactNode } from "react";

  export function createAPIPage(server: any): (props: any) => ReactNode;
}

declare module "fumadocs-openapi/server" {
  export function createOpenAPI(options: any): any;
  export function openapiPlugin(...args: any[]): any;
  export function openapiSource(server: any, options: any): Promise<any>;
}

declare module "fumadocs-ui/layouts/notebook" {
  import type { ReactNode } from "react";

  export function DocsLayout(props: any): ReactNode;
}

declare module "fumadocs-ui/layouts/notebook/page" {
  import type { ReactNode } from "react";

  export function DocsBody(props: any): ReactNode;
  export function DocsDescription(props: any): ReactNode;
  export function DocsPage(props: any): ReactNode;
  export function DocsTitle(props: any): ReactNode;
}
