---
title: Deployment checklist
description: Production readiness checks for Northstar CRM apps.
---

# Deployment checklist

Deployment docs are here to make the benchmark corpus more realistic. They are not required for the
support-agent prompting implementation task.

## Checklist

- Build the Next.js app.
- Verify route handlers respond with JSON.
- Confirm docs links point at the production docs domain.
- Run smoke tests after deploy.

## Runtime behavior

Route handlers should be deterministic and avoid reading secrets unless the feature explicitly
requires them.
