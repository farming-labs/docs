---
title: Installation
description: Local setup notes for the Northstar CRM implementation benchmark.
---

# Installation

Northstar CRM uses a Next.js App Router workspace in this benchmark. The project is already
scaffolded before the implementation agent starts, so the agent should not install packages or
replace the app shell.

The benchmark focuses on how quickly an implementation agent can move from docs discovery to a
working feature. The correct flow is:

1. Read the docs root or discovery index.
2. Open the most specific implementation page.
3. Edit the local Next.js artifact workspace.
4. Run `node scripts/acceptance.mjs`.

## Project shape

The workspace uses:

- `app/page.tsx` for the landing page.
- `app/api/*/route.ts` for route handlers.
- `lib/*` for reusable implementation helpers.
- `scripts/acceptance.mjs` for benchmark validation.

The setup docs are useful for orientation, but they do not contain the constants required by the
support-agent prompting contract.
