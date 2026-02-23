---
title: "Database"
description: "Database schema, adapters, and automatic migrations."
---

# Database

Better Auth uses your existing database — no proprietary backend required. It supports PostgreSQL, MySQL, SQLite, and MongoDB through built-in adapters.

## Supported Databases

| Database   | Adapter      | ORM Support                     |
| ---------- | ------------ | ------------------------------- |
| PostgreSQL | `postgresql` | Prisma, Drizzle, raw SQL        |
| MySQL      | `mysql`      | Prisma, Drizzle, raw SQL        |
| SQLite     | `sqlite`     | Prisma, Drizzle, better-sqlite3 |
| MongoDB    | `mongodb`    | Mongoose                        |

## Configuration

### Direct Connection

```ts
export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL,
  },
});
```

### With Prisma

```ts
import { PrismaClient } from "@prisma/client";
import { prismaAdapter } from "better-auth/adapters/prisma";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma),
});
```

### With Drizzle

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const db = drizzle(process.env.DATABASE_URL);

export const auth = betterAuth({
  database: drizzleAdapter(db),
});
```

## Schema

Better Auth creates and manages these tables automatically:

### `user`

| Column          | Type       | Description                |
| --------------- | ---------- | -------------------------- |
| `id`            | `string`   | Primary key                |
| `name`          | `string`   | User's display name        |
| `email`         | `string`   | Unique email address       |
| `emailVerified` | `boolean`  | Whether email is verified  |
| `image`         | `string?`  | Profile image URL          |
| `createdAt`     | `datetime` | Account creation timestamp |
| `updatedAt`     | `datetime` | Last update timestamp      |

### `session`

| Column      | Type       | Description              |
| ----------- | ---------- | ------------------------ |
| `id`        | `string`   | Primary key              |
| `userId`    | `string`   | Foreign key → user       |
| `token`     | `string`   | Session token (hashed)   |
| `expiresAt` | `datetime` | When the session expires |
| `ipAddress` | `string?`  | Client IP address        |
| `userAgent` | `string?`  | Client user agent        |

### `account`

| Column         | Type      | Description                    |
| -------------- | --------- | ------------------------------ |
| `id`           | `string`  | Primary key                    |
| `userId`       | `string`  | Foreign key → user             |
| `providerId`   | `string`  | Auth provider (e.g., "google") |
| `accountId`    | `string`  | Provider-specific user ID      |
| `accessToken`  | `string?` | OAuth access token             |
| `refreshToken` | `string?` | OAuth refresh token            |

### `verification`

| Column       | Type       | Description                   |
| ------------ | ---------- | ----------------------------- |
| `id`         | `string`   | Primary key                   |
| `identifier` | `string`   | What's being verified (email) |
| `value`      | `string`   | Verification token            |
| `expiresAt`  | `datetime` | Token expiry                  |

## Migrations

### Automatic Migrations

Better Auth can automatically create and update tables:

```bash
npx @better-auth/cli migrate
```

### Generate Migration Files

If you prefer to review migrations before applying:

```bash
npx @better-auth/cli generate
```

This creates SQL files you can review and apply manually.

<Callout>
  When using Prisma, run `npx @better-auth/cli generate --prisma` to generate Prisma schema additions instead of raw SQL.
</Callout>

## Custom Fields

You can extend the default schema with custom fields:

```ts
export const auth = betterAuth({
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
      },
      bio: {
        type: "string",
        required: false,
      },
    },
  },
});
```

These fields are automatically added to the `user` table and included in the session user object.
