---
title: Rate limits
description: Rate-limit behavior for Northstar CRM APIs.
---

# Rate limits

Rate limits protect Northstar CRM APIs from abusive traffic. This page is included to make the docs
corpus realistic and should not be required for the support-agent prompting task.

## Default limits

- Free: 60 requests per minute.
- Pro: 300 requests per minute.
- Enterprise: custom.

## Headers

API responses can include `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset`.
