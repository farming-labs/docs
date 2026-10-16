"use client";

import { lazy, type ComponentProps } from "react";
import type { DocsAIFeatures as DocsAIFeaturesComponent } from "./docs-ai-features.js";

// Keep the implementation outside the initial Next.js client graph when AI is disabled.
// Enabled layouts retain server rendering through their existing Suspense boundary.
const LazyDocsAIFeatures = lazy(() =>
  import("./docs-ai-features.js").then((module) => ({ default: module.DocsAIFeatures })),
);

export function DocsAIFeatures(props: ComponentProps<typeof DocsAIFeaturesComponent>) {
  return <LazyDocsAIFeatures {...props} />;
}
