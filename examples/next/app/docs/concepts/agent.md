# Concepts
URL: /docs/concepts
Description: Core concepts and architecture of Better Auth. # Concepts

 Understanding core concepts help get most out Better Auth build robust authentication systems.

 ## Architecture Overview

 Better Auth follows layered architecture:

```
┌──────────────────────────────────────┐
│          Client SDK (React, etc.)    │
├──────────────────────────────────────┤
│            API Handler               │
├──────────────────────────────────────┤
│          Auth Core Engine            │
├──────────────┬───────────────────────┤
│   Plugins    │   Database Adapter    │
└──────────────┴───────────────────────┘
``` 1 **Client SDK** — Framework-specific hooks utilities for frontend
 **API Handler** — HTTP endpoints handle auth requests (sign in sign up 3 **Auth Core Engine** — central logic orchestrates authentication flows
 4 **Plugins** — Optional modules extend functionality (2FA, passkeys 5 **Database Adapter** — Abstraction layer for database choice

 Key Concepts

 Auth Instance

 auth instance central object configures authentication system. created with `betterAuth()` holds configuration, plugins database connections.

 Sessions

 represent authenticated user's state. Better Auth uses secure encrypted cookies manage sessions. Sessions configured with custom expiry times refresh tokens .

 Accounts

 account links user to authentication method. single user can have multiple accounts (e.g., email+ Google+ GitHub), all linked to same user profile.

 Verification

 Verification tokens used for email verification password resets other flows require proving ownership of email address.

 ---

 ## Deep Dives

- [Session Management](/docs/concepts/session-management) sessions work token rotation security
- [Database Schema](/docs/concepts/database) — Tables, relationships, migrations
