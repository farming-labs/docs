import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/fumadocs";
import { MyNote } from "./app/components/my-note";

export default defineDocs({
  entry: "docs",
  theme: fumadocs({
    ui: {
      colors: { primary: "#22c55e" },
      components: { Callout: { variant: "outline" } },
      layout: { toc: { enabled: true, depth: 3 } },
    },
  }),

  // Custom MDX component overrides.
  // Add new components (e.g. MyNote) — available in MDX with no imports.
  // Override built-ins (e.g. Callout: MyCallout) to replace the default.
  components: {
    MyNote,
    // Callout: CustomCallout, // uncomment to override the default Callout
  },

  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by Fumadocs preset",
  },

  og: {
    enabled: true,
    type: "dynamic",
    endpoint: "/api/og",
    defaultImage: "/og/default.png",
  },
});
