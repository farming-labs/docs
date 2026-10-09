"use client";

import type { DocsConfig } from "@farming-labs/docs";
import docsConfig from "@farming-labs/next-internal-docs-config";
import { createOpenAPIPage, type CreateOpenAPIPageOptions } from "fumadocs-openapi/ui";
import type { ReactNode } from "react";
import type { FumadocsApiReferenceRendererOptions } from "./fumadocs-renderer.js";

function renderApiReferenceOperationLayout(slots: {
  header: ReactNode;
  description: ReactNode;
  apiExample: ReactNode;
  apiPlayground: ReactNode;
  authSchemes: ReactNode;
  parameters: ReactNode;
  body: ReactNode;
  responses: ReactNode;
  callbacks: ReactNode;
}) {
  return (
    <div className="fd-api-reference-operation">
      <div className="fd-api-reference-operation-main">
        {slots.header}
        {slots.apiPlayground}
        {slots.description ? (
          <div className="fd-api-reference-operation-description">{slots.description}</div>
        ) : null}
        {slots.authSchemes}
        {slots.parameters}
        {slots.body}
        {slots.responses}
        {slots.callbacks}
      </div>
      {slots.apiExample ? (
        <div className="fd-api-reference-operation-example">{slots.apiExample}</div>
      ) : null}
    </div>
  );
}

export function resolveFumadocsOpenAPIPageOptions(config: DocsConfig): CreateOpenAPIPageOptions {
  const renderer =
    config.apiReference && typeof config.apiReference === "object"
      ? config.apiReference.renderer
      : undefined;
  const options =
    renderer && typeof renderer === "object" && renderer.name === "fumadocs"
      ? (renderer.options as FumadocsApiReferenceRendererOptions | undefined)
      : undefined;
  const pageOptions = { ...options };
  delete pageOptions.disableCache;
  delete pageOptions.proxyUrl;

  return {
    ...pageOptions,
    content: {
      renderOperationLayout: renderApiReferenceOperationLayout,
      ...pageOptions.content,
    },
  };
}

/** Client boundary for Fumadocs OpenAPI's interactive renderer. */
const FumadocsOpenAPIPage = createOpenAPIPage(resolveFumadocsOpenAPIPageOptions(docsConfig));

export default FumadocsOpenAPIPage;
