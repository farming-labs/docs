---
order: 8
title: "Integrations"
description: "Framework integrations — Next.js, Nuxt, SvelteKit, Astro, and more."
icon: "file"
---

# Integrations

Better Auth is framework-agnostic but provides first-class integrations for popular frameworks.

## Supported Frameworks

| Framework        | Handler              | Client SDK                     |
| ---------------- | -------------------- | ------------------------------ |
| **Next.js**      | `toNextJsHandler`    | `better-auth/react`            |
| **Nuxt**         | `toH3Handler`        | `better-auth/vue`              |
| **SvelteKit**    | `toSvelteKitHandler` | `better-auth/svelte`           |
| **Astro**        | Built-in support     | `better-auth/react` or vanilla |
| **Express**      | `toNodeHandler`      | Any client SDK                 |
| **Hono**         | `toHonoHandler`      | Any client SDK                 |
| **Elysia (Bun)** | `toElysiaHandler`    | Any client SDK                 |
| **Fastify**      | `toNodeHandler`      | Any client SDK                 |

## Next.js

### API Route

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Middleware

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const session = request.cookies.get("better-auth.session_token");

  if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

### Server Components

```tsx
import { auth } from "@/auth";
import { headers } from "next/headers";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return <div>Hello, {session?.user.name ?? "Guest"}!</div>;
}
```

## Nuxt

### Server Plugin

```ts
// server/plugins/auth.ts
import { auth } from "~/auth";
import { toH3Handler } from "better-auth/h3";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.h3App.use("/api/auth/**", toH3Handler(auth));
});
```

### Composable

```vue
<script setup lang="ts">
import { useSession } from "better-auth/vue";

const { data: session, pending } = useSession();
</script>

<template>
  <div v-if="pending">Loading...</div>
  <div v-else-if="session">Hello, {{ session.user.name }}!</div>
  <div v-else>Not signed in</div>
</template>
```

## Express / Node.js

```ts
import express from "express";
import { auth } from "./auth";
import { toNodeHandler } from "better-auth/node";

const app = express();

// Mount auth handler
app.all("/api/auth/*", toNodeHandler(auth));

// Protected route example
app.get("/api/me", async (req, res) => {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({ user: session.user });
});

app.listen(3000);
```

## Hono

```ts
import { Hono } from "hono";
import { auth } from "./auth";

const app = new Hono();

app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

export default app;
```

## SvelteKit

### Server Hook

```ts
// src/hooks.server.ts
import { auth } from "$lib/auth";

export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  event.locals.session = session;
  return resolve(event);
}
```

### Page

```svelte
<script>
  import { useSession } from "better-auth/svelte";
  const session = useSession();
</script>

{#if $session}
  <p>Welcome, {$session.user.name}!</p>
{:else}
  <p>Please sign in.</p>
{/if}
```
