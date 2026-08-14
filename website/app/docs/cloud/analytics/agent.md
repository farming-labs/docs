<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:6f70f7ff5dd7cacb
settingsHash=fnv1a64:72be2461542d7a95
outputHash=fnv1a64:71082a9b0c66a490
generatedAt=2026-08-14T12:45:38.442Z
-->
# Analytics

## Analytics task

Task: Connect a docs runtime to Docs Cloud analytics without exposing user-authored inputs by default.

Expected result: Runtime events are attributed to the intended Docs Cloud project and appear in its analytics dashboard.

## Analytics prerequisites

- A Docs Cloud workspace has an imported project or custom analytics project.
- The dashboard-provided project ID is available for the runtime environment.
- Consent and retention policies are defined before enabling includeInputs.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Analytics verification

- Run pnpm dlx @farming-labs/docs cloud check --analytics --no-network. Expected: The analytics runtime, Cloud setting, and project environment checks pass.
- Trigger a test page view and confirm the event is attributed to the expected project in Docs Cloud.
- Failure: Events do not appear in the dashboard.
- Recovery: Copy the project ID from Docs Cloud again and use the framework-specific public or server environment variable documented on this page.
- Rollback: Disable cloud.analytics or set the documented analytics-enabled environment flag to false.

## Analytics agent guidance

Use this page when the user asks about this topic: Docs Cloud analytics, project identity, managed Cloud analytics delivery, event storage, dashboard analytics, includeInputs privacy, and customer onEvent callbacks.
Keep answers technical and avoid exposing internal transport details as public setup steps. If the user asks how to deploy a hosted preview, point to /docs/cloud/deploy. If the user asks about runtime event options outside Cloud, point to /docs/customization/analytics.
