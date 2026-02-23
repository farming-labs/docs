---
title: "API Reference"
description: "Complete API reference for Better Auth — server, client, and plugins."
icon: "file"
---

# API Reference

Complete reference for the Better Auth API. Covers the server-side auth instance, client SDK, and API endpoints.

## Server API

### `betterAuth(config)`

Creates an auth instance with the given configuration.

```ts
import { betterAuth } from "better-auth";

const auth = betterAuth({
  database: { provider: "postgresql", url: "..." },
  emailAndPassword: { enabled: true },
  socialProviders: {
    /* ... */
  },
  plugins: [
    /* ... */
  ],
  session: {
    /* ... */
  },
});
```

### `auth.api`

The server-side API object. Use this in server components, API routes, and middleware.

| Method                                  | Description                    |
| --------------------------------------- | ------------------------------ |
| `getSession({ headers })`               | Get the current session        |
| `createUser({ email, password, name })` | Create a new user              |
| `deleteUser({ userId })`                | Delete a user                  |
| `listUsers({ limit, offset })`          | List all users                 |
| `revokeSession({ sessionId })`          | Revoke a specific session      |
| `revokeAllSessions({ userId })`         | Revoke all sessions for a user |

### `auth.handler`

The request handler. Mount this on your API route:

```ts
// Works with any Request → Response handler
const response = await auth.handler(request);
```

## Client API

### `createAuthClient(options)`

Creates a client-side auth client.

```ts
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [
    /* client plugins */
  ],
});
```

### Sign Up

```ts
const { data, error } = await authClient.signUp.email({
  email: string,
  password: string,
  name: string,
  image?: string,
  callbackURL?: string,
});
```

### Sign In

```ts
// Email & Password
const { data, error } = await authClient.signIn.email({
  email: string,
  password: string,
  callbackURL?: string,
  rememberMe?: boolean,
});

// Social
await authClient.signIn.social({
  provider: "google" | "github" | "discord" | /* ... */,
  callbackURL?: string,
});
```

### Sign Out

```ts
await authClient.signOut({
  fetchOptions: { onSuccess: () => router.push("/") },
});
```

### Session

```tsx
// React hook
const { data: session, isPending, error } = authClient.useSession();

// Direct fetch
const session = await authClient.getSession();
```

## REST API Endpoints

Better Auth exposes these HTTP endpoints:

### Authentication

| Method | Path                           | Description                  |
| ------ | ------------------------------ | ---------------------------- |
| `POST` | `/api/auth/sign-up/email`      | Register with email/password |
| `POST` | `/api/auth/sign-in/email`      | Sign in with email/password  |
| `POST` | `/api/auth/sign-in/social`     | Initiate social sign-in      |
| `GET`  | `/api/auth/callback/:provider` | OAuth callback handler       |
| `POST` | `/api/auth/sign-out`           | Sign out current session     |
| `GET`  | `/api/auth/session`            | Get current session          |

### Email Verification

| Method | Path                                | Description               |
| ------ | ----------------------------------- | ------------------------- |
| `GET`  | `/api/auth/verify-email`            | Verify email with token   |
| `POST` | `/api/auth/send-verification-email` | Resend verification email |

### Password Reset

| Method | Path                        | Description               |
| ------ | --------------------------- | ------------------------- |
| `POST` | `/api/auth/forget-password` | Request password reset    |
| `POST` | `/api/auth/reset-password`  | Reset password with token |

### User Management

| Method   | Path             | Description         |
| -------- | ---------------- | ------------------- |
| `GET`    | `/api/auth/user` | Get current user    |
| `PATCH`  | `/api/auth/user` | Update user profile |
| `DELETE` | `/api/auth/user` | Delete user account |

## Error Handling

All API methods return a consistent error shape:

```ts
interface AuthError {
  message: string;
  code: string;
  status: number;
}
```

Common error codes:

| Code                  | Status | Description              |
| --------------------- | ------ | ------------------------ |
| `USER_NOT_FOUND`      | 404    | User doesn't exist       |
| `INVALID_CREDENTIALS` | 401    | Wrong email or password  |
| `EMAIL_NOT_VERIFIED`  | 403    | Email not yet verified   |
| `SESSION_EXPIRED`     | 401    | Session has expired      |
| `RATE_LIMIT_EXCEEDED` | 429    | Too many requests        |
| `INVALID_TOKEN`       | 400    | Invalid or expired token |

## TypeScript

Better Auth is fully typed. You get autocomplete and type safety for:

- Configuration options
- API responses
- Session objects
- Plugin APIs
- Database schemas

```ts
// Type-safe session access
const session = await auth.api.getSession({ headers });
//    ^? { user: User; session: Session } | null

session?.user.name;
//              ^? string
session?.user.email;
//              ^? string
session?.session.expiresAt;
//                  ^? Date
```
