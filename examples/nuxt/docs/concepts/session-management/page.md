---
title: "Session Management"
description: "How sessions work in Better Auth — creation, validation, refresh, and security."
---

# Session Management

Sessions are the backbone of authentication. They represent an authenticated user's state and determine what resources they can access.

## How Sessions Work

When a user signs in, Better Auth:

1. **Validates credentials** — Checks email/password or verifies the social provider token
2. **Creates a session** — Generates a unique session ID and stores it in the database
3. **Sets a cookie** — Sends a secure, HttpOnly cookie to the client with the session token
4. **Returns user data** — Sends the user object and session details back to the client

```
User → Sign In Request → Validate → Create Session → Set Cookie → Response
```

## Session Configuration

Configure session behavior in your auth instance:

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days (in seconds)
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache for 5 minutes
    },
  },
});
```

### Configuration Options

| Option                | Type      | Default  | Description                            |
| --------------------- | --------- | -------- | -------------------------------------- |
| `expiresIn`           | `number`  | `604800` | Session duration in seconds (7 days)   |
| `updateAge`           | `number`  | `86400`  | How often to refresh the session (24h) |
| `cookieCache.enabled` | `boolean` | `false`  | Enable client-side session caching     |
| `cookieCache.maxAge`  | `number`  | `300`    | Cache duration in seconds              |

## Retrieving Sessions

### Server-Side

```ts
const session = await auth.api.getSession({
  headers: request.headers,
});

if (session) {
  console.log("User:", session.user.name);
  console.log("Expires:", session.session.expiresAt);
}
```

### Client-Side

```tsx
import { useSession } from "@/lib/auth-client";

function MyComponent() {
  const { data: session, isPending, error } = useSession();

  if (isPending) return <Spinner />;
  if (error) return <Error message={error.message} />;
  if (!session) return <SignInPrompt />;

  return <div>Hello, {session.user.name}!</div>;
}
```

## Session Security

Better Auth implements several security measures:

- **HttpOnly cookies** — Session tokens are not accessible via JavaScript
- **Secure flag** — Cookies are only sent over HTTPS in production
- **SameSite** — Prevents CSRF attacks by restricting cross-origin cookies
- **Token rotation** — Sessions are periodically refreshed with new tokens
- **IP binding** — Optionally bind sessions to the originating IP address

<Callout>
  Always use HTTPS in production. Better Auth automatically sets the `Secure` cookie flag when `NODE_ENV=production`.
</Callout>

## Revoking Sessions

### Revoke Current Session

```ts
await signOut(); // Client-side
```

### Revoke All Sessions

```ts
// Server-side: revoke all sessions for a user
await auth.api.revokeAllSessions({
  userId: "user-id-here",
});
```

### Revoke Specific Session

```ts
await auth.api.revokeSession({
  sessionId: "session-id-here",
});
```

## Multi-Session Support

Better Auth supports multiple concurrent sessions per user (e.g., different devices):

```ts
export const auth = betterAuth({
  session: {
    multiSession: {
      enabled: true,
      maximumSessions: 5, // Max concurrent sessions
    },
  },
});
```

Users can view and manage their active sessions:

```tsx
const { data: sessions } = await authClient.listSessions();

sessions.forEach((s) => {
  console.log(`${s.userAgent} — ${s.ipAddress}`);
});
```
