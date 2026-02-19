---
title: Session Management
description: How sessions work in Better Auth.
---

# Session Management

Better Auth uses a token-based session system that's secure, scalable, and easy to use.

## How Sessions Work

When a user signs in:

1. A session record is created in the database
2. A session token is generated (cryptographically secure random string)
3. The token is stored in an HTTP-only cookie
4. Subsequent requests include the cookie automatically

## Session Configuration

```ts title="auth.ts"
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh every 24 hours
  },
});
```

## Checking Sessions

### Server-Side

```ts
const session = await auth.api.getSession({
  headers: request.headers,
});
```

### Client-Side

```ts
const session = await authClient.getSession();
```

> **Note:** Always use HTTPS in production. Better Auth automatically sets the `Secure` cookie flag when `NODE_ENV=production`.

## Revoking Sessions

```ts
// Revoke current session
await authClient.signOut();

// Revoke all sessions for the user
await authClient.revokeAllSessions();
```
