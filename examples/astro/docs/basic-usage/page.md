---
order: 4
title: "Basic Usage"
description: "Learn the fundamental auth flows — sign up, sign in, and session management."
icon: "rocket"
---

# Basic Usage

This guide covers the essential authentication flows: creating accounts, signing in, managing sessions, and protecting routes.

## Create the Auth Client

On the client side, create an auth client that communicates with your API:

```ts title="lib/auth-client.ts"
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

## Sign Up

Create a new user with email and password:

```tsx title="sign-up.tsx"
import { signUp } from "@/lib/auth-client";

async function handleSignUp() {
  const { data, error } = await signUp.email({
    email: "user@example.com",
    password: "securepassword123",
    name: "John Doe",
  });

  if (error) {
    console.error("Sign up failed:", error.message);
    return;
  }

  console.log("User created:", data.user);
}
```

## Sign In

### Email & Password

```tsx title="sign-in.tsx"
import { signIn } from "@/lib/auth-client";

async function handleSignIn() {
  const { data, error } = await signIn.email({
    email: "user@example.com",
    password: "securepassword123",
  });

  if (error) {
    console.error("Sign in failed:", error.message);
    return;
  }

  // User is now signed in
  console.log("Session:", data.session);
}
```

### Social Sign-In

```tsx
import { signIn } from "@/lib/auth-client";

// Google
await signIn.social({ provider: "google" });

// GitHub
await signIn.social({ provider: "github" });
```

## Session Management

### Get Current Session

Use the `useSession` hook in React components:

```tsx title="profile.tsx"
import { useSession } from "@/lib/auth-client";

function Profile() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not signed in</div>;

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>{session.user.email}</p>
    </div>
  );
}
```

### Sign Out

```tsx
import { signOut } from "@/lib/auth-client";

async function handleSignOut() {
  await signOut();
  // User is now signed out
}
```

## Protecting Routes

### Server-Side (Next.js)

```ts title="lib/session.ts"
import { auth } from "@/auth";
import { headers } from "next/headers";

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}
```

Use it in a server component:

```tsx title="app/dashboard/page.tsx"
import { getServerSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  return <Dashboard user={session.user} />;
}
```

### Client-Side Guard

```tsx title="components/auth-guard.tsx"
"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  if (isPending) return <div>Loading...</div>;
  if (!session) return null;

  return <>{children}</>;
}
```

---

## Quick Reference

| Action           | Method                                    |
| ---------------- | ----------------------------------------- |
| Sign up          | `signUp.email({ email, password, name })` |
| Sign in (email)  | `signIn.email({ email, password })`       |
| Sign in (social) | `signIn.social({ provider })`             |
| Get session      | `useSession()` hook                       |
| Sign out         | `signOut()`                               |
| Server session   | `auth.api.getSession({ headers })`        |

---

## Next Steps

- Learn about [Session Management](/docs/concepts/session-management) in depth
- Set up [Social Sign-on](/docs/authentication/social-sign-on) providers
- Add [Two Factor Authentication](/docs/plugins/two-factor) for extra security
