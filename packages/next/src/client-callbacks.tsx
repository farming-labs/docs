"use client";

import { useEffect } from "react";
import docsConfig from "@farming-labs/next-internal-docs-config";
import { DocsClientHooks } from "@farming-labs/theme/client-hooks";

function resolveApiReferenceServerLabel(url?: string): string {
  if (!url) return window.location.origin;

  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return window.location.origin;
  }
}

export default function DocsClientCallbacks(props?: { apiReferencePrimaryServerUrl?: string }) {
  useEffect(() => {
    if (!props?.apiReferencePrimaryServerUrl) return;

    const nextLabel = resolveApiReferenceServerLabel(props.apiReferencePrimaryServerUrl);
    const timers = [0, 200, 1000].map((delay) =>
      window.setTimeout(() => {
        document
          .querySelectorAll<HTMLElement>(
            '.fd-api-reference-route button[aria-haspopup="dialog"] code.truncate',
          )
          .forEach((node) => {
            if (node.textContent?.trim() === "loading...") {
              node.textContent = nextLabel;
            }
          });
      }, delay),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [props?.apiReferencePrimaryServerUrl]);

  return (
    <DocsClientHooks
      onCopyClick={docsConfig.onCopyClick}
      analytics={docsConfig.analytics}
      onFeedback={
        docsConfig.feedback && typeof docsConfig.feedback === "object"
          ? docsConfig.feedback.onFeedback
          : undefined
      }
    />
  );
}
