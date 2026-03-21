"use client";

import docsConfig from "@/docs.config";
import { DocsClientHooks } from "@farming-labs/theme/client-hooks";

export default function DocsClientCallbacks() {
  return (
    <DocsClientHooks
      onCopyClick={docsConfig.onCopyClick}
      onFeedback={
        typeof docsConfig.feedback === "object" ? docsConfig.feedback.onFeedback : undefined
      }
    />
  );
}
