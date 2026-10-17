/** Browser-safe runtime helpers for framework adapters and themes. */
export { emitDocsAnalyticsEvent, resolveDocsAnalyticsConfig } from "./analytics.js";
export { emitDocsTelemetryPageViewEvent } from "./telemetry-runtime.js";
export type { DocsTelemetryPageViewContext } from "./telemetry-runtime.js";
export { applySidebarFolderIndexBehavior } from "./sidebar.js";
export { buildDocsPageStructuredData } from "./metadata.js";
export { resolveDocsAudienceExposure, type DocsContentAudience } from "./audience-exposure.js";
