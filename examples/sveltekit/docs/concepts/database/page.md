---
title: Database
description: Database adapters and schema management in Better Auth.
---

# Database

Better Auth supports multiple database adapters and automatically manages your schema.

## Supported Databases

| Database   | Adapter     | Status      |
|-----------|-------------|-------------|
| PostgreSQL | Built-in    | Stable     |
| MySQL      | Built-in    | Stable     |
| SQLite     | Built-in    | Stable     |
| MongoDB    | Plugin      | Stable     |

## Configuration

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL,
  },
});
```

## Using with Prisma

```ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma),
});
```

## Using with Drizzle

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db),
});
```

> **Note:** When using Prisma, run `npx @better-auth/cli generate --prisma` to generate Prisma schema additions instead of raw SQL.

## Schema

Better Auth creates these tables automatically:

- **user** — User profiles
- **session** — Active sessions
- **account** — OAuth accounts linked to users
- **verification** — Email verification tokens
