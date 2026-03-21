---
order: 7
title: "Plugins"
description: "Extend Better Auth with powerful plugins — 2FA, organizations, passkeys, and more."
icon: rocket
---

# Plugins

Better Auth's plugin system lets you add powerful features without bloating the core. Each plugin is self-contained with its own database schema, API endpoints, and client-side utilities.

## How Plugins Work

Plugins hook into Better Auth's lifecycle:

```ts
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    twoFactor({
      issuer: "MyApp",
    }),
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],
});
```

Each plugin can:

- **Add API endpoints** — e.g., `/api/auth/two-factor/verify`
- **Extend the database schema** — e.g., add an `organization` table
- **Add client-side utilities** — e.g., `authClient.twoFactor.verify()`
- **Hook into auth events** — e.g., run custom logic after sign-in

## Available Plugins

### Authentication

| Plugin                                 | Description                                  |
| -------------------------------------- | -------------------------------------------- |
| [Two Factor](/docs/plugins/two-factor) | TOTP, SMS, and backup codes                  |
| Passkey                                | WebAuthn / FIDO2 passwordless authentication |
| Magic Link                             | Passwordless email authentication            |
| Phone Number                           | SMS-based authentication                     |
| Anonymous                              | Allow anonymous/guest users                  |

### Authorization & Access Control

| Plugin                                       | Description                          |
| -------------------------------------------- | ------------------------------------ |
| [Organizations](/docs/plugins/organizations) | Multi-tenant organization management |
| Admin                                        | Admin dashboard and user management  |
| RBAC                                         | Role-based access control            |

### Enterprise

| Plugin        | Description                                   |
| ------------- | --------------------------------------------- |
| OIDC Provider | Turn your app into an OpenID Connect provider |
| SAML          | Enterprise SSO with SAML 2.0                  |
| SCIM          | Automated user provisioning                   |

### Utilities

| Plugin     | Description                        |
| ---------- | ---------------------------------- |
| Rate Limit | Advanced rate limiting rules       |
| Captcha    | Bot protection with CAPTCHA        |
| Webhook    | Real-time auth event notifications |

## Client-Side Plugin Setup

Plugins that add client-side features need to be registered on the auth client too:

```ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [twoFactorClient(), organizationClient()],
});
```

## Creating Custom Plugins

You can build your own plugins:

```ts
import { createAuthPlugin } from "better-auth";

export const myPlugin = createAuthPlugin({
  id: "my-plugin",
  init: (ctx) => {
    return {
      endpoints: {
        myEndpoint: {
          path: "/my-plugin/action",
          method: "POST",
          handler: async (req) => {
            // Your custom logic
            return { success: true };
          },
        },
      },
      hooks: {
        after: [
          {
            matcher: (ctx) => ctx.path === "/sign-in",
            handler: async (ctx) => {
              // Run after sign-in
              console.log("User signed in:", ctx.session.user.name);
            },
          },
        ],
      },
    };
  },
});
```

---

## Deep Dives

- [Two Factor Authentication](/docs/plugins/two-factor) — TOTP setup and verification
- [Organizations](/docs/plugins/organizations) — Multi-tenant team management
