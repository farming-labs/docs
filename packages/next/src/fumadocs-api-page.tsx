"use client";

import { createOpenAPIPage } from "fumadocs-openapi/ui";
import type { ReactNode } from "react";

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

/** Client boundary for Fumadocs OpenAPI's interactive renderer. */
const FumadocsOpenAPIPage = createOpenAPIPage({
  content: {
    renderOperationLayout: renderApiReferenceOperationLayout,
  },
});

export default FumadocsOpenAPIPage;
