"use client";

import { useEffect } from "react";
import docsConfig from "@farming-labs/next-internal-docs-config";
import { DocsClientHooks } from "@farming-labs/theme/client-hooks";
import type { DocsAnalyticsConfig } from "@farming-labs/docs";

function resolveApiReferenceServerLabel(url?: string): string {
  if (!url) return window.location.origin;

  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return window.location.origin;
  }
}

export default function DocsClientCallbacks(props?: {
  apiReferencePrimaryServerUrl?: string;
  docsCloudEnabled?: boolean;
}) {
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

  const analytics = resolveDocsClientAnalytics(docsConfig.analytics, props?.docsCloudEnabled);

  return (
    <DocsClientHooks
      onCopyClick={docsConfig.onCopyClick}
      analytics={analytics}
      onFeedback={
        docsConfig.feedback && typeof docsConfig.feedback === "object"
          ? docsConfig.feedback.onFeedback
          : undefined
      }
      onAIFeedback={
        docsConfig.ai?.feedback && typeof docsConfig.ai.feedback === "object"
          ? docsConfig.ai.feedback.onFeedback
          : undefined
      }
      onAIActions={docsConfig.ai?.onActions}
    />
  );
}

function resolveDocsClientAnalytics(
  analytics: boolean | DocsAnalyticsConfig | undefined,
  docsCloudEnabled: boolean | undefined,
): boolean | DocsAnalyticsConfig | undefined {
  if (!docsCloudEnabled) return analytics;
  if (analytics === true) return { enabled: true, console: true, cloud: false };
  if (analytics && typeof analytics === "object") return { ...analytics, cloud: false };
  return { enabled: true, console: false, cloud: false };
}
