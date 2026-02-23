---
title: "Two Factor Authentication"
description: "Add TOTP-based two factor authentication with backup codes."
---

# Two Factor Authentication

Two factor authentication (2FA) adds an extra layer of security by requiring users to provide a second form of verification beyond their password.

## Installation

The 2FA plugin is included in the Better Auth package:

```ts
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    twoFactor({
      issuer: "MyApp", // Shows in authenticator apps
      backupCodes: {
        enabled: true,
        count: 10, // Number of backup codes
        length: 8, // Length of each code
      },
    }),
  ],
});
```

## Client Setup

```ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
```

## Enabling 2FA for a User

### Step 1: Generate TOTP Secret

```tsx
const { data } = await authClient.twoFactor.enable();

// data.totpURI — Use this to generate a QR code
// data.backupCodes — Show these to the user (one time only!)
```

### Step 2: Show QR Code

```tsx
import QRCode from "qrcode.react";

function Setup2FA({ totpURI }: { totpURI: string }) {
  return (
    <div>
      <h2>Scan this QR code with your authenticator app</h2>
      <QRCode value={totpURI} size={200} />
      <p>Supported apps: Google Authenticator, Authy, 1Password</p>
    </div>
  );
}
```

### Step 3: Verify Initial Code

```tsx
const { data, error } = await authClient.twoFactor.verifyTotp({
  code: "123456", // Code from authenticator app
});

if (error) {
  console.error("Invalid code");
} else {
  console.log("2FA enabled successfully!");
}
```

## Sign-In with 2FA

When 2FA is enabled, sign-in becomes a two-step process:

```tsx
// Step 1: Email & Password
const result = await signIn.email({
  email: "user@example.com",
  password: "password123",
});

// If 2FA is enabled, result.twoFactorRequired will be true
if (result.data?.twoFactorRequired) {
  // Step 2: Show TOTP input
  const { data, error } = await authClient.twoFactor.verifyTotp({
    code: userEnteredCode,
  });
}
```

## Backup Codes

Backup codes allow users to sign in if they lose access to their authenticator app:

```tsx
// Use a backup code instead of TOTP
const { data, error } = await authClient.twoFactor.verifyBackupCode({
  code: "ABCD-1234",
});
```

### Regenerate Backup Codes

```tsx
const { data } = await authClient.twoFactor.generateBackupCodes();
// data.backupCodes — new set of codes (previous ones are invalidated)
```

<Callout>
  Always remind users to save their backup codes in a secure location. They cannot be retrieved after the initial display.
</Callout>

## Disabling 2FA

```tsx
const { error } = await authClient.twoFactor.disable({
  password: "current-password", // Require password confirmation
});
```

## Configuration Reference

| Option                | Type      | Default  | Description                         |
| --------------------- | --------- | -------- | ----------------------------------- |
| `issuer`              | `string`  | required | Name shown in authenticator apps    |
| `period`              | `number`  | `30`     | TOTP code rotation period (seconds) |
| `digits`              | `number`  | `6`      | Number of digits in TOTP code       |
| `algorithm`           | `string`  | `"SHA1"` | Hash algorithm                      |
| `backupCodes.enabled` | `boolean` | `true`   | Enable backup codes                 |
| `backupCodes.count`   | `number`  | `10`     | Number of backup codes              |
| `backupCodes.length`  | `number`  | `8`      | Length of each backup code          |
