---
title: Installation
description: Install and configure Better Auth in your project.
icon: terminal
---

# Installation

Getting started with Better Auth takes just a few minutes. This guide walks you through installing the package, setting up your database, and creating your first auth instance.

## Prerequisites

Before you begin, make sure you have:

- **Node.js** 18 or later
- **A database** — PostgreSQL, MySQL, SQLite, or MongoDB
- **A package manager** — npm, yarn, pnpm, or bun

## Install the Package

<Tabs items={["npm", "yarn", "pnpm", "bun"]}>
  <Tab value="npm">
    ```bash
    npm install better-auth
    ```
  </Tab>
  <Tab value="yarn">
    ```bash
    yarn add better-auth
    ```
  </Tab>
  <Tab value="pnpm">
    ```bash
    pnpm add better-auth
    ```
  </Tab>
  <Tab value="bun">
    ```bash
    bun add better-auth
    ```
  </Tab>
</Tabs>

## Set Up Environment Variables

Create a `.env` file in your project root:

```bash
# Database connection
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

# Auth secret (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET="your-secret-key-here"

# Base URL of your application
BETTER_AUTH_URL="http://localhost:3000"
```

> **Note:** Never commit your `.env` file to version control. Add it to your `.gitignore`.

## Create Auth Instance

Create an `auth.ts` file in your project:

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

## Verify Installation

Start your development server and visit:

```
http://localhost:3000/api/auth/ok
```

You should see a JSON response confirming the auth server is running:

```json
{ "ok": true }
```

---

## Next Steps

- Follow the [Get Started](/docs/get-started) guide
- Learn about [Session Management](/docs/concepts/session-management)
