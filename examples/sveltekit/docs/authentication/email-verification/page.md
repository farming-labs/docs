---
title: "Email Verification"
description: "Verify user email addresses with magic tokens and custom email templates."
icon: "email"
---

# Email Verification

Email verification ensures users own the email addresses they sign up with. This is critical for account recovery, preventing spam, and building trust.

## Enable Email Verification

```ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        html: `<a href="${url}">Click here to verify your email</a>`,
      });
    },
  },
});
```

## How It Works

1. User signs up with email and password
2. Better Auth generates a verification token
3. Your `sendVerificationEmail` function sends the email
4. User clicks the link, which hits `/api/auth/verify-email?token=...`
5. Better Auth verifies the token and marks the email as verified
6. User is optionally auto-signed in

```
Sign Up → Generate Token → Send Email → User Clicks → Verify → Done
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sendOnSignUp` | `boolean` | `true` | Send verification email on sign up |
| `autoSignInAfterVerification` | `boolean` | `false` | Auto sign-in after verification |
| `expiresIn` | `number` | `3600` | Token expiry in seconds (1 hour) |

## Custom Email Templates

### With React Email

```tsx
import { render } from "@react-email/render";
import { VerificationEmail } from "./emails/verification";

export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const html = render(
        <VerificationEmail
          name={user.name}
          verificationUrl={url}
        />
      );

      await resend.emails.send({
        from: "noreply@yourapp.com",
        to: user.email,
        subject: "Verify your email address",
        html,
      });
    },
  },
});
```

### With Resend

```ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await resend.emails.send({
        from: "Your App <noreply@yourapp.com>",
        to: user.email,
        subject: "Verify your email",
        html: `
          <h1>Welcome!</h1>
          <p>Click the link below to verify your email:</p>
          <a href="${url}">Verify Email</a>
          <p>This link expires in 1 hour.</p>
        `,
      });
    },
  },
});
```

## Resend Verification Email

Allow users to request a new verification email:

```tsx
import { authClient } from "@/lib/auth-client";

async function resendVerification() {
  await authClient.sendVerificationEmail({
    email: "user@example.com",
    callbackURL: "/dashboard",
  });
}
```

## Check Verification Status

```ts
const session = await auth.api.getSession({ headers });

if (!session.user.emailVerified) {
  // Redirect to verification page
}
```

> **Note:** Always use a reputable email service (Resend, SendGrid, AWS SES) in production. Sending from localhost will likely land in spam folders.
