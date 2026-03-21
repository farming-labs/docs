---
order: 2
title: Get Started
description: Build your first authentication flow with Better Auth.
icon: rocket
---

# Get Started

This guide walks you through building a complete sign-up and sign-in flow using Better Auth.

## Create the Auth Client

First, create a client-side auth helper:

```ts
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
});
```

## Sign Up

Create a sign-up form that calls the auth client:

```ts
const { data, error } = await authClient.signUp.email({
  email: "user@example.com",
  password: "securePassword123",
  name: "John Doe",
});

if (error) {
  console.error("Sign-up failed:", error.message);
} else {
  console.log("User created:", data.user);
}
```

## Sign In

After registration, users can sign in:

```ts
const { data, error } = await authClient.signIn.email({
  email: "user@example.com",
  password: "securePassword123",
});

if (data) {
  console.log("Signed in:", data.session);
}
```

## Get Current Session

Check the current user's session:

```ts
const session = await authClient.getSession();

if (session) {
  console.log("Current user:", session.user.name);
} else {
  console.log("Not authenticated");
}
```

## Sign Out

```ts
await authClient.signOut();
```

---

## Next Steps

- Learn about [Session Management](/docs/concepts/session-management)
- Set up a [Database](/docs/concepts/database)
