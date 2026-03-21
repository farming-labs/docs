---
order: 1
title: Introduction
description: A comprehensive authentication and authorization framework for TypeScript.
icon: book
---

# Introduction

Better Auth is a framework-agnostic, universal authentication and authorization framework for TypeScript. It provides a comprehensive set of features out of the box and includes a plugin ecosystem that simplifies adding advanced functionalities.

## Features

- **Framework Agnostic** — Support for most popular frameworks
- **Email & Password** — Built-in support for secure email and password authentication
- **Account & Session Management** — Manage user accounts and sessions with ease
- **Built-In Rate Limiter** — Built-in rate limiter with custom rules
- **Automatic Database Management** — Automatic database management and migrations
- **Social Sign-on** — Multiple social sign-on providers
- **Plugin Ecosystem** — Even more capabilities with plugins

---

## Quick Start

Get up and running in under 5 minutes:

```bash
npm install better-auth
```

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL,
  },
  emailAndPassword: {
    enabled: true,
  },
});
```

---

## Next Steps

- Read the [Installation](/docs/installation) guide
- Follow the [Get Started](/docs/get-started) guide
- Explore [Concepts](/docs/concepts)
