declare module "@/docs.config" {
  import type { DocsConfig } from "@farming-labs/docs";

  const docsConfig: DocsConfig;

  export default docsConfig;
}

declare module "@/docs-client-callbacks" {
  import type { JSX } from "react";

  export default function DocsClientCallbacks(): JSX.Element;
}
