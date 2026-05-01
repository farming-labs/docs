import { defineDocs } from "@farming-labs/docs";
import { colorful } from "@farming-labs/theme/colorful";

export default defineDocs({
  entry: "docs",
  theme: colorful(),
  nav: {
    title: "Remote OpenAPI Smoke Test",
    url: "/docs",
  },
  sidebar: {
    flat: true,
  },
  metadata: {
    titleTemplate: "%s | Remote OpenAPI Smoke Test",
    description: "Documentation for Remote OpenAPI Smoke Test.",
  },
  apiReference: {
    enabled: true,
    path: "api-reference",
    renderer: "fumadocs",
    specUrl: "http://127.0.0.1:4678/openapi.json",
  },
});
