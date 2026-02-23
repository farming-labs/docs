---
title: "Authentication"
description: "Authentication methods — email/password, social sign-on, and more."
icon: "settings"
---

# Authentication

Better Auth supports multiple authentication methods out of the box. You can enable one or many, and they all work together seamlessly.

## Available Methods

| Method                 | Built-in | Plugin Required   |
| ---------------------- | -------- | ----------------- |
| Email & Password       | ✅       | —                 |
| Social Sign-on (OAuth) | ✅       | —                 |
| Magic Link             | —        | ✅ `magic-link`   |
| Passkeys (WebAuthn)    | —        | ✅ `passkey`      |
| Phone / SMS            | —        | ✅ `phone-number` |
| Anonymous Auth         | —        | ✅ `anonymous`    |

## Email & Password

The most common authentication method. Enable it in your auth config:

```ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Optional
    minPasswordLength: 8, // Default: 8
    maxPasswordLength: 128, // Default: 128
  },
});
```

### Password Hashing

Better Auth uses **Argon2id** by default for password hashing — the most secure algorithm recommended by OWASP. You can also use bcrypt or scrypt:

```ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    password: {
      hash: "bcrypt", // "argon2" | "bcrypt" | "scrypt"
      saltRounds: 12, // For bcrypt
    },
  },
});
```

## Social Sign-on

See [Social Sign-on](/docs/authentication/social-sign-on) for detailed provider setup.

## Choosing a Method

- **Email & Password** — Best for most apps. Users expect it. Always offer alongside social.
- **Social Sign-on** — Reduces friction. Great for B2C apps. Use Google + GitHub at minimum.
- **Magic Link** — Passwordless simplicity. Good for internal tools and dashboards.
- **Passkeys** — Most secure. Growing browser support. Great as a 2FA fallback.

---

## Deep Dives

- [Social Sign-on](/docs/authentication/social-sign-on) — Google, GitHub, Discord, and 20+ providers
- [Email Verification](/docs/authentication/email-verification) — Verify user emails with tokens
