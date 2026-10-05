/** Browser-safe runtime helpers for framework adapters and themes. */
export { emitDocsAnalyticsEvent, resolveDocsAnalyticsConfig } from "./analytics.js";
export { emitDocsTelemetryPageViewEvent } from "./telemetry.js";
export type { DocsTelemetryPageViewContext } from "./telemetry.js";
export { applySidebarFolderIndexBehavior } from "./sidebar.js";
export { resolveDocsAudienceExposure, type DocsContentAudience } from "./audience-exposure.js";
