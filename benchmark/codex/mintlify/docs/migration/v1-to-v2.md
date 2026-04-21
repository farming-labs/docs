---
title: Migrate support agent v1 to v2
description: Differences between the deprecated v1 and current v2 support-agent contracts.
---

# Migrate support agent v1 to v2

The v2 support-agent endpoint replaces the deprecated v1 response shape. Existing v1 customers can
continue using the old endpoint, but all new implementation work should use v2.

## What changed

| Area | v1 | v2 |
| ---- | -- | -- |
| API version | `2025-11-01.v1` | `2026-04-21.v2` |
| Response schema | `support-agent.response.v1` | `support-agent.response.v2` |
| Context header | `x-startup-agent-context` | `x-northstar-agent-context` |
| Tools | `search_docs`, `read_page`, `create_ticket` | adds `handoff_to_human` |
| Response fields | `version`, `contextHeader`, `tools`, `prompt` | adds `schema` and `safety` |

## Implementation guidance

Use [Support agent v2 current contract](__BASE_URL__/docs/core/support-agent-v2.md) as the source
of truth. Do not implement the v1 constants in new code.
