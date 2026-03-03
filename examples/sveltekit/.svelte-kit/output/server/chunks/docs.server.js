import fs from "node:fs";
import path from "node:path";
import require$$0 from "fs";
import { b as private_env } from "./shared-server.js";
import { c as config } from "./docs.config.js";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
const __vite_glob_0_0 = '---\ntitle: "Email Verification"\ndescription: "Verify user email addresses with magic tokens and custom email templates."\nicon: "email"\n---\n\n# Email Verification\n\nEmail verification ensures users own the email addresses they sign up with. This is critical for account recovery, preventing spam, and building trust.\n\n## Enable Email Verification\n\n```ts\nexport const auth = betterAuth({\n  emailAndPassword: {\n    enabled: true,\n    requireEmailVerification: true,\n  },\n  emailVerification: {\n    sendOnSignUp: true,\n    autoSignInAfterVerification: true,\n    sendVerificationEmail: async ({ user, url, token }) => {\n      await sendEmail({\n        to: user.email,\n        subject: "Verify your email",\n        html: `<a href="${url}">Click here to verify your email</a>`,\n      });\n    },\n  },\n});\n```\n\n## How It Works\n\n1. User signs up with email and password\n2. Better Auth generates a verification token\n3. Your `sendVerificationEmail` function sends the email\n4. User clicks the link, which hits `/api/auth/verify-email?token=...`\n5. Better Auth verifies the token and marks the email as verified\n6. User is optionally auto-signed in\n\n```\nSign Up → Generate Token → Send Email → User Clicks → Verify → Done\n```\n\n## Configuration Options\n\n| Option                        | Type      | Default | Description                        |\n| ----------------------------- | --------- | ------- | ---------------------------------- |\n| `sendOnSignUp`                | `boolean` | `true`  | Send verification email on sign up |\n| `autoSignInAfterVerification` | `boolean` | `false` | Auto sign-in after verification    |\n| `expiresIn`                   | `number`  | `3600`  | Token expiry in seconds (1 hour)   |\n\n## Custom Email Templates\n\n### With React Email\n\n```tsx\nimport { render } from "@react-email/render";\nimport { VerificationEmail } from "./emails/verification";\n\nexport const auth = betterAuth({\n  emailVerification: {\n    sendVerificationEmail: async ({ user, url }) => {\n      const html = render(<VerificationEmail name={user.name} verificationUrl={url} />);\n\n      await resend.emails.send({\n        from: "noreply@yourapp.com",\n        to: user.email,\n        subject: "Verify your email address",\n        html,\n      });\n    },\n  },\n});\n```\n\n### With Resend\n\n```ts\nimport { Resend } from "resend";\n\nconst resend = new Resend(process.env.RESEND_API_KEY);\n\nexport const auth = betterAuth({\n  emailVerification: {\n    sendVerificationEmail: async ({ user, url }) => {\n      await resend.emails.send({\n        from: "Your App <noreply@yourapp.com>",\n        to: user.email,\n        subject: "Verify your email",\n        html: `\n          <h1>Welcome!</h1>\n          <p>Click the link below to verify your email:</p>\n          <a href="${url}">Verify Email</a>\n          <p>This link expires in 1 hour.</p>\n        `,\n      });\n    },\n  },\n});\n```\n\n## Resend Verification Email\n\nAllow users to request a new verification email:\n\n```tsx\nimport { authClient } from "@/lib/auth-client";\n\nasync function resendVerification() {\n  await authClient.sendVerificationEmail({\n    email: "user@example.com",\n    callbackURL: "/dashboard",\n  });\n}\n```\n\n## Check Verification Status\n\n```ts\nconst session = await auth.api.getSession({ headers });\n\nif (!session.user.emailVerified) {\n  // Redirect to verification page\n}\n```\n\n> **Note:** Always use a reputable email service (Resend, SendGrid, AWS SES) in production. Sending from localhost will likely land in spam folders.\n';
const __vite_glob_0_1 = '---\ntitle: "Authentication"\ndescription: "Authentication methods — email/password, social sign-on, and more."\nicon: "settings"\n---\n\n# Authentication\n\nBetter Auth supports multiple authentication methods out of the box. You can enable one or many, and they all work together seamlessly.\n\n## Available Methods\n\n| Method                 | Built-in | Plugin Required   |\n| ---------------------- | -------- | ----------------- |\n| Email & Password       | ✅       | —                 |\n| Social Sign-on (OAuth) | ✅       | —                 |\n| Magic Link             | —        | ✅ `magic-link`   |\n| Passkeys (WebAuthn)    | —        | ✅ `passkey`      |\n| Phone / SMS            | —        | ✅ `phone-number` |\n| Anonymous Auth         | —        | ✅ `anonymous`    |\n\n## Email & Password\n\nThe most common authentication method. Enable it in your auth config:\n\n```ts\nexport const auth = betterAuth({\n  emailAndPassword: {\n    enabled: true,\n    requireEmailVerification: true, // Optional\n    minPasswordLength: 8, // Default: 8\n    maxPasswordLength: 128, // Default: 128\n  },\n});\n```\n\n### Password Hashing\n\nBetter Auth uses **Argon2id** by default for password hashing — the most secure algorithm recommended by OWASP. You can also use bcrypt or scrypt:\n\n```ts\nexport const auth = betterAuth({\n  emailAndPassword: {\n    enabled: true,\n    password: {\n      hash: "bcrypt", // "argon2" | "bcrypt" | "scrypt"\n      saltRounds: 12, // For bcrypt\n    },\n  },\n});\n```\n\n## Social Sign-on\n\nSee [Social Sign-on](/docs/authentication/social-sign-on) for detailed provider setup.\n\n## Choosing a Method\n\n- **Email & Password** — Best for most apps. Users expect it. Always offer alongside social.\n- **Social Sign-on** — Reduces friction. Great for B2C apps. Use Google + GitHub at minimum.\n- **Magic Link** — Passwordless simplicity. Good for internal tools and dashboards.\n- **Passkeys** — Most secure. Growing browser support. Great as a 2FA fallback.\n\n---\n\n## Deep Dives\n\n- [Social Sign-on](/docs/authentication/social-sign-on) — Google, GitHub, Discord, and 20+ providers\n- [Email Verification](/docs/authentication/email-verification) — Verify user emails with tokens\n';
const __vite_glob_0_2 = '---\ntitle: "Social Sign-on"\ndescription: "Set up OAuth social login with Google, GitHub, Discord, and more."\nicon: "link"\n---\n\n# Social Sign-on\n\nBetter Auth supports 20+ social providers via OAuth 2.0. Users can sign in with a single click — no password required.\n\n## Supported Providers\n\n| Provider    | ID          | Documentation                                                            |\n| ----------- | ----------- | ------------------------------------------------------------------------ |\n| Google      | `google`    | [console.cloud.google.com](https://console.cloud.google.com)             |\n| GitHub      | `github`    | [github.com/settings/developers](https://github.com/settings/developers) |\n| Discord     | `discord`   | [discord.com/developers](https://discord.com/developers)                 |\n| Apple       | `apple`     | [developer.apple.com](https://developer.apple.com)                       |\n| Microsoft   | `microsoft` | [portal.azure.com](https://portal.azure.com)                             |\n| Twitter / X | `twitter`   | [developer.twitter.com](https://developer.twitter.com)                   |\n| Facebook    | `facebook`  | [developers.facebook.com](https://developers.facebook.com)               |\n| LinkedIn    | `linkedin`  | [linkedin.com/developers](https://linkedin.com/developers)               |\n| Spotify     | `spotify`   | [developer.spotify.com](https://developer.spotify.com)                   |\n| Twitch      | `twitch`    | [dev.twitch.tv](https://dev.twitch.tv)                                   |\n\n## Configuration\n\n### Server-Side\n\nAdd providers to your auth config:\n\n```ts\nexport const auth = betterAuth({\n  socialProviders: {\n    google: {\n      clientId: process.env.GOOGLE_CLIENT_ID!,\n      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,\n    },\n    github: {\n      clientId: process.env.GITHUB_CLIENT_ID!,\n      clientSecret: process.env.GITHUB_CLIENT_SECRET!,\n    },\n    discord: {\n      clientId: process.env.DISCORD_CLIENT_ID!,\n      clientSecret: process.env.DISCORD_CLIENT_SECRET!,\n    },\n  },\n});\n```\n\n### Client-Side\n\nTrigger social sign-in from your UI:\n\n```tsx\nimport { signIn } from "@/lib/auth-client";\n\nfunction SignInButtons() {\n  return (\n    <div className="flex flex-col gap-3">\n      <button onClick={() => signIn.social({ provider: "google" })}>Continue with Google</button>\n      <button onClick={() => signIn.social({ provider: "github" })}>Continue with GitHub</button>\n      <button onClick={() => signIn.social({ provider: "discord" })}>Continue with Discord</button>\n    </div>\n  );\n}\n```\n\n## Setting Up Google OAuth\n\n1. Go to [Google Cloud Console](https://console.cloud.google.com)\n2. Create a new project or select an existing one\n3. Navigate to **APIs & Services → Credentials**\n4. Click **Create Credentials → OAuth Client ID**\n5. Select **Web application**\n6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`\n7. Copy the **Client ID** and **Client Secret** to your `.env`\n\n```bash\nGOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"\nGOOGLE_CLIENT_SECRET="your-client-secret"\n```\n\n## Setting Up GitHub OAuth\n\n1. Go to [GitHub Developer Settings](https://github.com/settings/developers)\n2. Click **New OAuth App**\n3. Set **Homepage URL** to `http://localhost:3000`\n4. Set **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`\n5. Copy the **Client ID** and generate a **Client Secret**\n\n```bash\nGITHUB_CLIENT_ID="your-client-id"\nGITHUB_CLIENT_SECRET="your-client-secret"\n```\n\n## Account Linking\n\nWhen a user signs in with a social provider and already has an account with the same email, Better Auth automatically links the accounts:\n\n```ts\nexport const auth = betterAuth({\n  account: {\n    accountLinking: {\n      enabled: true,\n      trustedProviders: ["google", "github"],\n    },\n  },\n});\n```\n\n> **Note:** Only enable account linking for providers you trust to verify email addresses. This prevents account takeover attacks.\n\n## Custom Scopes\n\nRequest additional permissions from providers:\n\n```ts\nexport const auth = betterAuth({\n  socialProviders: {\n    google: {\n      clientId: process.env.GOOGLE_CLIENT_ID!,\n      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,\n      scopes: ["profile", "email", "https://www.googleapis.com/auth/calendar"],\n    },\n  },\n});\n```\n';
const __vite_glob_0_3 = '---\ntitle: "Basic Usage"\ndescription: "Learn the fundamental auth flows — sign up, sign in, and session management."\nicon: "rocket"\n---\n\n# Basic Usage\n\nThis guide covers the essential authentication flows: creating accounts, signing in, managing sessions, and protecting routes.\n\n## Create the Auth Client\n\nOn the client side, create an auth client that communicates with your API:\n\n```ts title="lib/auth-client.ts"\nimport { createAuthClient } from "better-auth/react";\n\nexport const authClient = createAuthClient({\n  baseURL: "http://localhost:3000",\n});\n\nexport const { signIn, signUp, signOut, useSession } = authClient;\n```\n\n## Sign Up\n\nCreate a new user with email and password:\n\n```tsx title="sign-up.tsx"\nimport { signUp } from "@/lib/auth-client";\n\nasync function handleSignUp() {\n  const { data, error } = await signUp.email({\n    email: "user@example.com",\n    password: "securepassword123",\n    name: "John Doe",\n  });\n\n  if (error) {\n    console.error("Sign up failed:", error.message);\n    return;\n  }\n\n  console.log("User created:", data.user);\n}\n```\n\n## Sign In\n\n### Email & Password\n\n```tsx title="sign-in.tsx"\nimport { signIn } from "@/lib/auth-client";\n\nasync function handleSignIn() {\n  const { data, error } = await signIn.email({\n    email: "user@example.com",\n    password: "securepassword123",\n  });\n\n  if (error) {\n    console.error("Sign in failed:", error.message);\n    return;\n  }\n\n  // User is now signed in\n  console.log("Session:", data.session);\n}\n```\n\n### Social Sign-In\n\n```tsx\nimport { signIn } from "@/lib/auth-client";\n\n// Google\nawait signIn.social({ provider: "google" });\n\n// GitHub\nawait signIn.social({ provider: "github" });\n```\n\n## Session Management\n\n### Get Current Session\n\nUse the `useSession` hook in React components:\n\n```tsx title="profile.tsx"\nimport { useSession } from "@/lib/auth-client";\n\nfunction Profile() {\n  const { data: session, isPending } = useSession();\n\n  if (isPending) return <div>Loading...</div>;\n  if (!session) return <div>Not signed in</div>;\n\n  return (\n    <div>\n      <h1>Welcome, {session.user.name}</h1>\n      <p>{session.user.email}</p>\n    </div>\n  );\n}\n```\n\n### Sign Out\n\n```tsx\nimport { signOut } from "@/lib/auth-client";\n\nasync function handleSignOut() {\n  await signOut();\n  // User is now signed out\n}\n```\n\n## Protecting Routes\n\n### Server-Side (Next.js)\n\n```ts title="lib/session.ts"\nimport { auth } from "@/auth";\nimport { headers } from "next/headers";\n\nexport async function getServerSession() {\n  const session = await auth.api.getSession({\n    headers: await headers(),\n  });\n  return session;\n}\n```\n\nUse it in a server component:\n\n```tsx title="app/dashboard/page.tsx"\nimport { getServerSession } from "@/lib/session";\nimport { redirect } from "next/navigation";\n\nexport default async function DashboardPage() {\n  const session = await getServerSession();\n\n  if (!session) {\n    redirect("/sign-in");\n  }\n\n  return <Dashboard user={session.user} />;\n}\n```\n\n### Client-Side Guard\n\n```tsx title="components/auth-guard.tsx"\n"use client";\n\nimport { useSession } from "@/lib/auth-client";\nimport { useRouter } from "next/navigation";\nimport { useEffect } from "react";\n\nexport function AuthGuard({ children }: { children: React.ReactNode }) {\n  const { data: session, isPending } = useSession();\n  const router = useRouter();\n\n  useEffect(() => {\n    if (!isPending && !session) {\n      router.push("/sign-in");\n    }\n  }, [session, isPending, router]);\n\n  if (isPending) return <div>Loading...</div>;\n  if (!session) return null;\n\n  return <>{children}</>;\n}\n```\n\n---\n\n## Quick Reference\n\n| Action           | Method                                    |\n| ---------------- | ----------------------------------------- |\n| Sign up          | `signUp.email({ email, password, name })` |\n| Sign in (email)  | `signIn.email({ email, password })`       |\n| Sign in (social) | `signIn.social({ provider })`             |\n| Get session      | `useSession()` hook                       |\n| Sign out         | `signOut()`                               |\n| Server session   | `auth.api.getSession({ headers })`        |\n\n---\n\n## Next Steps\n\n- Learn about [Session Management](/docs/concepts/session-management) in depth\n- Set up [Social Sign-on](/docs/authentication/social-sign-on) providers\n- Add [Two Factor Authentication](/docs/plugins/two-factor) for extra security\n';
const __vite_glob_0_4 = '---\ntitle: Database\ndescription: Database adapters and schema management in Better Auth.\n---\n\n# Database\n\nBetter Auth supports multiple database adapters and automatically manages your schema.\n\n## Supported Databases\n\n| Database   | Adapter  | Status |\n| ---------- | -------- | ------ |\n| PostgreSQL | Built-in | Stable |\n| MySQL      | Built-in | Stable |\n| SQLite     | Built-in | Stable |\n| MongoDB    | Plugin   | Stable |\n\n## Configuration\n\n```ts\nimport { betterAuth } from "better-auth";\n\nexport const auth = betterAuth({\n  database: {\n    provider: "postgresql",\n    url: process.env.DATABASE_URL,\n  },\n});\n```\n\n## Using with Prisma\n\n```ts\nimport { betterAuth } from "better-auth";\nimport { prismaAdapter } from "better-auth/adapters/prisma";\nimport { PrismaClient } from "@prisma/client";\n\nconst prisma = new PrismaClient();\n\nexport const auth = betterAuth({\n  database: prismaAdapter(prisma),\n});\n```\n\n## Using with Drizzle\n\n```ts\nimport { betterAuth } from "better-auth";\nimport { drizzleAdapter } from "better-auth/adapters/drizzle";\nimport { db } from "./db";\n\nexport const auth = betterAuth({\n  database: drizzleAdapter(db),\n});\n```\n\n> **Note:** When using Prisma, run `npx @better-auth/cli generate --prisma` to generate Prisma schema additions instead of raw SQL.\n\n## Schema\n\nBetter Auth creates these tables automatically:\n\n- **user** — User profiles\n- **session** — Active sessions\n- **account** — OAuth accounts linked to users\n- **verification** — Email verification tokens\n';
const __vite_glob_0_5 = "---\ntitle: Concepts\ndescription: Core concepts and architecture of Better Auth.\nicon: lightbulb\n---\n\n# Concepts\n\nUnderstanding the core concepts behind Better Auth will help you make the most of the framework.\n\n## Architecture\n\nBetter Auth follows a modular architecture with these key components:\n\n- **Auth Instance** — The core server-side object that handles all auth operations\n- **Auth Client** — A client-side helper for interacting with the auth API\n- **Database Adapter** — Connects to your database for storing users, sessions, and accounts\n- **Plugins** — Extend functionality without modifying the core\n\n## Request Flow\n\n1. Client sends a request (sign-in, sign-up, etc.)\n2. Auth instance validates the request\n3. Database adapter reads/writes data\n4. Session is created and returned\n5. Client stores the session token\n\n---\n\n## Deep Dives\n\n- [Session Management](/docs/concepts/session-management) — How sessions work\n- [Database](/docs/concepts/database) — Database adapters and schema\n";
const __vite_glob_0_6 = '---\ntitle: Session Management\ndescription: How sessions work in Better Auth.\n---\n\n# Session Management\n\nBetter Auth uses a token-based session system that\'s secure, scalable, and easy to use.\n\n## How Sessions Work\n\nWhen a user signs in:\n\n1. A session record is created in the database\n2. A session token is generated (cryptographically secure random string)\n3. The token is stored in an HTTP-only cookie\n4. Subsequent requests include the cookie automatically\n\n## Session Configuration\n\n```ts title="auth.ts"\nexport const auth = betterAuth({\n  session: {\n    expiresIn: 60 * 60 * 24 * 7, // 7 days\n    updateAge: 60 * 60 * 24, // refresh every 24 hours\n  },\n});\n```\n\n## Checking Sessions\n\n### Server-Side\n\n```ts\nconst session = await auth.api.getSession({\n  headers: request.headers,\n});\n```\n\n### Client-Side\n\n```ts\nconst session = await authClient.getSession();\n```\n\n> **Note:** Always use HTTPS in production. Better Auth automatically sets the `Secure` cookie flag when `NODE_ENV=production`.\n\n## Revoking Sessions\n\n```ts\n// Revoke current session\nawait authClient.signOut();\n\n// Revoke all sessions for the user\nawait authClient.revokeAllSessions();\n```\n';
const __vite_glob_0_7 = '---\ntitle: Get Started\ndescription: Build your first authentication flow with Better Auth.\nicon: rocket\n---\n\n# Get Started\n\nThis guide walks you through building a complete sign-up and sign-in flow using Better Auth.\n\n## Create the Auth Client\n\nFirst, create a client-side auth helper:\n\n```ts\nimport { createAuthClient } from "better-auth/client";\n\nexport const authClient = createAuthClient({\n  baseURL: "http://localhost:3000",\n});\n```\n\n## Sign Up\n\nCreate a sign-up form that calls the auth client:\n\n```ts\nconst { data, error } = await authClient.signUp.email({\n  email: "user@example.com",\n  password: "securePassword123",\n  name: "John Doe",\n});\n\nif (error) {\n  console.error("Sign-up failed:", error.message);\n} else {\n  console.log("User created:", data.user);\n}\n```\n\n## Sign In\n\nAfter registration, users can sign in:\n\n```ts\nconst { data, error } = await authClient.signIn.email({\n  email: "user@example.com",\n  password: "securePassword123",\n});\n\nif (data) {\n  console.log("Signed in:", data.session);\n}\n```\n\n## Get Current Session\n\nCheck the current user\'s session:\n\n```ts\nconst session = await authClient.getSession();\n\nif (session) {\n  console.log("Current user:", session.user.name);\n} else {\n  console.log("Not authenticated");\n}\n```\n\n## Sign Out\n\n```ts\nawait authClient.signOut();\n```\n\n---\n\n## Next Steps\n\n- Learn about [Session Management](/docs/concepts/session-management)\n- Set up a [Database](/docs/concepts/database)\n';
const __vite_glob_0_8 = '---\ntitle: Installation\ndescription: Install and configure Better Auth in your project.\nicon: terminal\n---\n\n# Installation\n\nGetting started with Better Auth takes just a few minutes. This guide walks you through installing the package, setting up your database, and creating your first auth instance.\n\n## Prerequisites\n\nBefore you begin, make sure you have:\n\n- **Node.js** 18 or later\n- **A database** — PostgreSQL, MySQL, SQLite, or MongoDB\n- **A package manager** — npm, yarn, pnpm, or bun\n\n## Install the Package\n\n<Tabs items={["npm", "yarn", "pnpm", "bun"]}>\n<Tab value="npm">\n```bash\n    npm install better-auth\n    ```\n</Tab>\n<Tab value="yarn">\n```bash\n    yarn add better-auth\n    ```\n</Tab>\n<Tab value="pnpm">\n```bash\n    pnpm add better-auth\n    ```\n</Tab>\n<Tab value="bun">\n```bash\n    bun add better-auth\n    ```\n</Tab>\n</Tabs>\n\n## Set Up Environment Variables\n\nCreate a `.env` file in your project root:\n\n```bash\n# Database connection\nDATABASE_URL="postgresql://user:password@localhost:5432/mydb"\n\n# Auth secret (generate with: openssl rand -base64 32)\nBETTER_AUTH_SECRET="your-secret-key-here"\n\n# Base URL of your application\nBETTER_AUTH_URL="http://localhost:3000"\n```\n\n> **Note:** Never commit your `.env` file to version control. Add it to your `.gitignore`.\n\n## Create Auth Instance\n\nCreate an `auth.ts` file in your project:\n\n```ts\nimport { betterAuth } from "better-auth";\n\nexport const auth = betterAuth({\n  database: {\n    provider: "postgresql",\n    url: process.env.DATABASE_URL,\n  },\n  emailAndPassword: {\n    enabled: true,\n  },\n});\n```\n\n## Verify Installation\n\nStart your development server and visit:\n\n```\nhttp://localhost:3000/api/auth/ok\n```\n\nYou should see a JSON response confirming the auth server is running:\n\n```json\n{ "ok": true }\n```\n\n---\n\n## Next Steps\n\n- Follow the [Get Started](/docs/get-started) guide\n- Learn about [Session Management](/docs/concepts/session-management)\n';
const __vite_glob_0_9 = '---\ntitle: "Integrations"\ndescription: "Framework integrations — Next.js, Nuxt, SvelteKit, Astro, and more."\nicon: "file"\n---\n\n# Integrations\n\nBetter Auth is framework-agnostic but provides first-class integrations for popular frameworks.\n\n## Supported Frameworks\n\n| Framework        | Handler              | Client SDK                     |\n| ---------------- | -------------------- | ------------------------------ |\n| **Next.js**      | `toNextJsHandler`    | `better-auth/react`            |\n| **Nuxt**         | `toH3Handler`        | `better-auth/vue`              |\n| **SvelteKit**    | `toSvelteKitHandler` | `better-auth/svelte`           |\n| **Astro**        | Built-in support     | `better-auth/react` or vanilla |\n| **Express**      | `toNodeHandler`      | Any client SDK                 |\n| **Hono**         | `toHonoHandler`      | Any client SDK                 |\n| **Elysia (Bun)** | `toElysiaHandler`    | Any client SDK                 |\n| **Fastify**      | `toNodeHandler`      | Any client SDK                 |\n\n## Next.js\n\n### API Route\n\n```ts\n// app/api/auth/[...all]/route.ts\nimport { auth } from "@/auth";\nimport { toNextJsHandler } from "better-auth/next-js";\n\nexport const { GET, POST } = toNextJsHandler(auth);\n```\n\n### Middleware\n\n```ts\n// middleware.ts\nimport { NextResponse } from "next/server";\nimport type { NextRequest } from "next/server";\n\nexport async function middleware(request: NextRequest) {\n  const session = request.cookies.get("better-auth.session_token");\n\n  if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {\n    return NextResponse.redirect(new URL("/sign-in", request.url));\n  }\n\n  return NextResponse.next();\n}\n\nexport const config = {\n  matcher: ["/dashboard/:path*"],\n};\n```\n\n### Server Components\n\n```tsx\nimport { auth } from "@/auth";\nimport { headers } from "next/headers";\n\nexport default async function Page() {\n  const session = await auth.api.getSession({\n    headers: await headers(),\n  });\n\n  return <div>Hello, {session?.user.name ?? "Guest"}!</div>;\n}\n```\n\n## Nuxt\n\n### Server Plugin\n\n```ts\n// server/plugins/auth.ts\nimport { auth } from "~/auth";\nimport { toH3Handler } from "better-auth/h3";\n\nexport default defineNitroPlugin((nitroApp) => {\n  nitroApp.h3App.use("/api/auth/**", toH3Handler(auth));\n});\n```\n\n### Composable\n\n```vue\n<script setup lang="ts">\nimport { useSession } from "better-auth/vue";\n\nconst { data: session, pending } = useSession();\n<\/script>\n\n<template>\n  <div v-if="pending">Loading...</div>\n  <div v-else-if="session">Hello, {{ session.user.name }}!</div>\n  <div v-else>Not signed in</div>\n</template>\n```\n\n## Express / Node.js\n\n```ts\nimport express from "express";\nimport { auth } from "./auth";\nimport { toNodeHandler } from "better-auth/node";\n\nconst app = express();\n\n// Mount auth handler\napp.all("/api/auth/*", toNodeHandler(auth));\n\n// Protected route example\napp.get("/api/me", async (req, res) => {\n  const session = await auth.api.getSession({\n    headers: req.headers,\n  });\n\n  if (!session) {\n    return res.status(401).json({ error: "Unauthorized" });\n  }\n\n  res.json({ user: session.user });\n});\n\napp.listen(3000);\n```\n\n## Hono\n\n```ts\nimport { Hono } from "hono";\nimport { auth } from "./auth";\n\nconst app = new Hono();\n\napp.on(["POST", "GET"], "/api/auth/**", (c) => {\n  return auth.handler(c.req.raw);\n});\n\nexport default app;\n```\n\n## SvelteKit\n\n### Server Hook\n\n```ts\n// src/hooks.server.ts\nimport { auth } from "$lib/auth";\n\nexport async function handle({ event, resolve }) {\n  const session = await auth.api.getSession({\n    headers: event.request.headers,\n  });\n\n  event.locals.session = session;\n  return resolve(event);\n}\n```\n\n### Page\n\n```svelte\n<script>\n  import { useSession } from "better-auth/svelte";\n  const session = useSession();\n<\/script>\n\n{#if $session}\n  <p>Welcome, {$session.user.name}!</p>\n{:else}\n  <p>Please sign in.</p>\n{/if}\n```\n';
const __vite_glob_0_10 = '---\ntitle: Introduction\ndescription: A comprehensive authentication and authorization framework for TypeScript.\nicon: book\n---\n\n# Introduction\n\nBetter Auth is a framework-agnostic, universal authentication and authorization framework for TypeScript. It provides a comprehensive set of features out of the box and includes a plugin ecosystem that simplifies adding advanced functionalities.\n\n## Features\n\n- **Framework Agnostic** — Support for most popular frameworks\n- **Email & Password** — Built-in support for secure email and password authentication\n- **Account & Session Management** — Manage user accounts and sessions with ease\n- **Built-In Rate Limiter** — Built-in rate limiter with custom rules\n- **Automatic Database Management** — Automatic database management and migrations\n- **Social Sign-on** — Multiple social sign-on providers\n- **Plugin Ecosystem** — Even more capabilities with plugins\n\n---\n\n## Quick Start\n\nGet up and running in under 5 minutes:\n\n```bash\nnpm install better-auth\n```\n\n```ts\nimport { betterAuth } from "better-auth";\n\nexport const auth = betterAuth({\n  database: {\n    provider: "postgresql",\n    url: process.env.DATABASE_URL,\n  },\n  emailAndPassword: {\n    enabled: true,\n  },\n});\n```\n\n---\n\n## Next Steps\n\n- Read the [Installation](/docs/installation) guide\n- Follow the [Get Started](/docs/get-started) guide\n- Explore [Concepts](/docs/concepts)\n';
const __vite_glob_0_11 = '---\ntitle: "Organizations"\ndescription: "Multi-tenant organization management with roles and invitations."\n---\n\n# Organizations\n\nThe organizations plugin adds multi-tenant support to your app. Users can create organizations, invite members, assign roles, and manage teams.\n\n## Setup\n\n```ts\nimport { betterAuth } from "better-auth";\nimport { organization } from "better-auth/plugins";\n\nexport const auth = betterAuth({\n  plugins: [\n    organization({\n      allowUserToCreateOrganization: true,\n      maximumOrganizations: 5, // Per user\n      roles: {\n        owner: {\n          permissions: ["*"], // All permissions\n        },\n        admin: {\n          permissions: ["member:read", "member:invite", "member:remove", "organization:update"],\n        },\n        member: {\n          permissions: ["member:read"],\n        },\n      },\n    }),\n  ],\n});\n```\n\n## Client Setup\n\n```ts\nimport { createAuthClient } from "better-auth/react";\nimport { organizationClient } from "better-auth/client/plugins";\n\nexport const authClient = createAuthClient({\n  plugins: [organizationClient()],\n});\n```\n\n## Creating an Organization\n\n```tsx\nconst { data: org, error } = await authClient.organization.create({\n  name: "Acme Inc",\n  slug: "acme",\n  metadata: {\n    plan: "pro",\n    industry: "saas",\n  },\n});\n\nconsole.log("Created:", org.name); // "Acme Inc"\n```\n\n## Inviting Members\n\n```tsx\n// Invite by email\nconst { data: invitation } = await authClient.organization.inviteMember({\n  organizationId: org.id,\n  email: "colleague@example.com",\n  role: "member",\n});\n\n// The invited user receives an email with an accept link\n```\n\n### Accept an Invitation\n\n```tsx\nconst { data } = await authClient.organization.acceptInvitation({\n  invitationId: "invitation-id",\n});\n```\n\n## Managing Members\n\n### List Members\n\n```tsx\nconst { data: members } = await authClient.organization.listMembers({\n  organizationId: org.id,\n});\n\nmembers.forEach((member) => {\n  console.log(`${member.user.name} — ${member.role}`);\n});\n```\n\n### Update Member Role\n\n```tsx\nawait authClient.organization.updateMemberRole({\n  organizationId: org.id,\n  memberId: "member-id",\n  role: "admin",\n});\n```\n\n### Remove a Member\n\n```tsx\nawait authClient.organization.removeMember({\n  organizationId: org.id,\n  memberId: "member-id",\n});\n```\n\n## Active Organization\n\nUsers can be part of multiple organizations. Set the active one:\n\n```tsx\n// Set active organization\nawait authClient.organization.setActive({\n  organizationId: org.id,\n});\n\n// Get active organization\nconst { data: activeOrg } = await authClient.useActiveOrganization();\n```\n\n## Server-Side Usage\n\n### Check Organization Membership\n\n```ts\nconst session = await auth.api.getSession({ headers });\nconst membership = await auth.api.getOrganizationMember({\n  organizationId: "org-id",\n  userId: session.user.id,\n});\n\nif (!membership) {\n  throw new Error("Access denied");\n}\n\nif (membership.role !== "admin" && membership.role !== "owner") {\n  throw new Error("Insufficient permissions");\n}\n```\n\n## Database Schema\n\nThe plugin adds these tables:\n\n| Table          | Description                                 |\n| -------------- | ------------------------------------------- |\n| `organization` | Organization details (name, slug, metadata) |\n| `member`       | User-organization relationship with roles   |\n| `invitation`   | Pending invitations                         |\n\n## Permissions\n\nDefine custom permissions per role:\n\n```ts\norganization({\n  roles: {\n    owner: { permissions: ["*"] },\n    admin: {\n      permissions: [\n        "member:read",\n        "member:invite",\n        "member:remove",\n        "project:create",\n        "project:read",\n        "project:update",\n        "project:delete",\n        "billing:read",\n        "billing:update",\n      ],\n    },\n    viewer: {\n      permissions: ["member:read", "project:read"],\n    },\n  },\n});\n```\n\nCheck permissions:\n\n```ts\nconst hasPermission = await auth.api.hasPermission({\n  organizationId: "org-id",\n  userId: session.user.id,\n  permission: "project:delete",\n});\n```\n';
const __vite_glob_0_12 = '---\ntitle: "Plugins"\ndescription: "Extend Better Auth with powerful plugins — 2FA, organizations, passkeys, and more."\nicon: "folder"\n---\n\n# Plugins\n\nBetter Auth\'s plugin system lets you add powerful features without bloating the core. Each plugin is self-contained with its own database schema, API endpoints, and client-side utilities.\n\n## How Plugins Work\n\nPlugins hook into Better Auth\'s lifecycle:\n\n```ts\nimport { betterAuth } from "better-auth";\nimport { twoFactor } from "better-auth/plugins";\nimport { organization } from "better-auth/plugins";\n\nexport const auth = betterAuth({\n  plugins: [\n    twoFactor({\n      issuer: "MyApp",\n    }),\n    organization({\n      allowUserToCreateOrganization: true,\n    }),\n  ],\n});\n```\n\nEach plugin can:\n\n- **Add API endpoints** — e.g., `/api/auth/two-factor/verify`\n- **Extend the database schema** — e.g., add an `organization` table\n- **Add client-side utilities** — e.g., `authClient.twoFactor.verify()`\n- **Hook into auth events** — e.g., run custom logic after sign-in\n\n## Available Plugins\n\n### Authentication\n\n| Plugin                                 | Description                                  |\n| -------------------------------------- | -------------------------------------------- |\n| [Two Factor](/docs/plugins/two-factor) | TOTP, SMS, and backup codes                  |\n| Passkey                                | WebAuthn / FIDO2 passwordless authentication |\n| Magic Link                             | Passwordless email authentication            |\n| Phone Number                           | SMS-based authentication                     |\n| Anonymous                              | Allow anonymous/guest users                  |\n\n### Authorization & Access Control\n\n| Plugin                                       | Description                          |\n| -------------------------------------------- | ------------------------------------ |\n| [Organizations](/docs/plugins/organizations) | Multi-tenant organization management |\n| Admin                                        | Admin dashboard and user management  |\n| RBAC                                         | Role-based access control            |\n\n### Enterprise\n\n| Plugin        | Description                                   |\n| ------------- | --------------------------------------------- |\n| OIDC Provider | Turn your app into an OpenID Connect provider |\n| SAML          | Enterprise SSO with SAML 2.0                  |\n| SCIM          | Automated user provisioning                   |\n\n### Utilities\n\n| Plugin     | Description                        |\n| ---------- | ---------------------------------- |\n| Rate Limit | Advanced rate limiting rules       |\n| Captcha    | Bot protection with CAPTCHA        |\n| Webhook    | Real-time auth event notifications |\n\n## Client-Side Plugin Setup\n\nPlugins that add client-side features need to be registered on the auth client too:\n\n```ts\nimport { createAuthClient } from "better-auth/react";\nimport { twoFactorClient } from "better-auth/client/plugins";\nimport { organizationClient } from "better-auth/client/plugins";\n\nexport const authClient = createAuthClient({\n  plugins: [twoFactorClient(), organizationClient()],\n});\n```\n\n## Creating Custom Plugins\n\nYou can build your own plugins:\n\n```ts\nimport { createAuthPlugin } from "better-auth";\n\nexport const myPlugin = createAuthPlugin({\n  id: "my-plugin",\n  init: (ctx) => {\n    return {\n      endpoints: {\n        myEndpoint: {\n          path: "/my-plugin/action",\n          method: "POST",\n          handler: async (req) => {\n            // Your custom logic\n            return { success: true };\n          },\n        },\n      },\n      hooks: {\n        after: [\n          {\n            matcher: (ctx) => ctx.path === "/sign-in",\n            handler: async (ctx) => {\n              // Run after sign-in\n              console.log("User signed in:", ctx.session.user.name);\n            },\n          },\n        ],\n      },\n    };\n  },\n});\n```\n\n---\n\n## Deep Dives\n\n- [Two Factor Authentication](/docs/plugins/two-factor) — TOTP setup and verification\n- [Organizations](/docs/plugins/organizations) — Multi-tenant team management\n';
const __vite_glob_0_13 = '---\ntitle: "Two Factor Authentication"\ndescription: "Add TOTP-based two factor authentication with backup codes."\n---\n\n# Two Factor Authentication\n\nTwo factor authentication (2FA) adds an extra layer of security by requiring users to provide a second form of verification beyond their password.\n\n## Installation\n\nThe 2FA plugin is included in the Better Auth package:\n\n```ts\nimport { betterAuth } from "better-auth";\nimport { twoFactor } from "better-auth/plugins";\n\nexport const auth = betterAuth({\n  plugins: [\n    twoFactor({\n      issuer: "MyApp", // Shows in authenticator apps\n      backupCodes: {\n        enabled: true,\n        count: 10, // Number of backup codes\n        length: 8, // Length of each code\n      },\n    }),\n  ],\n});\n```\n\n## Client Setup\n\n```ts\nimport { createAuthClient } from "better-auth/react";\nimport { twoFactorClient } from "better-auth/client/plugins";\n\nexport const authClient = createAuthClient({\n  plugins: [twoFactorClient()],\n});\n```\n\n## Enabling 2FA for a User\n\n### Step 1: Generate TOTP Secret\n\n```tsx\nconst { data } = await authClient.twoFactor.enable();\n\n// data.totpURI — Use this to generate a QR code\n// data.backupCodes — Show these to the user (one time only!)\n```\n\n### Step 2: Show QR Code\n\n```tsx\nimport QRCode from "qrcode.react";\n\nfunction Setup2FA({ totpURI }: { totpURI: string }) {\n  return (\n    <div>\n      <h2>Scan this QR code with your authenticator app</h2>\n      <QRCode value={totpURI} size={200} />\n      <p>Supported apps: Google Authenticator, Authy, 1Password</p>\n    </div>\n  );\n}\n```\n\n### Step 3: Verify Initial Code\n\n```tsx\nconst { data, error } = await authClient.twoFactor.verifyTotp({\n  code: "123456", // Code from authenticator app\n});\n\nif (error) {\n  console.error("Invalid code");\n} else {\n  console.log("2FA enabled successfully!");\n}\n```\n\n## Sign-In with 2FA\n\nWhen 2FA is enabled, sign-in becomes a two-step process:\n\n```tsx\n// Step 1: Email & Password\nconst result = await signIn.email({\n  email: "user@example.com",\n  password: "password123",\n});\n\n// If 2FA is enabled, result.twoFactorRequired will be true\nif (result.data?.twoFactorRequired) {\n  // Step 2: Show TOTP input\n  const { data, error } = await authClient.twoFactor.verifyTotp({\n    code: userEnteredCode,\n  });\n}\n```\n\n## Backup Codes\n\nBackup codes allow users to sign in if they lose access to their authenticator app:\n\n```tsx\n// Use a backup code instead of TOTP\nconst { data, error } = await authClient.twoFactor.verifyBackupCode({\n  code: "ABCD-1234",\n});\n```\n\n### Regenerate Backup Codes\n\n```tsx\nconst { data } = await authClient.twoFactor.generateBackupCodes();\n// data.backupCodes — new set of codes (previous ones are invalidated)\n```\n\n> **Note:** Always remind users to save their backup codes in a secure location. They cannot be retrieved after the initial display.\n\n## Disabling 2FA\n\n```tsx\nconst { error } = await authClient.twoFactor.disable({\n  password: "current-password", // Require password confirmation\n});\n```\n\n## Configuration Reference\n\n| Option                | Type      | Default  | Description                         |\n| --------------------- | --------- | -------- | ----------------------------------- |\n| `issuer`              | `string`  | required | Name shown in authenticator apps    |\n| `period`              | `number`  | `30`     | TOTP code rotation period (seconds) |\n| `digits`              | `number`  | `6`      | Number of digits in TOTP code       |\n| `algorithm`           | `string`  | `"SHA1"` | Hash algorithm                      |\n| `backupCodes.enabled` | `boolean` | `true`   | Enable backup codes                 |\n| `backupCodes.count`   | `number`  | `10`     | Number of backup codes              |\n| `backupCodes.length`  | `number`  | `8`      | Length of each backup code          |\n';
const __vite_glob_0_14 = '---\ntitle: "API Reference"\ndescription: "Complete API reference for Better Auth — server, client, and plugins."\nicon: "file"\n---\n\n# API Reference\n\nComplete reference for the Better Auth API. Covers the server-side auth instance, client SDK, and API endpoints.\n\n## Server API\n\n### `betterAuth(config)`\n\nCreates an auth instance with the given configuration.\n\n```ts\nimport { betterAuth } from "better-auth";\n\nconst auth = betterAuth({\n  database: { provider: "postgresql", url: "..." },\n  emailAndPassword: { enabled: true },\n  socialProviders: {\n    /* ... */\n  },\n  plugins: [\n    /* ... */\n  ],\n  session: {\n    /* ... */\n  },\n});\n```\n\n### `auth.api`\n\nThe server-side API object. Use this in server components, API routes, and middleware.\n\n| Method                                  | Description                    |\n| --------------------------------------- | ------------------------------ |\n| `getSession({ headers })`               | Get the current session        |\n| `createUser({ email, password, name })` | Create a new user              |\n| `deleteUser({ userId })`                | Delete a user                  |\n| `listUsers({ limit, offset })`          | List all users                 |\n| `revokeSession({ sessionId })`          | Revoke a specific session      |\n| `revokeAllSessions({ userId })`         | Revoke all sessions for a user |\n\n### `auth.handler`\n\nThe request handler. Mount this on your API route:\n\n```ts\n// Works with any Request → Response handler\nconst response = await auth.handler(request);\n```\n\n## Client API\n\n### `createAuthClient(options)`\n\nCreates a client-side auth client.\n\n```ts\nimport { createAuthClient } from "better-auth/react";\n\nconst authClient = createAuthClient({\n  baseURL: "http://localhost:3000",\n  plugins: [\n    /* client plugins */\n  ],\n});\n```\n\n### Sign Up\n\n```ts\nconst { data, error } = await authClient.signUp.email({\n  email: string,\n  password: string,\n  name: string,\n  image?: string,\n  callbackURL?: string,\n});\n```\n\n### Sign In\n\n```ts\n// Email & Password\nconst { data, error } = await authClient.signIn.email({\n  email: string,\n  password: string,\n  callbackURL?: string,\n  rememberMe?: boolean,\n});\n\n// Social\nawait authClient.signIn.social({\n  provider: "google" | "github" | "discord" | /* ... */,\n  callbackURL?: string,\n});\n```\n\n### Sign Out\n\n```ts\nawait authClient.signOut({\n  fetchOptions: { onSuccess: () => router.push("/") },\n});\n```\n\n### Session\n\n```tsx\n// React hook\nconst { data: session, isPending, error } = authClient.useSession();\n\n// Direct fetch\nconst session = await authClient.getSession();\n```\n\n## REST API Endpoints\n\nBetter Auth exposes these HTTP endpoints:\n\n### Authentication\n\n| Method | Path                           | Description                  |\n| ------ | ------------------------------ | ---------------------------- |\n| `POST` | `/api/auth/sign-up/email`      | Register with email/password |\n| `POST` | `/api/auth/sign-in/email`      | Sign in with email/password  |\n| `POST` | `/api/auth/sign-in/social`     | Initiate social sign-in      |\n| `GET`  | `/api/auth/callback/:provider` | OAuth callback handler       |\n| `POST` | `/api/auth/sign-out`           | Sign out current session     |\n| `GET`  | `/api/auth/session`            | Get current session          |\n\n### Email Verification\n\n| Method | Path                                | Description               |\n| ------ | ----------------------------------- | ------------------------- |\n| `GET`  | `/api/auth/verify-email`            | Verify email with token   |\n| `POST` | `/api/auth/send-verification-email` | Resend verification email |\n\n### Password Reset\n\n| Method | Path                        | Description               |\n| ------ | --------------------------- | ------------------------- |\n| `POST` | `/api/auth/forget-password` | Request password reset    |\n| `POST` | `/api/auth/reset-password`  | Reset password with token |\n\n### User Management\n\n| Method   | Path             | Description         |\n| -------- | ---------------- | ------------------- |\n| `GET`    | `/api/auth/user` | Get current user    |\n| `PATCH`  | `/api/auth/user` | Update user profile |\n| `DELETE` | `/api/auth/user` | Delete user account |\n\n## Error Handling\n\nAll API methods return a consistent error shape:\n\n```ts\ninterface AuthError {\n  message: string;\n  code: string;\n  status: number;\n}\n```\n\nCommon error codes:\n\n| Code                  | Status | Description              |\n| --------------------- | ------ | ------------------------ |\n| `USER_NOT_FOUND`      | 404    | User doesn\'t exist       |\n| `INVALID_CREDENTIALS` | 401    | Wrong email or password  |\n| `EMAIL_NOT_VERIFIED`  | 403    | Email not yet verified   |\n| `SESSION_EXPIRED`     | 401    | Session has expired      |\n| `RATE_LIMIT_EXCEEDED` | 429    | Too many requests        |\n| `INVALID_TOKEN`       | 400    | Invalid or expired token |\n\n## TypeScript\n\nBetter Auth is fully typed. You get autocomplete and type safety for:\n\n- Configuration options\n- API responses\n- Session objects\n- Plugin APIs\n- Database schemas\n\n```ts\n// Type-safe session access\nconst session = await auth.api.getSession({ headers });\n//    ^? { user: User; session: Session } | null\n\nsession?.user.name;\n//              ^? string\nsession?.user.email;\n//              ^? string\nsession?.session.expiresAt;\n//                  ^? Date\n```\n';
var kindOf;
var hasRequiredKindOf;
function requireKindOf() {
  if (hasRequiredKindOf) return kindOf;
  hasRequiredKindOf = 1;
  var toString = Object.prototype.toString;
  kindOf = function kindOf2(val) {
    if (val === void 0) return "undefined";
    if (val === null) return "null";
    var type2 = typeof val;
    if (type2 === "boolean") return "boolean";
    if (type2 === "string") return "string";
    if (type2 === "number") return "number";
    if (type2 === "symbol") return "symbol";
    if (type2 === "function") {
      return isGeneratorFn(val) ? "generatorfunction" : "function";
    }
    if (isArray(val)) return "array";
    if (isBuffer(val)) return "buffer";
    if (isArguments(val)) return "arguments";
    if (isDate(val)) return "date";
    if (isError(val)) return "error";
    if (isRegexp(val)) return "regexp";
    switch (ctorName(val)) {
      case "Symbol":
        return "symbol";
      case "Promise":
        return "promise";
      // Set, Map, WeakSet, WeakMap
      case "WeakMap":
        return "weakmap";
      case "WeakSet":
        return "weakset";
      case "Map":
        return "map";
      case "Set":
        return "set";
      // 8-bit typed arrays
      case "Int8Array":
        return "int8array";
      case "Uint8Array":
        return "uint8array";
      case "Uint8ClampedArray":
        return "uint8clampedarray";
      // 16-bit typed arrays
      case "Int16Array":
        return "int16array";
      case "Uint16Array":
        return "uint16array";
      // 32-bit typed arrays
      case "Int32Array":
        return "int32array";
      case "Uint32Array":
        return "uint32array";
      case "Float32Array":
        return "float32array";
      case "Float64Array":
        return "float64array";
    }
    if (isGeneratorObj(val)) {
      return "generator";
    }
    type2 = toString.call(val);
    switch (type2) {
      case "[object Object]":
        return "object";
      // iterators
      case "[object Map Iterator]":
        return "mapiterator";
      case "[object Set Iterator]":
        return "setiterator";
      case "[object String Iterator]":
        return "stringiterator";
      case "[object Array Iterator]":
        return "arrayiterator";
    }
    return type2.slice(8, -1).toLowerCase().replace(/\s/g, "");
  };
  function ctorName(val) {
    return typeof val.constructor === "function" ? val.constructor.name : null;
  }
  function isArray(val) {
    if (Array.isArray) return Array.isArray(val);
    return val instanceof Array;
  }
  function isError(val) {
    return val instanceof Error || typeof val.message === "string" && val.constructor && typeof val.constructor.stackTraceLimit === "number";
  }
  function isDate(val) {
    if (val instanceof Date) return true;
    return typeof val.toDateString === "function" && typeof val.getDate === "function" && typeof val.setDate === "function";
  }
  function isRegexp(val) {
    if (val instanceof RegExp) return true;
    return typeof val.flags === "string" && typeof val.ignoreCase === "boolean" && typeof val.multiline === "boolean" && typeof val.global === "boolean";
  }
  function isGeneratorFn(name, val) {
    return ctorName(name) === "GeneratorFunction";
  }
  function isGeneratorObj(val) {
    return typeof val.throw === "function" && typeof val.return === "function" && typeof val.next === "function";
  }
  function isArguments(val) {
    try {
      if (typeof val.length === "number" && typeof val.callee === "function") {
        return true;
      }
    } catch (err) {
      if (err.message.indexOf("callee") !== -1) {
        return true;
      }
    }
    return false;
  }
  function isBuffer(val) {
    if (val.constructor && typeof val.constructor.isBuffer === "function") {
      return val.constructor.isBuffer(val);
    }
    return false;
  }
  return kindOf;
}
/*!
 * is-extendable <https://github.com/jonschlinkert/is-extendable>
 *
 * Copyright (c) 2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */
var isExtendable;
var hasRequiredIsExtendable;
function requireIsExtendable() {
  if (hasRequiredIsExtendable) return isExtendable;
  hasRequiredIsExtendable = 1;
  isExtendable = function isExtendable2(val) {
    return typeof val !== "undefined" && val !== null && (typeof val === "object" || typeof val === "function");
  };
  return isExtendable;
}
var extendShallow;
var hasRequiredExtendShallow;
function requireExtendShallow() {
  if (hasRequiredExtendShallow) return extendShallow;
  hasRequiredExtendShallow = 1;
  var isObject = requireIsExtendable();
  extendShallow = function extend(o) {
    if (!isObject(o)) {
      o = {};
    }
    var len = arguments.length;
    for (var i = 1; i < len; i++) {
      var obj = arguments[i];
      if (isObject(obj)) {
        assign(o, obj);
      }
    }
    return o;
  };
  function assign(a, b) {
    for (var key2 in b) {
      if (hasOwn(b, key2)) {
        a[key2] = b[key2];
      }
    }
  }
  function hasOwn(obj, key2) {
    return Object.prototype.hasOwnProperty.call(obj, key2);
  }
  return extendShallow;
}
var sectionMatter;
var hasRequiredSectionMatter;
function requireSectionMatter() {
  if (hasRequiredSectionMatter) return sectionMatter;
  hasRequiredSectionMatter = 1;
  var typeOf = requireKindOf();
  var extend = requireExtendShallow();
  sectionMatter = function(input, options2) {
    if (typeof options2 === "function") {
      options2 = { parse: options2 };
    }
    var file = toObject(input);
    var defaults2 = { section_delimiter: "---", parse: identity };
    var opts = extend({}, defaults2, options2);
    var delim = opts.section_delimiter;
    var lines = file.content.split(/\r?\n/);
    var sections = null;
    var section = createSection();
    var content = [];
    var stack = [];
    function initSections(val) {
      file.content = val;
      sections = [];
      content = [];
    }
    function closeSection(val) {
      if (stack.length) {
        section.key = getKey(stack[0], delim);
        section.content = val;
        opts.parse(section, sections);
        sections.push(section);
        section = createSection();
        content = [];
        stack = [];
      }
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var len = stack.length;
      var ln = line.trim();
      if (isDelimiter(ln, delim)) {
        if (ln.length === 3 && i !== 0) {
          if (len === 0 || len === 2) {
            content.push(line);
            continue;
          }
          stack.push(ln);
          section.data = content.join("\n");
          content = [];
          continue;
        }
        if (sections === null) {
          initSections(content.join("\n"));
        }
        if (len === 2) {
          closeSection(content.join("\n"));
        }
        stack.push(ln);
        continue;
      }
      content.push(line);
    }
    if (sections === null) {
      initSections(content.join("\n"));
    } else {
      closeSection(content.join("\n"));
    }
    file.sections = sections;
    return file;
  };
  function isDelimiter(line, delim) {
    if (line.slice(0, delim.length) !== delim) {
      return false;
    }
    if (line.charAt(delim.length + 1) === delim.slice(-1)) {
      return false;
    }
    return true;
  }
  function toObject(input) {
    if (typeOf(input) !== "object") {
      input = { content: input };
    }
    if (typeof input.content !== "string" && !isBuffer(input.content)) {
      throw new TypeError("expected a buffer or string");
    }
    input.content = input.content.toString();
    input.sections = [];
    return input;
  }
  function getKey(val, delim) {
    return val ? val.slice(delim.length).trim() : "";
  }
  function createSection() {
    return { key: "", data: "", content: "" };
  }
  function identity(val) {
    return val;
  }
  function isBuffer(val) {
    if (val && val.constructor && typeof val.constructor.isBuffer === "function") {
      return val.constructor.isBuffer(val);
    }
    return false;
  }
  return sectionMatter;
}
var engines = { exports: {} };
var jsYaml$1 = {};
var loader = {};
var common = {};
var hasRequiredCommon;
function requireCommon() {
  if (hasRequiredCommon) return common;
  hasRequiredCommon = 1;
  function isNothing(subject) {
    return typeof subject === "undefined" || subject === null;
  }
  function isObject(subject) {
    return typeof subject === "object" && subject !== null;
  }
  function toArray2(sequence) {
    if (Array.isArray(sequence)) return sequence;
    else if (isNothing(sequence)) return [];
    return [sequence];
  }
  function extend(target, source) {
    var index, length, key2, sourceKeys;
    if (source) {
      sourceKeys = Object.keys(source);
      for (index = 0, length = sourceKeys.length; index < length; index += 1) {
        key2 = sourceKeys[index];
        target[key2] = source[key2];
      }
    }
    return target;
  }
  function repeat(string, count) {
    var result = "", cycle;
    for (cycle = 0; cycle < count; cycle += 1) {
      result += string;
    }
    return result;
  }
  function isNegativeZero(number2) {
    return number2 === 0 && Number.NEGATIVE_INFINITY === 1 / number2;
  }
  common.isNothing = isNothing;
  common.isObject = isObject;
  common.toArray = toArray2;
  common.repeat = repeat;
  common.isNegativeZero = isNegativeZero;
  common.extend = extend;
  return common;
}
var exception;
var hasRequiredException;
function requireException() {
  if (hasRequiredException) return exception;
  hasRequiredException = 1;
  function YAMLException(reason, mark2) {
    Error.call(this);
    this.name = "YAMLException";
    this.reason = reason;
    this.mark = mark2;
    this.message = (this.reason || "(unknown reason)") + (this.mark ? " " + this.mark.toString() : "");
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error().stack || "";
    }
  }
  YAMLException.prototype = Object.create(Error.prototype);
  YAMLException.prototype.constructor = YAMLException;
  YAMLException.prototype.toString = function toString(compact) {
    var result = this.name + ": ";
    result += this.reason || "(unknown reason)";
    if (!compact && this.mark) {
      result += " " + this.mark.toString();
    }
    return result;
  };
  exception = YAMLException;
  return exception;
}
var mark$1;
var hasRequiredMark;
function requireMark() {
  if (hasRequiredMark) return mark$1;
  hasRequiredMark = 1;
  var common2 = requireCommon();
  function Mark(name, buffer, position, line, column) {
    this.name = name;
    this.buffer = buffer;
    this.position = position;
    this.line = line;
    this.column = column;
  }
  Mark.prototype.getSnippet = function getSnippet(indent, maxLength) {
    var head2, start, tail, end, snippet;
    if (!this.buffer) return null;
    indent = indent || 4;
    maxLength = maxLength || 75;
    head2 = "";
    start = this.position;
    while (start > 0 && "\0\r\n\u2028\u2029".indexOf(this.buffer.charAt(start - 1)) === -1) {
      start -= 1;
      if (this.position - start > maxLength / 2 - 1) {
        head2 = " ... ";
        start += 5;
        break;
      }
    }
    tail = "";
    end = this.position;
    while (end < this.buffer.length && "\0\r\n\u2028\u2029".indexOf(this.buffer.charAt(end)) === -1) {
      end += 1;
      if (end - this.position > maxLength / 2 - 1) {
        tail = " ... ";
        end -= 5;
        break;
      }
    }
    snippet = this.buffer.slice(start, end);
    return common2.repeat(" ", indent) + head2 + snippet + tail + "\n" + common2.repeat(" ", indent + this.position - start + head2.length) + "^";
  };
  Mark.prototype.toString = function toString(compact) {
    var snippet, where = "";
    if (this.name) {
      where += 'in "' + this.name + '" ';
    }
    where += "at line " + (this.line + 1) + ", column " + (this.column + 1);
    if (!compact) {
      snippet = this.getSnippet();
      if (snippet) {
        where += ":\n" + snippet;
      }
    }
    return where;
  };
  mark$1 = Mark;
  return mark$1;
}
var type;
var hasRequiredType;
function requireType() {
  if (hasRequiredType) return type;
  hasRequiredType = 1;
  var YAMLException = requireException();
  var TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "defaultStyle",
    "styleAliases"
  ];
  var YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  function compileStyleAliases(map2) {
    var result = {};
    if (map2 !== null) {
      Object.keys(map2).forEach(function(style) {
        map2[style].forEach(function(alias) {
          result[String(alias)] = style;
        });
      });
    }
    return result;
  }
  function Type(tag, options2) {
    options2 = options2 || {};
    Object.keys(options2).forEach(function(name) {
      if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
        throw new YAMLException('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
      }
    });
    this.tag = tag;
    this.kind = options2["kind"] || null;
    this.resolve = options2["resolve"] || function() {
      return true;
    };
    this.construct = options2["construct"] || function(data) {
      return data;
    };
    this.instanceOf = options2["instanceOf"] || null;
    this.predicate = options2["predicate"] || null;
    this.represent = options2["represent"] || null;
    this.defaultStyle = options2["defaultStyle"] || null;
    this.styleAliases = compileStyleAliases(options2["styleAliases"] || null);
    if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
      throw new YAMLException('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
    }
  }
  type = Type;
  return type;
}
var schema;
var hasRequiredSchema;
function requireSchema() {
  if (hasRequiredSchema) return schema;
  hasRequiredSchema = 1;
  var common2 = requireCommon();
  var YAMLException = requireException();
  var Type = requireType();
  function compileList(schema2, name, result) {
    var exclude = [];
    schema2.include.forEach(function(includedSchema) {
      result = compileList(includedSchema, name, result);
    });
    schema2[name].forEach(function(currentType) {
      result.forEach(function(previousType, previousIndex) {
        if (previousType.tag === currentType.tag && previousType.kind === currentType.kind) {
          exclude.push(previousIndex);
        }
      });
      result.push(currentType);
    });
    return result.filter(function(type2, index) {
      return exclude.indexOf(index) === -1;
    });
  }
  function compileMap() {
    var result = {
      scalar: {},
      sequence: {},
      mapping: {},
      fallback: {}
    }, index, length;
    function collectType(type2) {
      result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
    }
    for (index = 0, length = arguments.length; index < length; index += 1) {
      arguments[index].forEach(collectType);
    }
    return result;
  }
  function Schema2(definition) {
    this.include = definition.include || [];
    this.implicit = definition.implicit || [];
    this.explicit = definition.explicit || [];
    this.implicit.forEach(function(type2) {
      if (type2.loadKind && type2.loadKind !== "scalar") {
        throw new YAMLException("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
    });
    this.compiledImplicit = compileList(this, "implicit", []);
    this.compiledExplicit = compileList(this, "explicit", []);
    this.compiledTypeMap = compileMap(this.compiledImplicit, this.compiledExplicit);
  }
  Schema2.DEFAULT = null;
  Schema2.create = function createSchema() {
    var schemas, types2;
    switch (arguments.length) {
      case 1:
        schemas = Schema2.DEFAULT;
        types2 = arguments[0];
        break;
      case 2:
        schemas = arguments[0];
        types2 = arguments[1];
        break;
      default:
        throw new YAMLException("Wrong number of arguments for Schema.create function");
    }
    schemas = common2.toArray(schemas);
    types2 = common2.toArray(types2);
    if (!schemas.every(function(schema2) {
      return schema2 instanceof Schema2;
    })) {
      throw new YAMLException("Specified list of super schemas (or a single Schema object) contains a non-Schema object.");
    }
    if (!types2.every(function(type2) {
      return type2 instanceof Type;
    })) {
      throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
    return new Schema2({
      include: schemas,
      explicit: types2
    });
  };
  schema = Schema2;
  return schema;
}
var str;
var hasRequiredStr;
function requireStr() {
  if (hasRequiredStr) return str;
  hasRequiredStr = 1;
  var Type = requireType();
  str = new Type("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  return str;
}
var seq;
var hasRequiredSeq;
function requireSeq() {
  if (hasRequiredSeq) return seq;
  hasRequiredSeq = 1;
  var Type = requireType();
  seq = new Type("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  return seq;
}
var map;
var hasRequiredMap;
function requireMap() {
  if (hasRequiredMap) return map;
  hasRequiredMap = 1;
  var Type = requireType();
  map = new Type("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  return map;
}
var failsafe;
var hasRequiredFailsafe;
function requireFailsafe() {
  if (hasRequiredFailsafe) return failsafe;
  hasRequiredFailsafe = 1;
  var Schema2 = requireSchema();
  failsafe = new Schema2({
    explicit: [
      requireStr(),
      requireSeq(),
      requireMap()
    ]
  });
  return failsafe;
}
var _null;
var hasRequired_null;
function require_null() {
  if (hasRequired_null) return _null;
  hasRequired_null = 1;
  var Type = requireType();
  function resolveYamlNull(data) {
    if (data === null) return true;
    var max = data.length;
    return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
  }
  function constructYamlNull() {
    return null;
  }
  function isNull(object) {
    return object === null;
  }
  _null = new Type("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      }
    },
    defaultStyle: "lowercase"
  });
  return _null;
}
var bool;
var hasRequiredBool;
function requireBool() {
  if (hasRequiredBool) return bool;
  hasRequiredBool = 1;
  var Type = requireType();
  function resolveYamlBoolean(data) {
    if (data === null) return false;
    var max = data.length;
    return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
  }
  function constructYamlBoolean(data) {
    return data === "true" || data === "True" || data === "TRUE";
  }
  function isBoolean(object) {
    return Object.prototype.toString.call(object) === "[object Boolean]";
  }
  bool = new Type("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  return bool;
}
var int;
var hasRequiredInt;
function requireInt() {
  if (hasRequiredInt) return int;
  hasRequiredInt = 1;
  var common2 = requireCommon();
  var Type = requireType();
  function isHexCode(c) {
    return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
  }
  function isOctCode(c) {
    return 48 <= c && c <= 55;
  }
  function isDecCode(c) {
    return 48 <= c && c <= 57;
  }
  function resolveYamlInteger(data) {
    if (data === null) return false;
    var max = data.length, index = 0, hasDigits = false, ch;
    if (!max) return false;
    ch = data[index];
    if (ch === "-" || ch === "+") {
      ch = data[++index];
    }
    if (ch === "0") {
      if (index + 1 === max) return true;
      ch = data[++index];
      if (ch === "b") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch === "_") continue;
          if (ch !== "0" && ch !== "1") return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      if (ch === "x") {
        index++;
        for (; index < max; index++) {
          ch = data[index];
          if (ch === "_") continue;
          if (!isHexCode(data.charCodeAt(index))) return false;
          hasDigits = true;
        }
        return hasDigits && ch !== "_";
      }
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "_") return false;
    for (; index < max; index++) {
      ch = data[index];
      if (ch === "_") continue;
      if (ch === ":") break;
      if (!isDecCode(data.charCodeAt(index))) {
        return false;
      }
      hasDigits = true;
    }
    if (!hasDigits || ch === "_") return false;
    if (ch !== ":") return true;
    return /^(:[0-5]?[0-9])+$/.test(data.slice(index));
  }
  function constructYamlInteger(data) {
    var value = data, sign = 1, ch, base, digits = [];
    if (value.indexOf("_") !== -1) {
      value = value.replace(/_/g, "");
    }
    ch = value[0];
    if (ch === "-" || ch === "+") {
      if (ch === "-") sign = -1;
      value = value.slice(1);
      ch = value[0];
    }
    if (value === "0") return 0;
    if (ch === "0") {
      if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
      if (value[1] === "x") return sign * parseInt(value, 16);
      return sign * parseInt(value, 8);
    }
    if (value.indexOf(":") !== -1) {
      value.split(":").forEach(function(v) {
        digits.unshift(parseInt(v, 10));
      });
      value = 0;
      base = 1;
      digits.forEach(function(d) {
        value += d * base;
        base *= 60;
      });
      return sign * value;
    }
    return sign * parseInt(value, 10);
  }
  function isInteger(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
  }
  int = new Type("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0" + obj.toString(8) : "-0" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      /* eslint-disable max-len */
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  return int;
}
var float;
var hasRequiredFloat;
function requireFloat() {
  if (hasRequiredFloat) return float;
  hasRequiredFloat = 1;
  var common2 = requireCommon();
  var Type = requireType();
  var YAML_FLOAT_PATTERN = new RegExp(
    // 2.5e4, 2.5 and integers
    "^(?:[-+]?(?:0|[1-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
  );
  function resolveYamlFloat(data) {
    if (data === null) return false;
    if (!YAML_FLOAT_PATTERN.test(data) || // Quick hack to not allow integers end with `_`
    // Probably should update regexp & check speed
    data[data.length - 1] === "_") {
      return false;
    }
    return true;
  }
  function constructYamlFloat(data) {
    var value, sign, base, digits;
    value = data.replace(/_/g, "").toLowerCase();
    sign = value[0] === "-" ? -1 : 1;
    digits = [];
    if ("+-".indexOf(value[0]) >= 0) {
      value = value.slice(1);
    }
    if (value === ".inf") {
      return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    } else if (value === ".nan") {
      return NaN;
    } else if (value.indexOf(":") >= 0) {
      value.split(":").forEach(function(v) {
        digits.unshift(parseFloat(v, 10));
      });
      value = 0;
      base = 1;
      digits.forEach(function(d) {
        value += d * base;
        base *= 60;
      });
      return sign * value;
    }
    return sign * parseFloat(value, 10);
  }
  var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  function representYamlFloat(object, style) {
    var res;
    if (isNaN(object)) {
      switch (style) {
        case "lowercase":
          return ".nan";
        case "uppercase":
          return ".NAN";
        case "camelcase":
          return ".NaN";
      }
    } else if (Number.POSITIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return ".inf";
        case "uppercase":
          return ".INF";
        case "camelcase":
          return ".Inf";
      }
    } else if (Number.NEGATIVE_INFINITY === object) {
      switch (style) {
        case "lowercase":
          return "-.inf";
        case "uppercase":
          return "-.INF";
        case "camelcase":
          return "-.Inf";
      }
    } else if (common2.isNegativeZero(object)) {
      return "-0.0";
    }
    res = object.toString(10);
    return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
  }
  function isFloat(object) {
    return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
  }
  float = new Type("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  return float;
}
var json;
var hasRequiredJson;
function requireJson() {
  if (hasRequiredJson) return json;
  hasRequiredJson = 1;
  var Schema2 = requireSchema();
  json = new Schema2({
    include: [
      requireFailsafe()
    ],
    implicit: [
      require_null(),
      requireBool(),
      requireInt(),
      requireFloat()
    ]
  });
  return json;
}
var core$1;
var hasRequiredCore;
function requireCore() {
  if (hasRequiredCore) return core$1;
  hasRequiredCore = 1;
  var Schema2 = requireSchema();
  core$1 = new Schema2({
    include: [
      requireJson()
    ]
  });
  return core$1;
}
var timestamp;
var hasRequiredTimestamp;
function requireTimestamp() {
  if (hasRequiredTimestamp) return timestamp;
  hasRequiredTimestamp = 1;
  var Type = requireType();
  var YAML_DATE_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
  );
  var YAML_TIMESTAMP_REGEXP = new RegExp(
    "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
  );
  function resolveYamlTimestamp(data) {
    if (data === null) return false;
    if (YAML_DATE_REGEXP.exec(data) !== null) return true;
    if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
    return false;
  }
  function constructYamlTimestamp(data) {
    var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
    match = YAML_DATE_REGEXP.exec(data);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
    if (match === null) throw new Error("Date resolve error");
    year = +match[1];
    month = +match[2] - 1;
    day = +match[3];
    if (!match[4]) {
      return new Date(Date.UTC(year, month, day));
    }
    hour = +match[4];
    minute = +match[5];
    second = +match[6];
    if (match[7]) {
      fraction = match[7].slice(0, 3);
      while (fraction.length < 3) {
        fraction += "0";
      }
      fraction = +fraction;
    }
    if (match[9]) {
      tz_hour = +match[10];
      tz_minute = +(match[11] || 0);
      delta = (tz_hour * 60 + tz_minute) * 6e4;
      if (match[9] === "-") delta = -delta;
    }
    date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    if (delta) date.setTime(date.getTime() - delta);
    return date;
  }
  function representYamlTimestamp(object) {
    return object.toISOString();
  }
  timestamp = new Type("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  return timestamp;
}
var merge$1;
var hasRequiredMerge;
function requireMerge() {
  if (hasRequiredMerge) return merge$1;
  hasRequiredMerge = 1;
  var Type = requireType();
  function resolveYamlMerge(data) {
    return data === "<<" || data === null;
  }
  merge$1 = new Type("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  return merge$1;
}
function commonjsRequire(path2) {
  throw new Error('Could not dynamically require "' + path2 + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var binary;
var hasRequiredBinary;
function requireBinary() {
  if (hasRequiredBinary) return binary;
  hasRequiredBinary = 1;
  var NodeBuffer;
  try {
    var _require = commonjsRequire;
    NodeBuffer = _require("buffer").Buffer;
  } catch (__) {
  }
  var Type = requireType();
  var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
  function resolveYamlBinary(data) {
    if (data === null) return false;
    var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
    for (idx = 0; idx < max; idx++) {
      code = map2.indexOf(data.charAt(idx));
      if (code > 64) continue;
      if (code < 0) return false;
      bitlen += 6;
    }
    return bitlen % 8 === 0;
  }
  function constructYamlBinary(data) {
    var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
    for (idx = 0; idx < max; idx++) {
      if (idx % 4 === 0 && idx) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      }
      bits = bits << 6 | map2.indexOf(input.charAt(idx));
    }
    tailbits = max % 4 * 6;
    if (tailbits === 0) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    } else if (tailbits === 18) {
      result.push(bits >> 10 & 255);
      result.push(bits >> 2 & 255);
    } else if (tailbits === 12) {
      result.push(bits >> 4 & 255);
    }
    if (NodeBuffer) {
      return NodeBuffer.from ? NodeBuffer.from(result) : new NodeBuffer(result);
    }
    return result;
  }
  function representYamlBinary(object) {
    var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
    for (idx = 0; idx < max; idx++) {
      if (idx % 3 === 0 && idx) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      }
      bits = (bits << 8) + object[idx];
    }
    tail = max % 3;
    if (tail === 0) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    } else if (tail === 2) {
      result += map2[bits >> 10 & 63];
      result += map2[bits >> 4 & 63];
      result += map2[bits << 2 & 63];
      result += map2[64];
    } else if (tail === 1) {
      result += map2[bits >> 2 & 63];
      result += map2[bits << 4 & 63];
      result += map2[64];
      result += map2[64];
    }
    return result;
  }
  function isBinary(object) {
    return NodeBuffer && NodeBuffer.isBuffer(object);
  }
  binary = new Type("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  return binary;
}
var omap;
var hasRequiredOmap;
function requireOmap() {
  if (hasRequiredOmap) return omap;
  hasRequiredOmap = 1;
  var Type = requireType();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var _toString = Object.prototype.toString;
  function resolveYamlOmap(data) {
    if (data === null) return true;
    var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
    for (index = 0, length = object.length; index < length; index += 1) {
      pair = object[index];
      pairHasKey = false;
      if (_toString.call(pair) !== "[object Object]") return false;
      for (pairKey in pair) {
        if (_hasOwnProperty.call(pair, pairKey)) {
          if (!pairHasKey) pairHasKey = true;
          else return false;
        }
      }
      if (!pairHasKey) return false;
      if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
      else return false;
    }
    return true;
  }
  function constructYamlOmap(data) {
    return data !== null ? data : [];
  }
  omap = new Type("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  return omap;
}
var pairs;
var hasRequiredPairs;
function requirePairs() {
  if (hasRequiredPairs) return pairs;
  hasRequiredPairs = 1;
  var Type = requireType();
  var _toString = Object.prototype.toString;
  function resolveYamlPairs(data) {
    if (data === null) return true;
    var index, length, pair, keys, result, object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length; index < length; index += 1) {
      pair = object[index];
      if (_toString.call(pair) !== "[object Object]") return false;
      keys = Object.keys(pair);
      if (keys.length !== 1) return false;
      result[index] = [keys[0], pair[keys[0]]];
    }
    return true;
  }
  function constructYamlPairs(data) {
    if (data === null) return [];
    var index, length, pair, keys, result, object = data;
    result = new Array(object.length);
    for (index = 0, length = object.length; index < length; index += 1) {
      pair = object[index];
      keys = Object.keys(pair);
      result[index] = [keys[0], pair[keys[0]]];
    }
    return result;
  }
  pairs = new Type("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  return pairs;
}
var set;
var hasRequiredSet;
function requireSet() {
  if (hasRequiredSet) return set;
  hasRequiredSet = 1;
  var Type = requireType();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  function resolveYamlSet(data) {
    if (data === null) return true;
    var key2, object = data;
    for (key2 in object) {
      if (_hasOwnProperty.call(object, key2)) {
        if (object[key2] !== null) return false;
      }
    }
    return true;
  }
  function constructYamlSet(data) {
    return data !== null ? data : {};
  }
  set = new Type("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  return set;
}
var default_safe;
var hasRequiredDefault_safe;
function requireDefault_safe() {
  if (hasRequiredDefault_safe) return default_safe;
  hasRequiredDefault_safe = 1;
  var Schema2 = requireSchema();
  default_safe = new Schema2({
    include: [
      requireCore()
    ],
    implicit: [
      requireTimestamp(),
      requireMerge()
    ],
    explicit: [
      requireBinary(),
      requireOmap(),
      requirePairs(),
      requireSet()
    ]
  });
  return default_safe;
}
var _undefined;
var hasRequired_undefined;
function require_undefined() {
  if (hasRequired_undefined) return _undefined;
  hasRequired_undefined = 1;
  var Type = requireType();
  function resolveJavascriptUndefined() {
    return true;
  }
  function constructJavascriptUndefined() {
    return void 0;
  }
  function representJavascriptUndefined() {
    return "";
  }
  function isUndefined(object) {
    return typeof object === "undefined";
  }
  _undefined = new Type("tag:yaml.org,2002:js/undefined", {
    kind: "scalar",
    resolve: resolveJavascriptUndefined,
    construct: constructJavascriptUndefined,
    predicate: isUndefined,
    represent: representJavascriptUndefined
  });
  return _undefined;
}
var regexp;
var hasRequiredRegexp;
function requireRegexp() {
  if (hasRequiredRegexp) return regexp;
  hasRequiredRegexp = 1;
  var Type = requireType();
  function resolveJavascriptRegExp(data) {
    if (data === null) return false;
    if (data.length === 0) return false;
    var regexp2 = data, tail = /\/([gim]*)$/.exec(data), modifiers = "";
    if (regexp2[0] === "/") {
      if (tail) modifiers = tail[1];
      if (modifiers.length > 3) return false;
      if (regexp2[regexp2.length - modifiers.length - 1] !== "/") return false;
    }
    return true;
  }
  function constructJavascriptRegExp(data) {
    var regexp2 = data, tail = /\/([gim]*)$/.exec(data), modifiers = "";
    if (regexp2[0] === "/") {
      if (tail) modifiers = tail[1];
      regexp2 = regexp2.slice(1, regexp2.length - modifiers.length - 1);
    }
    return new RegExp(regexp2, modifiers);
  }
  function representJavascriptRegExp(object) {
    var result = "/" + object.source + "/";
    if (object.global) result += "g";
    if (object.multiline) result += "m";
    if (object.ignoreCase) result += "i";
    return result;
  }
  function isRegExp(object) {
    return Object.prototype.toString.call(object) === "[object RegExp]";
  }
  regexp = new Type("tag:yaml.org,2002:js/regexp", {
    kind: "scalar",
    resolve: resolveJavascriptRegExp,
    construct: constructJavascriptRegExp,
    predicate: isRegExp,
    represent: representJavascriptRegExp
  });
  return regexp;
}
var _function;
var hasRequired_function;
function require_function() {
  if (hasRequired_function) return _function;
  hasRequired_function = 1;
  var esprima;
  try {
    var _require = commonjsRequire;
    esprima = _require("esprima");
  } catch (_) {
    if (typeof window !== "undefined") esprima = window.esprima;
  }
  var Type = requireType();
  function resolveJavascriptFunction(data) {
    if (data === null) return false;
    try {
      var source = "(" + data + ")", ast = esprima.parse(source, { range: true });
      if (ast.type !== "Program" || ast.body.length !== 1 || ast.body[0].type !== "ExpressionStatement" || ast.body[0].expression.type !== "ArrowFunctionExpression" && ast.body[0].expression.type !== "FunctionExpression") {
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }
  function constructJavascriptFunction(data) {
    var source = "(" + data + ")", ast = esprima.parse(source, { range: true }), params = [], body2;
    if (ast.type !== "Program" || ast.body.length !== 1 || ast.body[0].type !== "ExpressionStatement" || ast.body[0].expression.type !== "ArrowFunctionExpression" && ast.body[0].expression.type !== "FunctionExpression") {
      throw new Error("Failed to resolve function");
    }
    ast.body[0].expression.params.forEach(function(param) {
      params.push(param.name);
    });
    body2 = ast.body[0].expression.body.range;
    if (ast.body[0].expression.body.type === "BlockStatement") {
      return new Function(params, source.slice(body2[0] + 1, body2[1] - 1));
    }
    return new Function(params, "return " + source.slice(body2[0], body2[1]));
  }
  function representJavascriptFunction(object) {
    return object.toString();
  }
  function isFunction(object) {
    return Object.prototype.toString.call(object) === "[object Function]";
  }
  _function = new Type("tag:yaml.org,2002:js/function", {
    kind: "scalar",
    resolve: resolveJavascriptFunction,
    construct: constructJavascriptFunction,
    predicate: isFunction,
    represent: representJavascriptFunction
  });
  return _function;
}
var default_full;
var hasRequiredDefault_full;
function requireDefault_full() {
  if (hasRequiredDefault_full) return default_full;
  hasRequiredDefault_full = 1;
  var Schema2 = requireSchema();
  default_full = Schema2.DEFAULT = new Schema2({
    include: [
      requireDefault_safe()
    ],
    explicit: [
      require_undefined(),
      requireRegexp(),
      require_function()
    ]
  });
  return default_full;
}
var hasRequiredLoader;
function requireLoader() {
  if (hasRequiredLoader) return loader;
  hasRequiredLoader = 1;
  var common2 = requireCommon();
  var YAMLException = requireException();
  var Mark = requireMark();
  var DEFAULT_SAFE_SCHEMA = requireDefault_safe();
  var DEFAULT_FULL_SCHEMA = requireDefault_full();
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var CHOMPING_CLIP = 1;
  var CHOMPING_STRIP = 2;
  var CHOMPING_KEEP = 3;
  var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
  var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
  function _class(obj) {
    return Object.prototype.toString.call(obj);
  }
  function is_EOL(c) {
    return c === 10 || c === 13;
  }
  function is_WHITE_SPACE(c) {
    return c === 9 || c === 32;
  }
  function is_WS_OR_EOL(c) {
    return c === 9 || c === 32 || c === 10 || c === 13;
  }
  function is_FLOW_INDICATOR(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromHexCode(c) {
    var lc;
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    lc = c | 32;
    if (97 <= lc && lc <= 102) {
      return lc - 97 + 10;
    }
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) {
      return 2;
    }
    if (c === 117) {
      return 4;
    }
    if (c === 85) {
      return 8;
    }
    return 0;
  }
  function fromDecimalCode(c) {
    if (48 <= c && c <= 57) {
      return c - 48;
    }
    return -1;
  }
  function simpleEscapeSequence(c) {
    return c === 48 ? "\0" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "	" : c === 9 ? "	" : c === 110 ? "\n" : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "" : c === 95 ? " " : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
  }
  function charFromCodepoint(c) {
    if (c <= 65535) {
      return String.fromCharCode(c);
    }
    return String.fromCharCode(
      (c - 65536 >> 10) + 55296,
      (c - 65536 & 1023) + 56320
    );
  }
  function setProperty(object, key2, value) {
    if (key2 === "__proto__") {
      Object.defineProperty(object, key2, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
    } else {
      object[key2] = value;
    }
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (var i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function State(input, options2) {
    this.input = input;
    this.filename = options2["filename"] || null;
    this.schema = options2["schema"] || DEFAULT_FULL_SCHEMA;
    this.onWarning = options2["onWarning"] || null;
    this.legacy = options2["legacy"] || false;
    this.json = options2["json"] || false;
    this.listener = options2["listener"] || null;
    this.implicitTypes = this.schema.compiledImplicit;
    this.typeMap = this.schema.compiledTypeMap;
    this.length = input.length;
    this.position = 0;
    this.line = 0;
    this.lineStart = 0;
    this.lineIndent = 0;
    this.documents = [];
  }
  function generateError(state, message) {
    return new YAMLException(
      message,
      new Mark(state.filename, state.input, state.position, state.line, state.position - state.lineStart)
    );
  }
  function throwError(state, message) {
    throw generateError(state, message);
  }
  function throwWarning(state, message) {
    if (state.onWarning) {
      state.onWarning.call(null, generateError(state, message));
    }
  }
  var directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      var match, major, minor;
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      major = parseInt(match[1], 10);
      minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      var handle2, prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      handle2 = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle2)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty.call(state.tagMap, handle2)) {
        throwError(state, 'there is a previously declared suffix for "' + handle2 + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      state.tagMap[handle2] = prefix;
    }
  };
  function captureSegment(state, start, end, checkJson) {
    var _position, _length, _character, _result;
    if (start < end) {
      _result = state.input.slice(start, end);
      if (checkJson) {
        for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
          _character = _result.charCodeAt(_position);
          if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
            throwError(state, "expected valid JSON character");
          }
        }
      } else if (PATTERN_NON_PRINTABLE.test(_result)) {
        throwError(state, "the stream contains non-printable characters");
      }
      state.result += _result;
    }
  }
  function mergeMappings(state, destination, source, overridableKeys) {
    var sourceKeys, key2, index, quantity;
    if (!common2.isObject(source)) {
      throwError(state, "cannot merge mappings; the provided source object is unacceptable");
    }
    sourceKeys = Object.keys(source);
    for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
      key2 = sourceKeys[index];
      if (!_hasOwnProperty.call(destination, key2)) {
        setProperty(destination, key2, source[key2]);
        overridableKeys[key2] = true;
      }
    }
  }
  function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startPos) {
    var index, quantity;
    if (Array.isArray(keyNode)) {
      keyNode = Array.prototype.slice.call(keyNode);
      for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
        if (Array.isArray(keyNode[index])) {
          throwError(state, "nested arrays are not supported inside keys");
        }
        if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
          keyNode[index] = "[object Object]";
        }
      }
    }
    if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
      keyNode = "[object Object]";
    }
    keyNode = String(keyNode);
    if (_result === null) {
      _result = {};
    }
    if (keyTag === "tag:yaml.org,2002:merge") {
      if (Array.isArray(valueNode)) {
        for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
          mergeMappings(state, _result, valueNode[index], overridableKeys);
        }
      } else {
        mergeMappings(state, _result, valueNode, overridableKeys);
      }
    } else {
      if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
        state.line = startLine || state.line;
        state.position = startPos || state.position;
        throwError(state, "duplicated mapping key");
      }
      setProperty(_result, keyNode, valueNode);
      delete overridableKeys[keyNode];
    }
    return _result;
  }
  function readLineBreak(state) {
    var ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 10) {
      state.position++;
    } else if (ch === 13) {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) {
        state.position++;
      }
    } else {
      throwError(state, "a line break is expected");
    }
    state.line += 1;
    state.lineStart = state.position;
  }
  function skipSeparationSpace(state, allowComments, checkIndent) {
    var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 10 && ch !== 13 && ch !== 0);
      }
      if (is_EOL(ch)) {
        readLineBreak(state);
        ch = state.input.charCodeAt(state.position);
        lineBreaks++;
        state.lineIndent = 0;
        while (ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
      } else {
        break;
      }
    }
    if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
      throwWarning(state, "deficient indentation");
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state) {
    var _position = state.position, ch;
    ch = state.input.charCodeAt(_position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
      _position += 3;
      ch = state.input.charCodeAt(_position);
      if (ch === 0 || is_WS_OR_EOL(ch)) {
        return true;
      }
    }
    return false;
  }
  function writeFoldedLines(state, count) {
    if (count === 1) {
      state.result += " ";
    } else if (count > 1) {
      state.result += common2.repeat("\n", count - 1);
    }
  }
  function readPlainScalar(state, nodeIndent, withinFlowCollection) {
    var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
    ch = state.input.charCodeAt(state.position);
    if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
      return false;
    }
    if (ch === 63 || ch === 45) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        return false;
      }
    }
    state.kind = "scalar";
    state.result = "";
    captureStart = captureEnd = state.position;
    hasPendingContent = false;
    while (ch !== 0) {
      if (ch === 58) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
          break;
        }
      } else if (ch === 35) {
        preceding = state.input.charCodeAt(state.position - 1);
        if (is_WS_OR_EOL(preceding)) {
          break;
        }
      } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
        break;
      } else if (is_EOL(ch)) {
        _line = state.line;
        _lineStart = state.lineStart;
        _lineIndent = state.lineIndent;
        skipSeparationSpace(state, false, -1);
        if (state.lineIndent >= nodeIndent) {
          hasPendingContent = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        } else {
          state.position = captureEnd;
          state.line = _line;
          state.lineStart = _lineStart;
          state.lineIndent = _lineIndent;
          break;
        }
      }
      if (hasPendingContent) {
        captureSegment(state, captureStart, captureEnd, false);
        writeFoldedLines(state, state.line - _line);
        captureStart = captureEnd = state.position;
        hasPendingContent = false;
      }
      if (!is_WHITE_SPACE(ch)) {
        captureEnd = state.position + 1;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, captureEnd, false);
    if (state.result) {
      return true;
    }
    state.kind = _kind;
    state.result = _result;
    return false;
  }
  function readSingleQuotedScalar(state, nodeIndent) {
    var ch, captureStart, captureEnd;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 39) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 39) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (ch === 39) {
          captureStart = state.position;
          state.position++;
          captureEnd = state.position;
        } else {
          return true;
        }
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a single quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent) {
    var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 34) {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    state.position++;
    captureStart = captureEnd = state.position;
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      if (ch === 34) {
        captureSegment(state, captureStart, state.position, true);
        state.position++;
        return true;
      } else if (ch === 92) {
        captureSegment(state, captureStart, state.position, true);
        ch = state.input.charCodeAt(++state.position);
        if (is_EOL(ch)) {
          skipSeparationSpace(state, false, nodeIndent);
        } else if (ch < 256 && simpleEscapeCheck[ch]) {
          state.result += simpleEscapeMap[ch];
          state.position++;
        } else if ((tmp = escapedHexLen(ch)) > 0) {
          hexLength = tmp;
          hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            ch = state.input.charCodeAt(++state.position);
            if ((tmp = fromHexCode(ch)) >= 0) {
              hexResult = (hexResult << 4) + tmp;
            } else {
              throwError(state, "expected hexadecimal character");
            }
          }
          state.result += charFromCodepoint(hexResult);
          state.position++;
        } else {
          throwError(state, "unknown escape sequence");
        }
        captureStart = captureEnd = state.position;
      } else if (is_EOL(ch)) {
        captureSegment(state, captureStart, captureEnd, true);
        writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
        captureStart = captureEnd = state.position;
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
        throwError(state, "unexpected end of the document within a double quoted scalar");
      } else {
        state.position++;
        captureEnd = state.position;
      }
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readFlowCollection(state, nodeIndent) {
    var readNext = true, _line, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = {}, keyNode, keyTag, valueNode, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 91) {
      terminator = 93;
      isMapping = false;
      _result = [];
    } else if (ch === 123) {
      terminator = 125;
      isMapping = true;
      _result = {};
    } else {
      return false;
    }
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(++state.position);
    while (ch !== 0) {
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === terminator) {
        state.position++;
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = isMapping ? "mapping" : "sequence";
        state.result = _result;
        return true;
      } else if (!readNext) {
        throwError(state, "missed comma between flow collection entries");
      }
      keyTag = keyNode = valueNode = null;
      isPair = isExplicitPair = false;
      if (ch === 63) {
        following = state.input.charCodeAt(state.position + 1);
        if (is_WS_OR_EOL(following)) {
          isPair = isExplicitPair = true;
          state.position++;
          skipSeparationSpace(state, true, nodeIndent);
        }
      }
      _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      keyTag = state.tag;
      keyNode = state.result;
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if ((isExplicitPair || state.line === _line) && ch === 58) {
        isPair = true;
        ch = state.input.charCodeAt(++state.position);
        skipSeparationSpace(state, true, nodeIndent);
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        valueNode = state.result;
      }
      if (isMapping) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode);
      } else if (isPair) {
        _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode));
      } else {
        _result.push(keyNode);
      }
      skipSeparationSpace(state, true, nodeIndent);
      ch = state.input.charCodeAt(state.position);
      if (ch === 44) {
        readNext = true;
        ch = state.input.charCodeAt(++state.position);
      } else {
        readNext = false;
      }
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockScalar(state, nodeIndent) {
    var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch === 124) {
      folding = false;
    } else if (ch === 62) {
      folding = true;
    } else {
      return false;
    }
    state.kind = "scalar";
    state.result = "";
    while (ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
      if (ch === 43 || ch === 45) {
        if (CHOMPING_CLIP === chomping) {
          chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
        } else {
          throwError(state, "repeat of a chomping mode identifier");
        }
      } else if ((tmp = fromDecimalCode(ch)) >= 0) {
        if (tmp === 0) {
          throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        } else if (!detectedIndent) {
          textIndent = nodeIndent + tmp - 1;
          detectedIndent = true;
        } else {
          throwError(state, "repeat of an indentation width identifier");
        }
      } else {
        break;
      }
    }
    if (is_WHITE_SPACE(ch)) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (is_WHITE_SPACE(ch));
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (!is_EOL(ch) && ch !== 0);
      }
    }
    while (ch !== 0) {
      readLineBreak(state);
      state.lineIndent = 0;
      ch = state.input.charCodeAt(state.position);
      while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
      if (!detectedIndent && state.lineIndent > textIndent) {
        textIndent = state.lineIndent;
      }
      if (is_EOL(ch)) {
        emptyLines++;
        continue;
      }
      if (state.lineIndent < textIndent) {
        if (chomping === CHOMPING_KEEP) {
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (chomping === CHOMPING_CLIP) {
          if (didReadContent) {
            state.result += "\n";
          }
        }
        break;
      }
      if (folding) {
        if (is_WHITE_SPACE(ch)) {
          atMoreIndented = true;
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        } else if (atMoreIndented) {
          atMoreIndented = false;
          state.result += common2.repeat("\n", emptyLines + 1);
        } else if (emptyLines === 0) {
          if (didReadContent) {
            state.result += " ";
          }
        } else {
          state.result += common2.repeat("\n", emptyLines);
        }
      } else {
        state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      }
      didReadContent = true;
      detectedIndent = true;
      emptyLines = 0;
      captureStart = state.position;
      while (!is_EOL(ch) && ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, state.position, false);
    }
    return true;
  }
  function readBlockSequence(state, nodeIndent) {
    var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (ch !== 45) {
        break;
      }
      following = state.input.charCodeAt(state.position + 1);
      if (!is_WS_OR_EOL(following)) {
        break;
      }
      detected = true;
      state.position++;
      if (skipSeparationSpace(state, true, -1)) {
        if (state.lineIndent <= nodeIndent) {
          _result.push(null);
          ch = state.input.charCodeAt(state.position);
          continue;
        }
      }
      _line = state.line;
      composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      _result.push(state.result);
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
        throwError(state, "bad indentation of a sequence entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "sequence";
      state.result = _result;
      return true;
    }
    return false;
  }
  function readBlockMapping(state, nodeIndent, flowIndent) {
    var following, allowCompact, _line, _pos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = {}, keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = _result;
    }
    ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      following = state.input.charCodeAt(state.position + 1);
      _line = state.line;
      _pos = state.position;
      if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
        if (ch === 63) {
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = true;
          allowCompact = true;
        } else if (atExplicitKey) {
          atExplicitKey = false;
          allowCompact = true;
        } else {
          throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
        }
        state.position += 1;
        ch = following;
      } else if (composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        if (state.line === _line) {
          ch = state.input.charCodeAt(state.position);
          while (is_WHITE_SPACE(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!is_WS_OR_EOL(ch)) {
              throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            }
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = false;
            allowCompact = false;
            keyTag = state.tag;
            keyNode = state.result;
          } else if (detected) {
            throwError(state, "can not read an implicit mapping pair; a colon is missed");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        } else if (detected) {
          throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else {
        break;
      }
      if (state.line === _line || state.lineIndent > nodeIndent) {
        if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
          if (atExplicitKey) {
            keyNode = state.result;
          } else {
            valueNode = state.result;
          }
        }
        if (!atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _pos);
          keyTag = keyNode = valueNode = null;
        }
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
      }
      if (state.lineIndent > nodeIndent && ch !== 0) {
        throwError(state, "bad indentation of a mapping entry");
      } else if (state.lineIndent < nodeIndent) {
        break;
      }
    }
    if (atExplicitKey) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
    }
    if (detected) {
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = "mapping";
      state.result = _result;
    }
    return detected;
  }
  function readTagProperty(state) {
    var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 33) return false;
    if (state.tag !== null) {
      throwError(state, "duplication of a tag property");
    }
    ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    } else {
      tagHandle = "!";
    }
    _position = state.position;
    if (isVerbatim) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0 && ch !== 62);
      if (state.position < state.length) {
        tagName = state.input.slice(_position, state.position);
        ch = state.input.charCodeAt(++state.position);
      } else {
        throwError(state, "unexpected end of the stream within a verbatim tag");
      }
    } else {
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        if (ch === 33) {
          if (!isNamed) {
            tagHandle = state.input.slice(_position - 1, state.position + 1);
            if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
              throwError(state, "named tag handle cannot contain such characters");
            }
            isNamed = true;
            _position = state.position + 1;
          } else {
            throwError(state, "tag suffix cannot contain exclamation marks");
          }
        }
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(_position, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) {
        throwError(state, "tag suffix cannot contain flow indicator characters");
      }
    }
    if (tagName && !PATTERN_TAG_URI.test(tagName)) {
      throwError(state, "tag name cannot contain such characters: " + tagName);
    }
    if (isVerbatim) {
      state.tag = tagName;
    } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
      state.tag = state.tagMap[tagHandle] + tagName;
    } else if (tagHandle === "!") {
      state.tag = "!" + tagName;
    } else if (tagHandle === "!!") {
      state.tag = "tag:yaml.org,2002:" + tagName;
    } else {
      throwError(state, 'undeclared tag handle "' + tagHandle + '"');
    }
    return true;
  }
  function readAnchorProperty(state) {
    var _position, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 38) return false;
    if (state.anchor !== null) {
      throwError(state, "duplication of an anchor property");
    }
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an anchor node must contain at least one character");
    }
    state.anchor = state.input.slice(_position, state.position);
    return true;
  }
  function readAlias(state) {
    var _position, alias, ch;
    ch = state.input.charCodeAt(state.position);
    if (ch !== 42) return false;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    if (state.position === _position) {
      throwError(state, "name of an alias node must contain at least one character");
    }
    alias = state.input.slice(_position, state.position);
    if (!_hasOwnProperty.call(state.anchorMap, alias)) {
      throwError(state, 'unidentified alias "' + alias + '"');
    }
    state.result = state.anchorMap[alias];
    skipSeparationSpace(state, true, -1);
    return true;
  }
  function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
    var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, type2, flowIndent, blockIndent;
    if (state.listener !== null) {
      state.listener("open", state);
    }
    state.tag = null;
    state.anchor = null;
    state.kind = null;
    state.result = null;
    allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
    if (allowToSeek) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      }
    }
    if (indentStatus === 1) {
      while (readTagProperty(state) || readAnchorProperty(state)) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          allowBlockCollections = allowBlockStyles;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        } else {
          allowBlockCollections = false;
        }
      }
    }
    if (allowBlockCollections) {
      allowBlockCollections = atNewLine || allowCompact;
    }
    if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
      if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
        flowIndent = parentIndent;
      } else {
        flowIndent = parentIndent + 1;
      }
      blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) {
        if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
          hasContent = true;
        } else {
          if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
            hasContent = true;
          } else if (readAlias(state)) {
            hasContent = true;
            if (state.tag !== null || state.anchor !== null) {
              throwError(state, "alias node should not have any properties");
            }
          } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
            hasContent = true;
            if (state.tag === null) {
              state.tag = "?";
            }
          }
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
        }
      } else if (indentStatus === 0) {
        hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
      }
    }
    if (state.tag !== null && state.tag !== "!") {
      if (state.tag === "?") {
        if (state.result !== null && state.kind !== "scalar") {
          throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
        }
        for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
          type2 = state.implicitTypes[typeIndex];
          if (type2.resolve(state.result)) {
            state.result = type2.construct(state.result);
            state.tag = type2.tag;
            if (state.anchor !== null) {
              state.anchorMap[state.anchor] = state.result;
            }
            break;
          }
        }
      } else if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
        type2 = state.typeMap[state.kind || "fallback"][state.tag];
        if (state.result !== null && type2.kind !== state.kind) {
          throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
        }
        if (!type2.resolve(state.result)) {
          throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
        } else {
          state.result = type2.construct(state.result);
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
        }
      } else {
        throwError(state, "unknown tag !<" + state.tag + ">");
      }
    }
    if (state.listener !== null) {
      state.listener("close", state);
    }
    return state.tag !== null || state.anchor !== null || hasContent;
  }
  function readDocument(state) {
    var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
    state.version = null;
    state.checkLineBreaks = state.legacy;
    state.tagMap = {};
    state.anchorMap = {};
    while ((ch = state.input.charCodeAt(state.position)) !== 0) {
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
      if (state.lineIndent > 0 || ch !== 37) {
        break;
      }
      hasDirectives = true;
      ch = state.input.charCodeAt(++state.position);
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveName = state.input.slice(_position, state.position);
      directiveArgs = [];
      if (directiveName.length < 1) {
        throwError(state, "directive name must not be less than one character in length");
      }
      while (ch !== 0) {
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 0 && !is_EOL(ch));
          break;
        }
        if (is_EOL(ch)) break;
        _position = state.position;
        while (ch !== 0 && !is_WS_OR_EOL(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        directiveArgs.push(state.input.slice(_position, state.position));
      }
      if (ch !== 0) readLineBreak(state);
      if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
        directiveHandlers[directiveName](state, directiveName, directiveArgs);
      } else {
        throwWarning(state, 'unknown document directive "' + directiveName + '"');
      }
    }
    skipSeparationSpace(state, true, -1);
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    } else if (hasDirectives) {
      throwError(state, "directives end mark is expected");
    }
    composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
    skipSeparationSpace(state, true, -1);
    if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
      throwWarning(state, "non-ASCII line breaks are interpreted as content");
    }
    state.documents.push(state.result);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      if (state.input.charCodeAt(state.position) === 46) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      }
      return;
    }
    if (state.position < state.length - 1) {
      throwError(state, "end of the stream or a document separator is expected");
    } else {
      return;
    }
  }
  function loadDocuments(input, options2) {
    input = String(input);
    options2 = options2 || {};
    if (input.length !== 0) {
      if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
        input += "\n";
      }
      if (input.charCodeAt(0) === 65279) {
        input = input.slice(1);
      }
    }
    var state = new State(input, options2);
    var nullpos = input.indexOf("\0");
    if (nullpos !== -1) {
      state.position = nullpos;
      throwError(state, "null byte is not allowed in input");
    }
    state.input += "\0";
    while (state.input.charCodeAt(state.position) === 32) {
      state.lineIndent += 1;
      state.position += 1;
    }
    while (state.position < state.length - 1) {
      readDocument(state);
    }
    return state.documents;
  }
  function loadAll(input, iterator, options2) {
    if (iterator !== null && typeof iterator === "object" && typeof options2 === "undefined") {
      options2 = iterator;
      iterator = null;
    }
    var documents = loadDocuments(input, options2);
    if (typeof iterator !== "function") {
      return documents;
    }
    for (var index = 0, length = documents.length; index < length; index += 1) {
      iterator(documents[index]);
    }
  }
  function load2(input, options2) {
    var documents = loadDocuments(input, options2);
    if (documents.length === 0) {
      return void 0;
    } else if (documents.length === 1) {
      return documents[0];
    }
    throw new YAMLException("expected a single document in the stream, but found more");
  }
  function safeLoadAll(input, iterator, options2) {
    if (typeof iterator === "object" && iterator !== null && typeof options2 === "undefined") {
      options2 = iterator;
      iterator = null;
    }
    return loadAll(input, iterator, common2.extend({ schema: DEFAULT_SAFE_SCHEMA }, options2));
  }
  function safeLoad(input, options2) {
    return load2(input, common2.extend({ schema: DEFAULT_SAFE_SCHEMA }, options2));
  }
  loader.loadAll = loadAll;
  loader.load = load2;
  loader.safeLoadAll = safeLoadAll;
  loader.safeLoad = safeLoad;
  return loader;
}
var dumper = {};
var hasRequiredDumper;
function requireDumper() {
  if (hasRequiredDumper) return dumper;
  hasRequiredDumper = 1;
  var common2 = requireCommon();
  var YAMLException = requireException();
  var DEFAULT_FULL_SCHEMA = requireDefault_full();
  var DEFAULT_SAFE_SCHEMA = requireDefault_safe();
  var _toString = Object.prototype.toString;
  var _hasOwnProperty = Object.prototype.hasOwnProperty;
  var CHAR_TAB = 9;
  var CHAR_LINE_FEED = 10;
  var CHAR_CARRIAGE_RETURN = 13;
  var CHAR_SPACE = 32;
  var CHAR_EXCLAMATION = 33;
  var CHAR_DOUBLE_QUOTE = 34;
  var CHAR_SHARP = 35;
  var CHAR_PERCENT = 37;
  var CHAR_AMPERSAND = 38;
  var CHAR_SINGLE_QUOTE = 39;
  var CHAR_ASTERISK = 42;
  var CHAR_COMMA = 44;
  var CHAR_MINUS = 45;
  var CHAR_COLON = 58;
  var CHAR_EQUALS = 61;
  var CHAR_GREATER_THAN = 62;
  var CHAR_QUESTION = 63;
  var CHAR_COMMERCIAL_AT = 64;
  var CHAR_LEFT_SQUARE_BRACKET = 91;
  var CHAR_RIGHT_SQUARE_BRACKET = 93;
  var CHAR_GRAVE_ACCENT = 96;
  var CHAR_LEFT_CURLY_BRACKET = 123;
  var CHAR_VERTICAL_LINE = 124;
  var CHAR_RIGHT_CURLY_BRACKET = 125;
  var ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = '\\"';
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  var DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  function compileStyleMap(schema2, map2) {
    var result, keys, index, length, tag, style, type2;
    if (map2 === null) return {};
    result = {};
    keys = Object.keys(map2);
    for (index = 0, length = keys.length; index < length; index += 1) {
      tag = keys[index];
      style = String(map2[tag]);
      if (tag.slice(0, 2) === "!!") {
        tag = "tag:yaml.org,2002:" + tag.slice(2);
      }
      type2 = schema2.compiledTypeMap["fallback"][tag];
      if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
        style = type2.styleAliases[style];
      }
      result[tag] = style;
    }
    return result;
  }
  function encodeHex(character) {
    var string, handle2, length;
    string = character.toString(16).toUpperCase();
    if (character <= 255) {
      handle2 = "x";
      length = 2;
    } else if (character <= 65535) {
      handle2 = "u";
      length = 4;
    } else if (character <= 4294967295) {
      handle2 = "U";
      length = 8;
    } else {
      throw new YAMLException("code point within a string may not be greater than 0xFFFFFFFF");
    }
    return "\\" + handle2 + common2.repeat("0", length - string.length) + string;
  }
  function State(options2) {
    this.schema = options2["schema"] || DEFAULT_FULL_SCHEMA;
    this.indent = Math.max(1, options2["indent"] || 2);
    this.noArrayIndent = options2["noArrayIndent"] || false;
    this.skipInvalid = options2["skipInvalid"] || false;
    this.flowLevel = common2.isNothing(options2["flowLevel"]) ? -1 : options2["flowLevel"];
    this.styleMap = compileStyleMap(this.schema, options2["styles"] || null);
    this.sortKeys = options2["sortKeys"] || false;
    this.lineWidth = options2["lineWidth"] || 80;
    this.noRefs = options2["noRefs"] || false;
    this.noCompatMode = options2["noCompatMode"] || false;
    this.condenseFlow = options2["condenseFlow"] || false;
    this.implicitTypes = this.schema.compiledImplicit;
    this.explicitTypes = this.schema.compiledExplicit;
    this.tag = null;
    this.result = "";
    this.duplicates = [];
    this.usedDuplicates = null;
  }
  function indentString(string, spaces) {
    var ind = common2.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
    while (position < length) {
      next = string.indexOf("\n", position);
      if (next === -1) {
        line = string.slice(position);
        position = length;
      } else {
        line = string.slice(position, next + 1);
        position = next + 1;
      }
      if (line.length && line !== "\n") result += ind;
      result += line;
    }
    return result;
  }
  function generateNextLine(state, level) {
    return "\n" + common2.repeat(" ", state.indent * level);
  }
  function testImplicitResolving(state, str2) {
    var index, length, type2;
    for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
      type2 = state.implicitTypes[index];
      if (type2.resolve(str2)) {
        return true;
      }
    }
    return false;
  }
  function isWhitespace(c) {
    return c === CHAR_SPACE || c === CHAR_TAB;
  }
  function isPrintable(c) {
    return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== 65279 || 65536 <= c && c <= 1114111;
  }
  function isNsChar(c) {
    return isPrintable(c) && !isWhitespace(c) && c !== 65279 && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
  }
  function isPlainSafe(c, prev) {
    return isPrintable(c) && c !== 65279 && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_COLON && (c !== CHAR_SHARP || prev && isNsChar(prev));
  }
  function isPlainSafeFirst(c) {
    return isPrintable(c) && c !== 65279 && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
  }
  function needIndentIndicator(string) {
    var leadingSpaceRe = /^\n* /;
    return leadingSpaceRe.test(string);
  }
  var STYLE_PLAIN = 1, STYLE_SINGLE = 2, STYLE_LITERAL = 3, STYLE_FOLDED = 4, STYLE_DOUBLE = 5;
  function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType) {
    var i;
    var char, prev_char;
    var hasLineBreak = false;
    var hasFoldableLine = false;
    var shouldTrackWidth = lineWidth !== -1;
    var previousLineBreak = -1;
    var plain = isPlainSafeFirst(string.charCodeAt(0)) && !isWhitespace(string.charCodeAt(string.length - 1));
    if (singleLineOnly) {
      for (i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        prev_char = i > 0 ? string.charCodeAt(i - 1) : null;
        plain = plain && isPlainSafe(char, prev_char);
      }
    } else {
      for (i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        if (char === CHAR_LINE_FEED) {
          hasLineBreak = true;
          if (shouldTrackWidth) {
            hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
            i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
            previousLineBreak = i;
          }
        } else if (!isPrintable(char)) {
          return STYLE_DOUBLE;
        }
        prev_char = i > 0 ? string.charCodeAt(i - 1) : null;
        plain = plain && isPlainSafe(char, prev_char);
      }
      hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
    }
    if (!hasLineBreak && !hasFoldableLine) {
      return plain && !testAmbiguousType(string) ? STYLE_PLAIN : STYLE_SINGLE;
    }
    if (indentPerLevel > 9 && needIndentIndicator(string)) {
      return STYLE_DOUBLE;
    }
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  function writeScalar(state, string, level, iskey) {
    state.dump = (function() {
      if (string.length === 0) {
        return "''";
      }
      if (!state.noCompatMode && DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1) {
        return "'" + string + "'";
      }
      var indent = state.indent * Math.max(1, level);
      var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
      var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
      function testAmbiguity(string2) {
        return testImplicitResolving(state, string2);
      }
      switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity)) {
        case STYLE_PLAIN:
          return string;
        case STYLE_SINGLE:
          return "'" + string.replace(/'/g, "''") + "'";
        case STYLE_LITERAL:
          return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
        case STYLE_FOLDED:
          return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
        case STYLE_DOUBLE:
          return '"' + escapeString(string) + '"';
        default:
          throw new YAMLException("impossible error: invalid scalar style");
      }
    })();
  }
  function blockHeader(string, indentPerLevel) {
    var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
    var clip = string[string.length - 1] === "\n";
    var keep = clip && (string[string.length - 2] === "\n" || string === "\n");
    var chomp = keep ? "+" : clip ? "" : "-";
    return indentIndicator + chomp + "\n";
  }
  function dropEndingNewline(string) {
    return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
  }
  function foldString(string, width) {
    var lineRe = /(\n+)([^\n]*)/g;
    var result = (function() {
      var nextLF = string.indexOf("\n");
      nextLF = nextLF !== -1 ? nextLF : string.length;
      lineRe.lastIndex = nextLF;
      return foldLine(string.slice(0, nextLF), width);
    })();
    var prevMoreIndented = string[0] === "\n" || string[0] === " ";
    var moreIndented;
    var match;
    while (match = lineRe.exec(string)) {
      var prefix = match[1], line = match[2];
      moreIndented = line[0] === " ";
      result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
      prevMoreIndented = moreIndented;
    }
    return result;
  }
  function foldLine(line, width) {
    if (line === "" || line[0] === " ") return line;
    var breakRe = / [^ ]/g;
    var match;
    var start = 0, end, curr = 0, next = 0;
    var result = "";
    while (match = breakRe.exec(line)) {
      next = match.index;
      if (next - start > width) {
        end = curr > start ? curr : next;
        result += "\n" + line.slice(start, end);
        start = end + 1;
      }
      curr = next;
    }
    result += "\n";
    if (line.length - start > width && curr > start) {
      result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
    } else {
      result += line.slice(start);
    }
    return result.slice(1);
  }
  function escapeString(string) {
    var result = "";
    var char, nextChar;
    var escapeSeq;
    for (var i = 0; i < string.length; i++) {
      char = string.charCodeAt(i);
      if (char >= 55296 && char <= 56319) {
        nextChar = string.charCodeAt(i + 1);
        if (nextChar >= 56320 && nextChar <= 57343) {
          result += encodeHex((char - 55296) * 1024 + nextChar - 56320 + 65536);
          i++;
          continue;
        }
      }
      escapeSeq = ESCAPE_SEQUENCES[char];
      result += !escapeSeq && isPrintable(char) ? string[i] : escapeSeq || encodeHex(char);
    }
    return result;
  }
  function writeFlowSequence(state, level, object) {
    var _result = "", _tag = state.tag, index, length;
    for (index = 0, length = object.length; index < length; index += 1) {
      if (writeNode(state, level, object[index], false, false)) {
        if (index !== 0) _result += "," + (!state.condenseFlow ? " " : "");
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = "[" + _result + "]";
  }
  function writeBlockSequence(state, level, object, compact) {
    var _result = "", _tag = state.tag, index, length;
    for (index = 0, length = object.length; index < length; index += 1) {
      if (writeNode(state, level + 1, object[index], true, true)) {
        if (!compact || index !== 0) {
          _result += generateNextLine(state, level);
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          _result += "-";
        } else {
          _result += "- ";
        }
        _result += state.dump;
      }
    }
    state.tag = _tag;
    state.dump = _result || "[]";
  }
  function writeFlowMapping(state, level, object) {
    var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
    for (index = 0, length = objectKeyList.length; index < length; index += 1) {
      pairBuffer = "";
      if (index !== 0) pairBuffer += ", ";
      if (state.condenseFlow) pairBuffer += '"';
      objectKey = objectKeyList[index];
      objectValue = object[objectKey];
      if (!writeNode(state, level, objectKey, false, false)) {
        continue;
      }
      if (state.dump.length > 1024) pairBuffer += "? ";
      pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
      if (!writeNode(state, level, objectValue, false, false)) {
        continue;
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = "{" + _result + "}";
  }
  function writeBlockMapping(state, level, object, compact) {
    var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
    if (state.sortKeys === true) {
      objectKeyList.sort();
    } else if (typeof state.sortKeys === "function") {
      objectKeyList.sort(state.sortKeys);
    } else if (state.sortKeys) {
      throw new YAMLException("sortKeys must be a boolean or a function");
    }
    for (index = 0, length = objectKeyList.length; index < length; index += 1) {
      pairBuffer = "";
      if (!compact || index !== 0) {
        pairBuffer += generateNextLine(state, level);
      }
      objectKey = objectKeyList[index];
      objectValue = object[objectKey];
      if (!writeNode(state, level + 1, objectKey, true, true, true)) {
        continue;
      }
      explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
      if (explicitPair) {
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += "?";
        } else {
          pairBuffer += "? ";
        }
      }
      pairBuffer += state.dump;
      if (explicitPair) {
        pairBuffer += generateNextLine(state, level);
      }
      if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
        continue;
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += ":";
      } else {
        pairBuffer += ": ";
      }
      pairBuffer += state.dump;
      _result += pairBuffer;
    }
    state.tag = _tag;
    state.dump = _result || "{}";
  }
  function detectType(state, object, explicit) {
    var _result, typeList, index, length, type2, style;
    typeList = explicit ? state.explicitTypes : state.implicitTypes;
    for (index = 0, length = typeList.length; index < length; index += 1) {
      type2 = typeList[index];
      if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
        state.tag = explicit ? type2.tag : "?";
        if (type2.represent) {
          style = state.styleMap[type2.tag] || type2.defaultStyle;
          if (_toString.call(type2.represent) === "[object Function]") {
            _result = type2.represent(object, style);
          } else if (_hasOwnProperty.call(type2.represent, style)) {
            _result = type2.represent[style](object, style);
          } else {
            throw new YAMLException("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
          }
          state.dump = _result;
        }
        return true;
      }
    }
    return false;
  }
  function writeNode(state, level, object, block, compact, iskey) {
    state.tag = null;
    state.dump = object;
    if (!detectType(state, object, false)) {
      detectType(state, object, true);
    }
    var type2 = _toString.call(state.dump);
    if (block) {
      block = state.flowLevel < 0 || state.flowLevel > level;
    }
    var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
    if (objectOrArray) {
      duplicateIndex = state.duplicates.indexOf(object);
      duplicate = duplicateIndex !== -1;
    }
    if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
      compact = false;
    }
    if (duplicate && state.usedDuplicates[duplicateIndex]) {
      state.dump = "*ref_" + duplicateIndex;
    } else {
      if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
        state.usedDuplicates[duplicateIndex] = true;
      }
      if (type2 === "[object Object]") {
        if (block && Object.keys(state.dump).length !== 0) {
          writeBlockMapping(state, level, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowMapping(state, level, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object Array]") {
        var arrayLevel = state.noArrayIndent && level > 0 ? level - 1 : level;
        if (block && state.dump.length !== 0) {
          writeBlockSequence(state, arrayLevel, state.dump, compact);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + state.dump;
          }
        } else {
          writeFlowSequence(state, arrayLevel, state.dump);
          if (duplicate) {
            state.dump = "&ref_" + duplicateIndex + " " + state.dump;
          }
        }
      } else if (type2 === "[object String]") {
        if (state.tag !== "?") {
          writeScalar(state, state.dump, level, iskey);
        }
      } else {
        if (state.skipInvalid) return false;
        throw new YAMLException("unacceptable kind of an object to dump " + type2);
      }
      if (state.tag !== null && state.tag !== "?") {
        state.dump = "!<" + state.tag + "> " + state.dump;
      }
    }
    return true;
  }
  function getDuplicateReferences(object, state) {
    var objects = [], duplicatesIndexes = [], index, length;
    inspectNode(object, objects, duplicatesIndexes);
    for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
      state.duplicates.push(objects[duplicatesIndexes[index]]);
    }
    state.usedDuplicates = new Array(length);
  }
  function inspectNode(object, objects, duplicatesIndexes) {
    var objectKeyList, index, length;
    if (object !== null && typeof object === "object") {
      index = objects.indexOf(object);
      if (index !== -1) {
        if (duplicatesIndexes.indexOf(index) === -1) {
          duplicatesIndexes.push(index);
        }
      } else {
        objects.push(object);
        if (Array.isArray(object)) {
          for (index = 0, length = object.length; index < length; index += 1) {
            inspectNode(object[index], objects, duplicatesIndexes);
          }
        } else {
          objectKeyList = Object.keys(object);
          for (index = 0, length = objectKeyList.length; index < length; index += 1) {
            inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
          }
        }
      }
    }
  }
  function dump(input, options2) {
    options2 = options2 || {};
    var state = new State(options2);
    if (!state.noRefs) getDuplicateReferences(input, state);
    if (writeNode(state, 0, input, true, true)) return state.dump + "\n";
    return "";
  }
  function safeDump(input, options2) {
    return dump(input, common2.extend({ schema: DEFAULT_SAFE_SCHEMA }, options2));
  }
  dumper.dump = dump;
  dumper.safeDump = safeDump;
  return dumper;
}
var hasRequiredJsYaml$1;
function requireJsYaml$1() {
  if (hasRequiredJsYaml$1) return jsYaml$1;
  hasRequiredJsYaml$1 = 1;
  var loader2 = requireLoader();
  var dumper2 = requireDumper();
  function deprecated(name) {
    return function() {
      throw new Error("Function " + name + " is deprecated and cannot be used.");
    };
  }
  jsYaml$1.Type = requireType();
  jsYaml$1.Schema = requireSchema();
  jsYaml$1.FAILSAFE_SCHEMA = requireFailsafe();
  jsYaml$1.JSON_SCHEMA = requireJson();
  jsYaml$1.CORE_SCHEMA = requireCore();
  jsYaml$1.DEFAULT_SAFE_SCHEMA = requireDefault_safe();
  jsYaml$1.DEFAULT_FULL_SCHEMA = requireDefault_full();
  jsYaml$1.load = loader2.load;
  jsYaml$1.loadAll = loader2.loadAll;
  jsYaml$1.safeLoad = loader2.safeLoad;
  jsYaml$1.safeLoadAll = loader2.safeLoadAll;
  jsYaml$1.dump = dumper2.dump;
  jsYaml$1.safeDump = dumper2.safeDump;
  jsYaml$1.YAMLException = requireException();
  jsYaml$1.MINIMAL_SCHEMA = requireFailsafe();
  jsYaml$1.SAFE_SCHEMA = requireDefault_safe();
  jsYaml$1.DEFAULT_SCHEMA = requireDefault_full();
  jsYaml$1.scan = deprecated("scan");
  jsYaml$1.parse = deprecated("parse");
  jsYaml$1.compose = deprecated("compose");
  jsYaml$1.addConstructor = deprecated("addConstructor");
  return jsYaml$1;
}
var jsYaml;
var hasRequiredJsYaml;
function requireJsYaml() {
  if (hasRequiredJsYaml) return jsYaml;
  hasRequiredJsYaml = 1;
  var yaml2 = requireJsYaml$1();
  jsYaml = yaml2;
  return jsYaml;
}
var hasRequiredEngines;
function requireEngines() {
  if (hasRequiredEngines) return engines.exports;
  hasRequiredEngines = 1;
  (function(module, exports$1) {
    const yaml = requireJsYaml();
    const engines = module.exports;
    engines.yaml = {
      parse: yaml.safeLoad.bind(yaml),
      stringify: yaml.safeDump.bind(yaml)
    };
    engines.json = {
      parse: JSON.parse.bind(JSON),
      stringify: function(obj, options2) {
        const opts = Object.assign({ replacer: null, space: 2 }, options2);
        return JSON.stringify(obj, opts.replacer, opts.space);
      }
    };
    engines.javascript = {
      parse: function parse(str, options, wrap) {
        try {
          if (wrap !== false) {
            str = "(function() {\nreturn " + str.trim() + ";\n}());";
          }
          return eval(str) || {};
        } catch (err) {
          if (wrap !== false && /(unexpected|identifier)/i.test(err.message)) {
            return parse(str, options, false);
          }
          throw new SyntaxError(err);
        }
      },
      stringify: function() {
        throw new Error("stringifying JavaScript is not supported");
      }
    };
  })(engines);
  return engines.exports;
}
var utils = {};
/*!
 * strip-bom-string <https://github.com/jonschlinkert/strip-bom-string>
 *
 * Copyright (c) 2015, 2017, Jon Schlinkert.
 * Released under the MIT License.
 */
var stripBomString;
var hasRequiredStripBomString;
function requireStripBomString() {
  if (hasRequiredStripBomString) return stripBomString;
  hasRequiredStripBomString = 1;
  stripBomString = function(str2) {
    if (typeof str2 === "string" && str2.charAt(0) === "\uFEFF") {
      return str2.slice(1);
    }
    return str2;
  };
  return stripBomString;
}
var hasRequiredUtils;
function requireUtils() {
  if (hasRequiredUtils) return utils;
  hasRequiredUtils = 1;
  (function(exports$12) {
    const stripBom = requireStripBomString();
    const typeOf = requireKindOf();
    exports$12.define = function(obj, key2, val) {
      Reflect.defineProperty(obj, key2, {
        enumerable: false,
        configurable: true,
        writable: true,
        value: val
      });
    };
    exports$12.isBuffer = function(val) {
      return typeOf(val) === "buffer";
    };
    exports$12.isObject = function(val) {
      return typeOf(val) === "object";
    };
    exports$12.toBuffer = function(input) {
      return typeof input === "string" ? Buffer.from(input) : input;
    };
    exports$12.toString = function(input) {
      if (exports$12.isBuffer(input)) return stripBom(String(input));
      if (typeof input !== "string") {
        throw new TypeError("expected input to be a string or buffer");
      }
      return stripBom(input);
    };
    exports$12.arrayify = function(val) {
      return val ? Array.isArray(val) ? val : [val] : [];
    };
    exports$12.startsWith = function(str2, substr, len) {
      if (typeof len !== "number") len = substr.length;
      return str2.slice(0, len) === substr;
    };
  })(utils);
  return utils;
}
var defaults;
var hasRequiredDefaults;
function requireDefaults() {
  if (hasRequiredDefaults) return defaults;
  hasRequiredDefaults = 1;
  const engines2 = requireEngines();
  const utils2 = requireUtils();
  defaults = function(options2) {
    const opts = Object.assign({}, options2);
    opts.delimiters = utils2.arrayify(opts.delims || opts.delimiters || "---");
    if (opts.delimiters.length === 1) {
      opts.delimiters.push(opts.delimiters[0]);
    }
    opts.language = (opts.language || opts.lang || "yaml").toLowerCase();
    opts.engines = Object.assign({}, engines2, opts.parsers, opts.engines);
    return opts;
  };
  return defaults;
}
var engine;
var hasRequiredEngine;
function requireEngine() {
  if (hasRequiredEngine) return engine;
  hasRequiredEngine = 1;
  engine = function(name, options2) {
    let engine2 = options2.engines[name] || options2.engines[aliase(name)];
    if (typeof engine2 === "undefined") {
      throw new Error('gray-matter engine "' + name + '" is not registered');
    }
    if (typeof engine2 === "function") {
      engine2 = { parse: engine2 };
    }
    return engine2;
  };
  function aliase(name) {
    switch (name.toLowerCase()) {
      case "js":
      case "javascript":
        return "javascript";
      case "coffee":
      case "coffeescript":
      case "cson":
        return "coffee";
      case "yaml":
      case "yml":
        return "yaml";
      default: {
        return name;
      }
    }
  }
  return engine;
}
var stringify$3;
var hasRequiredStringify;
function requireStringify() {
  if (hasRequiredStringify) return stringify$3;
  hasRequiredStringify = 1;
  const typeOf = requireKindOf();
  const getEngine = requireEngine();
  const defaults2 = requireDefaults();
  stringify$3 = function(file, data, options2) {
    if (data == null && options2 == null) {
      switch (typeOf(file)) {
        case "object":
          data = file.data;
          options2 = {};
          break;
        case "string":
          return file;
        default: {
          throw new TypeError("expected file to be a string or object");
        }
      }
    }
    const str2 = file.content;
    const opts = defaults2(options2);
    if (data == null) {
      if (!opts.data) return file;
      data = opts.data;
    }
    const language = file.language || opts.language;
    const engine2 = getEngine(language, opts);
    if (typeof engine2.stringify !== "function") {
      throw new TypeError('expected "' + language + '.stringify" to be a function');
    }
    data = Object.assign({}, file.data, data);
    const open = opts.delimiters[0];
    const close = opts.delimiters[1];
    const matter2 = engine2.stringify(data, options2).trim();
    let buf = "";
    if (matter2 !== "{}") {
      buf = newline(open) + newline(matter2) + newline(close);
    }
    if (typeof file.excerpt === "string" && file.excerpt !== "") {
      if (str2.indexOf(file.excerpt.trim()) === -1) {
        buf += newline(file.excerpt) + newline(close);
      }
    }
    return buf + newline(str2);
  };
  function newline(str2) {
    return str2.slice(-1) !== "\n" ? str2 + "\n" : str2;
  }
  return stringify$3;
}
var excerpt;
var hasRequiredExcerpt;
function requireExcerpt() {
  if (hasRequiredExcerpt) return excerpt;
  hasRequiredExcerpt = 1;
  const defaults2 = requireDefaults();
  excerpt = function(file, options2) {
    const opts = defaults2(options2);
    if (file.data == null) {
      file.data = {};
    }
    if (typeof opts.excerpt === "function") {
      return opts.excerpt(file, opts);
    }
    const sep = file.data.excerpt_separator || opts.excerpt_separator;
    if (sep == null && (opts.excerpt === false || opts.excerpt == null)) {
      return file;
    }
    const delimiter = typeof opts.excerpt === "string" ? opts.excerpt : sep || opts.delimiters[0];
    const idx = file.content.indexOf(delimiter);
    if (idx !== -1) {
      file.excerpt = file.content.slice(0, idx);
    }
    return file;
  };
  return excerpt;
}
var toFile;
var hasRequiredToFile;
function requireToFile() {
  if (hasRequiredToFile) return toFile;
  hasRequiredToFile = 1;
  const typeOf = requireKindOf();
  const stringify2 = requireStringify();
  const utils2 = requireUtils();
  toFile = function(file) {
    if (typeOf(file) !== "object") {
      file = { content: file };
    }
    if (typeOf(file.data) !== "object") {
      file.data = {};
    }
    if (file.contents && file.content == null) {
      file.content = file.contents;
    }
    utils2.define(file, "orig", utils2.toBuffer(file.content));
    utils2.define(file, "language", file.language || "");
    utils2.define(file, "matter", file.matter || "");
    utils2.define(file, "stringify", function(data, options2) {
      if (options2 && options2.language) {
        file.language = options2.language;
      }
      return stringify2(file, data, options2);
    });
    file.content = utils2.toString(file.content);
    file.isEmpty = false;
    file.excerpt = "";
    return file;
  };
  return toFile;
}
var parse;
var hasRequiredParse;
function requireParse() {
  if (hasRequiredParse) return parse;
  hasRequiredParse = 1;
  const getEngine = requireEngine();
  const defaults2 = requireDefaults();
  parse = function(language, str2, options2) {
    const opts = defaults2(options2);
    const engine2 = getEngine(language, opts);
    if (typeof engine2.parse !== "function") {
      throw new TypeError('expected "' + language + '.parse" to be a function');
    }
    return engine2.parse(str2, opts);
  };
  return parse;
}
var grayMatter;
var hasRequiredGrayMatter;
function requireGrayMatter() {
  if (hasRequiredGrayMatter) return grayMatter;
  hasRequiredGrayMatter = 1;
  const fs2 = require$$0;
  const sections = requireSectionMatter();
  const defaults2 = requireDefaults();
  const stringify2 = requireStringify();
  const excerpt2 = requireExcerpt();
  const engines2 = requireEngines();
  const toFile2 = requireToFile();
  const parse2 = requireParse();
  const utils2 = requireUtils();
  function matter2(input, options2) {
    if (input === "") {
      return { data: {}, content: input, excerpt: "", orig: input };
    }
    let file = toFile2(input);
    const cached = matter2.cache[file.content];
    if (!options2) {
      if (cached) {
        file = Object.assign({}, cached);
        file.orig = cached.orig;
        return file;
      }
      matter2.cache[file.content] = file;
    }
    return parseMatter(file, options2);
  }
  function parseMatter(file, options2) {
    const opts = defaults2(options2);
    const open = opts.delimiters[0];
    const close = "\n" + opts.delimiters[1];
    let str2 = file.content;
    if (opts.language) {
      file.language = opts.language;
    }
    const openLen = open.length;
    if (!utils2.startsWith(str2, open, openLen)) {
      excerpt2(file, opts);
      return file;
    }
    if (str2.charAt(openLen) === open.slice(-1)) {
      return file;
    }
    str2 = str2.slice(openLen);
    const len = str2.length;
    const language = matter2.language(str2, opts);
    if (language.name) {
      file.language = language.name;
      str2 = str2.slice(language.raw.length);
    }
    let closeIndex = str2.indexOf(close);
    if (closeIndex === -1) {
      closeIndex = len;
    }
    file.matter = str2.slice(0, closeIndex);
    const block = file.matter.replace(/^\s*#[^\n]+/gm, "").trim();
    if (block === "") {
      file.isEmpty = true;
      file.empty = file.content;
      file.data = {};
    } else {
      file.data = parse2(file.language, file.matter, opts);
    }
    if (closeIndex === len) {
      file.content = "";
    } else {
      file.content = str2.slice(closeIndex + close.length);
      if (file.content[0] === "\r") {
        file.content = file.content.slice(1);
      }
      if (file.content[0] === "\n") {
        file.content = file.content.slice(1);
      }
    }
    excerpt2(file, opts);
    if (opts.sections === true || typeof opts.section === "function") {
      sections(file, opts.section);
    }
    return file;
  }
  matter2.engines = engines2;
  matter2.stringify = function(file, data, options2) {
    if (typeof file === "string") file = matter2(file, options2);
    return stringify2(file, data, options2);
  };
  matter2.read = function(filepath, options2) {
    const str2 = fs2.readFileSync(filepath, "utf8");
    const file = matter2(str2, options2);
    file.path = filepath;
    return file;
  };
  matter2.test = function(str2, options2) {
    return utils2.startsWith(str2, defaults2(options2).delimiters[0]);
  };
  matter2.language = function(str2, options2) {
    const opts = defaults2(options2);
    const open = opts.delimiters[0];
    if (matter2.test(str2)) {
      str2 = str2.slice(open.length);
    }
    const language = str2.slice(0, str2.search(/\r?\n/));
    return {
      raw: language,
      name: language ? language.trim() : ""
    };
  };
  matter2.cache = {};
  matter2.clearCache = function() {
    matter2.cache = {};
  };
  grayMatter = matter2;
  return grayMatter;
}
var grayMatterExports = requireGrayMatter();
const matter = /* @__PURE__ */ getDefaultExportFromCjs(grayMatterExports);
function loadDocsContent(contentDir, entry = "docs") {
  const pages = [];
  const absDir = path.resolve(contentDir);
  function scan(dir, slugParts) {
    if (!fs.existsSync(dir))
      return;
    const entries = fs.readdirSync(dir).sort();
    for (const name of entries) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        scan(full, [...slugParts, name]);
        continue;
      }
      if (!name.endsWith(".md") && !name.endsWith(".mdx") && !name.endsWith(".svx"))
        continue;
      const raw2 = fs.readFileSync(full, "utf-8");
      const { data, content } = matter(raw2);
      const baseName = name.replace(/\.(md|mdx|svx)$/, "");
      const isIndex = baseName === "index" || baseName === "page" || baseName === "+page";
      const slug = isIndex ? slugParts.join("/") : [...slugParts, baseName].join("/");
      const url = slug ? `/${entry}/${slug}` : `/${entry}`;
      const title = data.title ?? baseName.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      pages.push({
        slug,
        url,
        title,
        description: data.description,
        icon: data.icon,
        content: stripMarkdown(content),
        rawContent: content
      });
    }
  }
  scan(absDir, []);
  return pages;
}
function loadDocsNavTree(contentDir, entry = "docs", ordering) {
  const absDir = path.resolve(contentDir);
  const children = [];
  const indexPath = findIndex(absDir);
  if (indexPath) {
    const { data } = matter(fs.readFileSync(indexPath, "utf-8"));
    children.push({
      type: "page",
      name: data.title ?? "Documentation",
      url: `/${entry}`,
      icon: data.icon
    });
  }
  const rootSlugOrder = Array.isArray(ordering) ? ordering : void 0;
  children.push(...scanDir(absDir, [], entry, ordering, rootSlugOrder));
  return { name: "Docs", children };
}
function buildNavNode(dir, name, slugParts, entry, ordering, childSlugOrder) {
  const full = path.join(dir, name);
  if (!fs.statSync(full).isDirectory())
    return null;
  const indexPath = findIndex(full);
  if (!indexPath)
    return null;
  const { data } = matter(fs.readFileSync(indexPath, "utf-8"));
  const slug = [...slugParts, name];
  const url = `/${entry}/${slug.join("/")}`;
  const displayName = data.title ?? name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const icon = data.icon;
  const childDirs = fs.readdirSync(full).filter((n) => {
    const p2 = path.join(full, n);
    return fs.statSync(p2).isDirectory() && findIndex(p2) !== null;
  });
  if (childDirs.length > 0) {
    return {
      type: "folder",
      name: displayName,
      icon,
      index: { type: "page", name: displayName, url, icon },
      children: scanDir(full, slug, entry, ordering, childSlugOrder)
    };
  }
  return { type: "page", name: displayName, url, icon };
}
function scanDir(dir, slugParts, entry, ordering, slugOrder) {
  if (!fs.existsSync(dir))
    return [];
  const entries = fs.readdirSync(dir).sort();
  if (slugOrder) {
    const nodes2 = [];
    const slugMap = new Set(slugOrder.map((i) => i.slug));
    for (const item of slugOrder) {
      if (!entries.includes(item.slug))
        continue;
      const node = buildNavNode(dir, item.slug, slugParts, entry, ordering, item.children);
      if (node)
        nodes2.push(node);
    }
    for (const name of entries) {
      if (slugMap.has(name))
        continue;
      const node = buildNavNode(dir, name, slugParts, entry, ordering);
      if (node)
        nodes2.push(node);
    }
    return nodes2;
  }
  if (ordering === "numeric") {
    const nodes2 = [];
    for (const name of entries) {
      const full = path.join(dir, name);
      if (!fs.statSync(full).isDirectory())
        continue;
      const indexPath = findIndex(full);
      if (!indexPath)
        continue;
      const { data } = matter(fs.readFileSync(indexPath, "utf-8"));
      const order = typeof data.order === "number" ? data.order : Infinity;
      const node = buildNavNode(dir, name, slugParts, entry, ordering);
      if (node)
        nodes2.push({ order, node });
    }
    nodes2.sort((a, b) => {
      if (a.order === b.order)
        return 0;
      return a.order - b.order;
    });
    return nodes2.map((n) => n.node);
  }
  const nodes = [];
  for (const name of entries) {
    const node = buildNavNode(dir, name, slugParts, entry, ordering);
    if (node)
      nodes.push(node);
  }
  return nodes;
}
function findIndex(dir) {
  for (const name of ["page.md", "page.mdx", "index.md", "index.svx", "+page.md", "+page.svx"]) {
    const p2 = path.join(dir, name);
    if (fs.existsSync(p2))
      return p2;
  }
  return null;
}
function flattenNavTree(tree) {
  const pages = [];
  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === "page") {
        pages.push(node);
      } else if (node.type === "folder") {
        if (node.index)
          pages.push(node.index);
        walk(node.children);
      }
    }
  }
  walk(tree.children);
  return pages;
}
function stripMarkdown(content) {
  return content.replace(/^(import|export)\s.*$/gm, "").replace(/<[^>]+\/>/g, "").replace(/<\/?[A-Z][^>]*>/g, "").replace(/<\/?[a-z][^>]*>/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2").replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1").replace(/^>\s+/gm, "").replace(/^[-*_]{3,}\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
let ShikiError$2 = class ShikiError2 extends Error {
  constructor(message) {
    super(message);
    this.name = "ShikiError";
  }
};
function clone(something) {
  return doClone(something);
}
function doClone(something) {
  if (Array.isArray(something)) {
    return cloneArray(something);
  }
  if (something instanceof RegExp) {
    return something;
  }
  if (typeof something === "object") {
    return cloneObj(something);
  }
  return something;
}
function cloneArray(arr) {
  let r = [];
  for (let i = 0, len = arr.length; i < len; i++) {
    r[i] = doClone(arr[i]);
  }
  return r;
}
function cloneObj(obj) {
  let r = {};
  for (let key2 in obj) {
    r[key2] = doClone(obj[key2]);
  }
  return r;
}
function mergeObjects(target, ...sources) {
  sources.forEach((source) => {
    for (let key2 in source) {
      target[key2] = source[key2];
    }
  });
  return target;
}
function basename(path2) {
  const idx = ~path2.lastIndexOf("/") || ~path2.lastIndexOf("\\");
  if (idx === 0) {
    return path2;
  } else if (~idx === path2.length - 1) {
    return basename(path2.substring(0, path2.length - 1));
  } else {
    return path2.substr(~idx + 1);
  }
}
var CAPTURING_REGEX_SOURCE = /\$(\d+)|\${(\d+):\/(downcase|upcase)}/g;
var RegexSource = class {
  static hasCaptures(regexSource) {
    if (regexSource === null) {
      return false;
    }
    CAPTURING_REGEX_SOURCE.lastIndex = 0;
    return CAPTURING_REGEX_SOURCE.test(regexSource);
  }
  static replaceCaptures(regexSource, captureSource, captureIndices) {
    return regexSource.replace(CAPTURING_REGEX_SOURCE, (match, index, commandIndex, command) => {
      let capture = captureIndices[parseInt(index || commandIndex, 10)];
      if (capture) {
        let result = captureSource.substring(capture.start, capture.end);
        while (result[0] === ".") {
          result = result.substring(1);
        }
        switch (command) {
          case "downcase":
            return result.toLowerCase();
          case "upcase":
            return result.toUpperCase();
          default:
            return result;
        }
      } else {
        return match;
      }
    });
  }
};
function strcmp(a, b) {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
function strArrCmp(a, b) {
  if (a === null && b === null) {
    return 0;
  }
  if (!a) {
    return -1;
  }
  if (!b) {
    return 1;
  }
  let len1 = a.length;
  let len2 = b.length;
  if (len1 === len2) {
    for (let i = 0; i < len1; i++) {
      let res = strcmp(a[i], b[i]);
      if (res !== 0) {
        return res;
      }
    }
    return 0;
  }
  return len1 - len2;
}
function isValidHexColor(hex) {
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return true;
  }
  if (/^#[0-9a-f]{8}$/i.test(hex)) {
    return true;
  }
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return true;
  }
  if (/^#[0-9a-f]{4}$/i.test(hex)) {
    return true;
  }
  return false;
}
function escapeRegExpCharacters(value) {
  return value.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, "\\$&");
}
var CachedFn = class {
  constructor(fn) {
    this.fn = fn;
  }
  cache = /* @__PURE__ */ new Map();
  get(key2) {
    if (this.cache.has(key2)) {
      return this.cache.get(key2);
    }
    const value = this.fn(key2);
    this.cache.set(key2, value);
    return value;
  }
};
var Theme = class {
  constructor(_colorMap, _defaults, _root) {
    this._colorMap = _colorMap;
    this._defaults = _defaults;
    this._root = _root;
  }
  static createFromRawTheme(source, colorMap) {
    return this.createFromParsedTheme(parseTheme(source), colorMap);
  }
  static createFromParsedTheme(source, colorMap) {
    return resolveParsedThemeRules(source, colorMap);
  }
  _cachedMatchRoot = new CachedFn(
    (scopeName) => this._root.match(scopeName)
  );
  getColorMap() {
    return this._colorMap.getColorMap();
  }
  getDefaults() {
    return this._defaults;
  }
  match(scopePath) {
    if (scopePath === null) {
      return this._defaults;
    }
    const scopeName = scopePath.scopeName;
    const matchingTrieElements = this._cachedMatchRoot.get(scopeName);
    const effectiveRule = matchingTrieElements.find(
      (v) => _scopePathMatchesParentScopes(scopePath.parent, v.parentScopes)
    );
    if (!effectiveRule) {
      return null;
    }
    return new StyleAttributes(
      effectiveRule.fontStyle,
      effectiveRule.foreground,
      effectiveRule.background
    );
  }
};
var ScopeStack = class _ScopeStack {
  constructor(parent, scopeName) {
    this.parent = parent;
    this.scopeName = scopeName;
  }
  static push(path2, scopeNames) {
    for (const name of scopeNames) {
      path2 = new _ScopeStack(path2, name);
    }
    return path2;
  }
  static from(...segments) {
    let result = null;
    for (let i = 0; i < segments.length; i++) {
      result = new _ScopeStack(result, segments[i]);
    }
    return result;
  }
  push(scopeName) {
    return new _ScopeStack(this, scopeName);
  }
  getSegments() {
    let item = this;
    const result = [];
    while (item) {
      result.push(item.scopeName);
      item = item.parent;
    }
    result.reverse();
    return result;
  }
  toString() {
    return this.getSegments().join(" ");
  }
  extends(other) {
    if (this === other) {
      return true;
    }
    if (this.parent === null) {
      return false;
    }
    return this.parent.extends(other);
  }
  getExtensionIfDefined(base) {
    const result = [];
    let item = this;
    while (item && item !== base) {
      result.push(item.scopeName);
      item = item.parent;
    }
    return item === base ? result.reverse() : void 0;
  }
};
function _scopePathMatchesParentScopes(scopePath, parentScopes) {
  if (parentScopes.length === 0) {
    return true;
  }
  for (let index = 0; index < parentScopes.length; index++) {
    let scopePattern = parentScopes[index];
    let scopeMustMatch = false;
    if (scopePattern === ">") {
      if (index === parentScopes.length - 1) {
        return false;
      }
      scopePattern = parentScopes[++index];
      scopeMustMatch = true;
    }
    while (scopePath) {
      if (_matchesScope(scopePath.scopeName, scopePattern)) {
        break;
      }
      if (scopeMustMatch) {
        return false;
      }
      scopePath = scopePath.parent;
    }
    if (!scopePath) {
      return false;
    }
    scopePath = scopePath.parent;
  }
  return true;
}
function _matchesScope(scopeName, scopePattern) {
  return scopePattern === scopeName || scopeName.startsWith(scopePattern) && scopeName[scopePattern.length] === ".";
}
var StyleAttributes = class {
  constructor(fontStyle, foregroundId, backgroundId) {
    this.fontStyle = fontStyle;
    this.foregroundId = foregroundId;
    this.backgroundId = backgroundId;
  }
};
function parseTheme(source) {
  if (!source) {
    return [];
  }
  if (!source.settings || !Array.isArray(source.settings)) {
    return [];
  }
  let settings = source.settings;
  let result = [], resultLen = 0;
  for (let i = 0, len = settings.length; i < len; i++) {
    let entry = settings[i];
    if (!entry.settings) {
      continue;
    }
    let scopes;
    if (typeof entry.scope === "string") {
      let _scope = entry.scope;
      _scope = _scope.replace(/^[,]+/, "");
      _scope = _scope.replace(/[,]+$/, "");
      scopes = _scope.split(",");
    } else if (Array.isArray(entry.scope)) {
      scopes = entry.scope;
    } else {
      scopes = [""];
    }
    let fontStyle = -1;
    if (typeof entry.settings.fontStyle === "string") {
      fontStyle = 0;
      let segments = entry.settings.fontStyle.split(" ");
      for (let j = 0, lenJ = segments.length; j < lenJ; j++) {
        let segment = segments[j];
        switch (segment) {
          case "italic":
            fontStyle = fontStyle | 1;
            break;
          case "bold":
            fontStyle = fontStyle | 2;
            break;
          case "underline":
            fontStyle = fontStyle | 4;
            break;
          case "strikethrough":
            fontStyle = fontStyle | 8;
            break;
        }
      }
    }
    let foreground = null;
    if (typeof entry.settings.foreground === "string" && isValidHexColor(entry.settings.foreground)) {
      foreground = entry.settings.foreground;
    }
    let background = null;
    if (typeof entry.settings.background === "string" && isValidHexColor(entry.settings.background)) {
      background = entry.settings.background;
    }
    for (let j = 0, lenJ = scopes.length; j < lenJ; j++) {
      let _scope = scopes[j].trim();
      let segments = _scope.split(" ");
      let scope = segments[segments.length - 1];
      let parentScopes = null;
      if (segments.length > 1) {
        parentScopes = segments.slice(0, segments.length - 1);
        parentScopes.reverse();
      }
      result[resultLen++] = new ParsedThemeRule(
        scope,
        parentScopes,
        i,
        fontStyle,
        foreground,
        background
      );
    }
  }
  return result;
}
var ParsedThemeRule = class {
  constructor(scope, parentScopes, index, fontStyle, foreground, background) {
    this.scope = scope;
    this.parentScopes = parentScopes;
    this.index = index;
    this.fontStyle = fontStyle;
    this.foreground = foreground;
    this.background = background;
  }
};
var FontStyle = /* @__PURE__ */ ((FontStyle2) => {
  FontStyle2[FontStyle2["NotSet"] = -1] = "NotSet";
  FontStyle2[FontStyle2["None"] = 0] = "None";
  FontStyle2[FontStyle2["Italic"] = 1] = "Italic";
  FontStyle2[FontStyle2["Bold"] = 2] = "Bold";
  FontStyle2[FontStyle2["Underline"] = 4] = "Underline";
  FontStyle2[FontStyle2["Strikethrough"] = 8] = "Strikethrough";
  return FontStyle2;
})(FontStyle || {});
function resolveParsedThemeRules(parsedThemeRules, _colorMap) {
  parsedThemeRules.sort((a, b) => {
    let r = strcmp(a.scope, b.scope);
    if (r !== 0) {
      return r;
    }
    r = strArrCmp(a.parentScopes, b.parentScopes);
    if (r !== 0) {
      return r;
    }
    return a.index - b.index;
  });
  let defaultFontStyle = 0;
  let defaultForeground = "#000000";
  let defaultBackground = "#ffffff";
  while (parsedThemeRules.length >= 1 && parsedThemeRules[0].scope === "") {
    let incomingDefaults = parsedThemeRules.shift();
    if (incomingDefaults.fontStyle !== -1) {
      defaultFontStyle = incomingDefaults.fontStyle;
    }
    if (incomingDefaults.foreground !== null) {
      defaultForeground = incomingDefaults.foreground;
    }
    if (incomingDefaults.background !== null) {
      defaultBackground = incomingDefaults.background;
    }
  }
  let colorMap = new ColorMap(_colorMap);
  let defaults2 = new StyleAttributes(defaultFontStyle, colorMap.getId(defaultForeground), colorMap.getId(defaultBackground));
  let root2 = new ThemeTrieElement(new ThemeTrieElementRule(0, null, -1, 0, 0), []);
  for (let i = 0, len = parsedThemeRules.length; i < len; i++) {
    let rule = parsedThemeRules[i];
    root2.insert(0, rule.scope, rule.parentScopes, rule.fontStyle, colorMap.getId(rule.foreground), colorMap.getId(rule.background));
  }
  return new Theme(colorMap, defaults2, root2);
}
var ColorMap = class {
  _isFrozen;
  _lastColorId;
  _id2color;
  _color2id;
  constructor(_colorMap) {
    this._lastColorId = 0;
    this._id2color = [];
    this._color2id = /* @__PURE__ */ Object.create(null);
    if (Array.isArray(_colorMap)) {
      this._isFrozen = true;
      for (let i = 0, len = _colorMap.length; i < len; i++) {
        this._color2id[_colorMap[i]] = i;
        this._id2color[i] = _colorMap[i];
      }
    } else {
      this._isFrozen = false;
    }
  }
  getId(color) {
    if (color === null) {
      return 0;
    }
    color = color.toUpperCase();
    let value = this._color2id[color];
    if (value) {
      return value;
    }
    if (this._isFrozen) {
      throw new Error(`Missing color in color map - ${color}`);
    }
    value = ++this._lastColorId;
    this._color2id[color] = value;
    this._id2color[value] = color;
    return value;
  }
  getColorMap() {
    return this._id2color.slice(0);
  }
};
var emptyParentScopes = Object.freeze([]);
var ThemeTrieElementRule = class _ThemeTrieElementRule {
  scopeDepth;
  parentScopes;
  fontStyle;
  foreground;
  background;
  constructor(scopeDepth, parentScopes, fontStyle, foreground, background) {
    this.scopeDepth = scopeDepth;
    this.parentScopes = parentScopes || emptyParentScopes;
    this.fontStyle = fontStyle;
    this.foreground = foreground;
    this.background = background;
  }
  clone() {
    return new _ThemeTrieElementRule(this.scopeDepth, this.parentScopes, this.fontStyle, this.foreground, this.background);
  }
  static cloneArr(arr) {
    let r = [];
    for (let i = 0, len = arr.length; i < len; i++) {
      r[i] = arr[i].clone();
    }
    return r;
  }
  acceptOverwrite(scopeDepth, fontStyle, foreground, background) {
    if (this.scopeDepth > scopeDepth) {
      console.log("how did this happen?");
    } else {
      this.scopeDepth = scopeDepth;
    }
    if (fontStyle !== -1) {
      this.fontStyle = fontStyle;
    }
    if (foreground !== 0) {
      this.foreground = foreground;
    }
    if (background !== 0) {
      this.background = background;
    }
  }
};
var ThemeTrieElement = class _ThemeTrieElement {
  constructor(_mainRule, rulesWithParentScopes = [], _children = {}) {
    this._mainRule = _mainRule;
    this._children = _children;
    this._rulesWithParentScopes = rulesWithParentScopes;
  }
  _rulesWithParentScopes;
  static _cmpBySpecificity(a, b) {
    if (a.scopeDepth !== b.scopeDepth) {
      return b.scopeDepth - a.scopeDepth;
    }
    let aParentIndex = 0;
    let bParentIndex = 0;
    while (true) {
      if (a.parentScopes[aParentIndex] === ">") {
        aParentIndex++;
      }
      if (b.parentScopes[bParentIndex] === ">") {
        bParentIndex++;
      }
      if (aParentIndex >= a.parentScopes.length || bParentIndex >= b.parentScopes.length) {
        break;
      }
      const parentScopeLengthDiff = b.parentScopes[bParentIndex].length - a.parentScopes[aParentIndex].length;
      if (parentScopeLengthDiff !== 0) {
        return parentScopeLengthDiff;
      }
      aParentIndex++;
      bParentIndex++;
    }
    return b.parentScopes.length - a.parentScopes.length;
  }
  match(scope) {
    if (scope !== "") {
      let dotIndex = scope.indexOf(".");
      let head2;
      let tail;
      if (dotIndex === -1) {
        head2 = scope;
        tail = "";
      } else {
        head2 = scope.substring(0, dotIndex);
        tail = scope.substring(dotIndex + 1);
      }
      if (this._children.hasOwnProperty(head2)) {
        return this._children[head2].match(tail);
      }
    }
    const rules = this._rulesWithParentScopes.concat(this._mainRule);
    rules.sort(_ThemeTrieElement._cmpBySpecificity);
    return rules;
  }
  insert(scopeDepth, scope, parentScopes, fontStyle, foreground, background) {
    if (scope === "") {
      this._doInsertHere(scopeDepth, parentScopes, fontStyle, foreground, background);
      return;
    }
    let dotIndex = scope.indexOf(".");
    let head2;
    let tail;
    if (dotIndex === -1) {
      head2 = scope;
      tail = "";
    } else {
      head2 = scope.substring(0, dotIndex);
      tail = scope.substring(dotIndex + 1);
    }
    let child;
    if (this._children.hasOwnProperty(head2)) {
      child = this._children[head2];
    } else {
      child = new _ThemeTrieElement(this._mainRule.clone(), ThemeTrieElementRule.cloneArr(this._rulesWithParentScopes));
      this._children[head2] = child;
    }
    child.insert(scopeDepth + 1, tail, parentScopes, fontStyle, foreground, background);
  }
  _doInsertHere(scopeDepth, parentScopes, fontStyle, foreground, background) {
    if (parentScopes === null) {
      this._mainRule.acceptOverwrite(scopeDepth, fontStyle, foreground, background);
      return;
    }
    for (let i = 0, len = this._rulesWithParentScopes.length; i < len; i++) {
      let rule = this._rulesWithParentScopes[i];
      if (strArrCmp(rule.parentScopes, parentScopes) === 0) {
        rule.acceptOverwrite(scopeDepth, fontStyle, foreground, background);
        return;
      }
    }
    if (fontStyle === -1) {
      fontStyle = this._mainRule.fontStyle;
    }
    if (foreground === 0) {
      foreground = this._mainRule.foreground;
    }
    if (background === 0) {
      background = this._mainRule.background;
    }
    this._rulesWithParentScopes.push(new ThemeTrieElementRule(scopeDepth, parentScopes, fontStyle, foreground, background));
  }
};
var EncodedTokenMetadata = class _EncodedTokenMetadata {
  static toBinaryStr(encodedTokenAttributes) {
    return encodedTokenAttributes.toString(2).padStart(32, "0");
  }
  static print(encodedTokenAttributes) {
    const languageId = _EncodedTokenMetadata.getLanguageId(encodedTokenAttributes);
    const tokenType = _EncodedTokenMetadata.getTokenType(encodedTokenAttributes);
    const fontStyle = _EncodedTokenMetadata.getFontStyle(encodedTokenAttributes);
    const foreground = _EncodedTokenMetadata.getForeground(encodedTokenAttributes);
    const background = _EncodedTokenMetadata.getBackground(encodedTokenAttributes);
    console.log({
      languageId,
      tokenType,
      fontStyle,
      foreground,
      background
    });
  }
  static getLanguageId(encodedTokenAttributes) {
    return (encodedTokenAttributes & 255) >>> 0;
  }
  static getTokenType(encodedTokenAttributes) {
    return (encodedTokenAttributes & 768) >>> 8;
  }
  static containsBalancedBrackets(encodedTokenAttributes) {
    return (encodedTokenAttributes & 1024) !== 0;
  }
  static getFontStyle(encodedTokenAttributes) {
    return (encodedTokenAttributes & 30720) >>> 11;
  }
  static getForeground(encodedTokenAttributes) {
    return (encodedTokenAttributes & 16744448) >>> 15;
  }
  static getBackground(encodedTokenAttributes) {
    return (encodedTokenAttributes & 4278190080) >>> 24;
  }
  /**
   * Updates the fields in `metadata`.
   * A value of `0`, `NotSet` or `null` indicates that the corresponding field should be left as is.
   */
  static set(encodedTokenAttributes, languageId, tokenType, containsBalancedBrackets, fontStyle, foreground, background) {
    let _languageId = _EncodedTokenMetadata.getLanguageId(encodedTokenAttributes);
    let _tokenType = _EncodedTokenMetadata.getTokenType(encodedTokenAttributes);
    let _containsBalancedBracketsBit = _EncodedTokenMetadata.containsBalancedBrackets(encodedTokenAttributes) ? 1 : 0;
    let _fontStyle = _EncodedTokenMetadata.getFontStyle(encodedTokenAttributes);
    let _foreground = _EncodedTokenMetadata.getForeground(encodedTokenAttributes);
    let _background = _EncodedTokenMetadata.getBackground(encodedTokenAttributes);
    if (languageId !== 0) {
      _languageId = languageId;
    }
    if (tokenType !== 8) {
      _tokenType = fromOptionalTokenType(tokenType);
    }
    if (containsBalancedBrackets !== null) {
      _containsBalancedBracketsBit = containsBalancedBrackets ? 1 : 0;
    }
    if (fontStyle !== -1) {
      _fontStyle = fontStyle;
    }
    if (foreground !== 0) {
      _foreground = foreground;
    }
    if (background !== 0) {
      _background = background;
    }
    return (_languageId << 0 | _tokenType << 8 | _containsBalancedBracketsBit << 10 | _fontStyle << 11 | _foreground << 15 | _background << 24) >>> 0;
  }
};
function toOptionalTokenType(standardType) {
  return standardType;
}
function fromOptionalTokenType(standardType) {
  return standardType;
}
function createMatchers(selector, matchesName) {
  const results = [];
  const tokenizer = newTokenizer(selector);
  let token = tokenizer.next();
  while (token !== null) {
    let priority = 0;
    if (token.length === 2 && token.charAt(1) === ":") {
      switch (token.charAt(0)) {
        case "R":
          priority = 1;
          break;
        case "L":
          priority = -1;
          break;
        default:
          console.log(`Unknown priority ${token} in scope selector`);
      }
      token = tokenizer.next();
    }
    let matcher = parseConjunction();
    results.push({ matcher, priority });
    if (token !== ",") {
      break;
    }
    token = tokenizer.next();
  }
  return results;
  function parseOperand() {
    if (token === "-") {
      token = tokenizer.next();
      const expressionToNegate = parseOperand();
      return (matcherInput) => !!expressionToNegate && !expressionToNegate(matcherInput);
    }
    if (token === "(") {
      token = tokenizer.next();
      const expressionInParents = parseInnerExpression();
      if (token === ")") {
        token = tokenizer.next();
      }
      return expressionInParents;
    }
    if (isIdentifier(token)) {
      const identifiers = [];
      do {
        identifiers.push(token);
        token = tokenizer.next();
      } while (isIdentifier(token));
      return (matcherInput) => matchesName(identifiers, matcherInput);
    }
    return null;
  }
  function parseConjunction() {
    const matchers = [];
    let matcher = parseOperand();
    while (matcher) {
      matchers.push(matcher);
      matcher = parseOperand();
    }
    return (matcherInput) => matchers.every((matcher2) => matcher2(matcherInput));
  }
  function parseInnerExpression() {
    const matchers = [];
    let matcher = parseConjunction();
    while (matcher) {
      matchers.push(matcher);
      if (token === "|" || token === ",") {
        do {
          token = tokenizer.next();
        } while (token === "|" || token === ",");
      } else {
        break;
      }
      matcher = parseConjunction();
    }
    return (matcherInput) => matchers.some((matcher2) => matcher2(matcherInput));
  }
}
function isIdentifier(token) {
  return !!token && !!token.match(/[\w\.:]+/);
}
function newTokenizer(input) {
  let regex = /([LR]:|[\w\.:][\w\.:\-]*|[\,\|\-\(\)])/g;
  let match = regex.exec(input);
  return {
    next: () => {
      if (!match) {
        return null;
      }
      const res = match[0];
      match = regex.exec(input);
      return res;
    }
  };
}
function disposeOnigString(str2) {
  if (typeof str2.dispose === "function") {
    str2.dispose();
  }
}
var TopLevelRuleReference = class {
  constructor(scopeName) {
    this.scopeName = scopeName;
  }
  toKey() {
    return this.scopeName;
  }
};
var TopLevelRepositoryRuleReference = class {
  constructor(scopeName, ruleName) {
    this.scopeName = scopeName;
    this.ruleName = ruleName;
  }
  toKey() {
    return `${this.scopeName}#${this.ruleName}`;
  }
};
var ExternalReferenceCollector = class {
  _references = [];
  _seenReferenceKeys = /* @__PURE__ */ new Set();
  get references() {
    return this._references;
  }
  visitedRule = /* @__PURE__ */ new Set();
  add(reference) {
    const key2 = reference.toKey();
    if (this._seenReferenceKeys.has(key2)) {
      return;
    }
    this._seenReferenceKeys.add(key2);
    this._references.push(reference);
  }
};
var ScopeDependencyProcessor = class {
  constructor(repo, initialScopeName) {
    this.repo = repo;
    this.initialScopeName = initialScopeName;
    this.seenFullScopeRequests.add(this.initialScopeName);
    this.Q = [new TopLevelRuleReference(this.initialScopeName)];
  }
  seenFullScopeRequests = /* @__PURE__ */ new Set();
  seenPartialScopeRequests = /* @__PURE__ */ new Set();
  Q;
  processQueue() {
    const q = this.Q;
    this.Q = [];
    const deps = new ExternalReferenceCollector();
    for (const dep of q) {
      collectReferencesOfReference(dep, this.initialScopeName, this.repo, deps);
    }
    for (const dep of deps.references) {
      if (dep instanceof TopLevelRuleReference) {
        if (this.seenFullScopeRequests.has(dep.scopeName)) {
          continue;
        }
        this.seenFullScopeRequests.add(dep.scopeName);
        this.Q.push(dep);
      } else {
        if (this.seenFullScopeRequests.has(dep.scopeName)) {
          continue;
        }
        if (this.seenPartialScopeRequests.has(dep.toKey())) {
          continue;
        }
        this.seenPartialScopeRequests.add(dep.toKey());
        this.Q.push(dep);
      }
    }
  }
};
function collectReferencesOfReference(reference, baseGrammarScopeName, repo, result) {
  const selfGrammar = repo.lookup(reference.scopeName);
  if (!selfGrammar) {
    if (reference.scopeName === baseGrammarScopeName) {
      throw new Error(`No grammar provided for <${baseGrammarScopeName}>`);
    }
    return;
  }
  const baseGrammar = repo.lookup(baseGrammarScopeName);
  if (reference instanceof TopLevelRuleReference) {
    collectExternalReferencesInTopLevelRule({ baseGrammar, selfGrammar }, result);
  } else {
    collectExternalReferencesInTopLevelRepositoryRule(
      reference.ruleName,
      { baseGrammar, selfGrammar, repository: selfGrammar.repository },
      result
    );
  }
  const injections = repo.injections(reference.scopeName);
  if (injections) {
    for (const injection of injections) {
      result.add(new TopLevelRuleReference(injection));
    }
  }
}
function collectExternalReferencesInTopLevelRepositoryRule(ruleName, context, result) {
  if (context.repository && context.repository[ruleName]) {
    const rule = context.repository[ruleName];
    collectExternalReferencesInRules([rule], context, result);
  }
}
function collectExternalReferencesInTopLevelRule(context, result) {
  if (context.selfGrammar.patterns && Array.isArray(context.selfGrammar.patterns)) {
    collectExternalReferencesInRules(
      context.selfGrammar.patterns,
      { ...context, repository: context.selfGrammar.repository },
      result
    );
  }
  if (context.selfGrammar.injections) {
    collectExternalReferencesInRules(
      Object.values(context.selfGrammar.injections),
      { ...context, repository: context.selfGrammar.repository },
      result
    );
  }
}
function collectExternalReferencesInRules(rules, context, result) {
  for (const rule of rules) {
    if (result.visitedRule.has(rule)) {
      continue;
    }
    result.visitedRule.add(rule);
    const patternRepository = rule.repository ? mergeObjects({}, context.repository, rule.repository) : context.repository;
    if (Array.isArray(rule.patterns)) {
      collectExternalReferencesInRules(rule.patterns, { ...context, repository: patternRepository }, result);
    }
    const include = rule.include;
    if (!include) {
      continue;
    }
    const reference = parseInclude(include);
    switch (reference.kind) {
      case 0:
        collectExternalReferencesInTopLevelRule({ ...context, selfGrammar: context.baseGrammar }, result);
        break;
      case 1:
        collectExternalReferencesInTopLevelRule(context, result);
        break;
      case 2:
        collectExternalReferencesInTopLevelRepositoryRule(reference.ruleName, { ...context, repository: patternRepository }, result);
        break;
      case 3:
      case 4:
        const selfGrammar = reference.scopeName === context.selfGrammar.scopeName ? context.selfGrammar : reference.scopeName === context.baseGrammar.scopeName ? context.baseGrammar : void 0;
        if (selfGrammar) {
          const newContext = { baseGrammar: context.baseGrammar, selfGrammar, repository: patternRepository };
          if (reference.kind === 4) {
            collectExternalReferencesInTopLevelRepositoryRule(reference.ruleName, newContext, result);
          } else {
            collectExternalReferencesInTopLevelRule(newContext, result);
          }
        } else {
          if (reference.kind === 4) {
            result.add(new TopLevelRepositoryRuleReference(reference.scopeName, reference.ruleName));
          } else {
            result.add(new TopLevelRuleReference(reference.scopeName));
          }
        }
        break;
    }
  }
}
var BaseReference = class {
  kind = 0;
};
var SelfReference = class {
  kind = 1;
};
var RelativeReference = class {
  constructor(ruleName) {
    this.ruleName = ruleName;
  }
  kind = 2;
};
var TopLevelReference = class {
  constructor(scopeName) {
    this.scopeName = scopeName;
  }
  kind = 3;
};
var TopLevelRepositoryReference = class {
  constructor(scopeName, ruleName) {
    this.scopeName = scopeName;
    this.ruleName = ruleName;
  }
  kind = 4;
};
function parseInclude(include) {
  if (include === "$base") {
    return new BaseReference();
  } else if (include === "$self") {
    return new SelfReference();
  }
  const indexOfSharp = include.indexOf("#");
  if (indexOfSharp === -1) {
    return new TopLevelReference(include);
  } else if (indexOfSharp === 0) {
    return new RelativeReference(include.substring(1));
  } else {
    const scopeName = include.substring(0, indexOfSharp);
    const ruleName = include.substring(indexOfSharp + 1);
    return new TopLevelRepositoryReference(scopeName, ruleName);
  }
}
var HAS_BACK_REFERENCES = /\\(\d+)/;
var BACK_REFERENCING_END = /\\(\d+)/g;
var endRuleId = -1;
var whileRuleId = -2;
function ruleIdFromNumber(id) {
  return id;
}
function ruleIdToNumber(id) {
  return id;
}
var Rule = class {
  $location;
  id;
  _nameIsCapturing;
  _name;
  _contentNameIsCapturing;
  _contentName;
  constructor($location, id, name, contentName) {
    this.$location = $location;
    this.id = id;
    this._name = name || null;
    this._nameIsCapturing = RegexSource.hasCaptures(this._name);
    this._contentName = contentName || null;
    this._contentNameIsCapturing = RegexSource.hasCaptures(this._contentName);
  }
  get debugName() {
    const location = this.$location ? `${basename(this.$location.filename)}:${this.$location.line}` : "unknown";
    return `${this.constructor.name}#${this.id} @ ${location}`;
  }
  getName(lineText, captureIndices) {
    if (!this._nameIsCapturing || this._name === null || lineText === null || captureIndices === null) {
      return this._name;
    }
    return RegexSource.replaceCaptures(this._name, lineText, captureIndices);
  }
  getContentName(lineText, captureIndices) {
    if (!this._contentNameIsCapturing || this._contentName === null) {
      return this._contentName;
    }
    return RegexSource.replaceCaptures(this._contentName, lineText, captureIndices);
  }
};
var CaptureRule = class extends Rule {
  retokenizeCapturedWithRuleId;
  constructor($location, id, name, contentName, retokenizeCapturedWithRuleId) {
    super($location, id, name, contentName);
    this.retokenizeCapturedWithRuleId = retokenizeCapturedWithRuleId;
  }
  dispose() {
  }
  collectPatterns(grammar, out) {
    throw new Error("Not supported!");
  }
  compile(grammar, endRegexSource) {
    throw new Error("Not supported!");
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    throw new Error("Not supported!");
  }
};
var MatchRule = class extends Rule {
  _match;
  captures;
  _cachedCompiledPatterns;
  constructor($location, id, name, match, captures) {
    super($location, id, name, null);
    this._match = new RegExpSource(match, this.id);
    this.captures = captures;
    this._cachedCompiledPatterns = null;
  }
  dispose() {
    if (this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns.dispose();
      this._cachedCompiledPatterns = null;
    }
  }
  get debugMatchRegExp() {
    return `${this._match.source}`;
  }
  collectPatterns(grammar, out) {
    out.push(this._match);
  }
  compile(grammar, endRegexSource) {
    return this._getCachedCompiledPatterns(grammar).compile(grammar);
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledPatterns(grammar).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledPatterns(grammar) {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      this.collectPatterns(grammar, this._cachedCompiledPatterns);
    }
    return this._cachedCompiledPatterns;
  }
};
var IncludeOnlyRule = class extends Rule {
  hasMissingPatterns;
  patterns;
  _cachedCompiledPatterns;
  constructor($location, id, name, contentName, patterns) {
    super($location, id, name, contentName);
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = null;
  }
  dispose() {
    if (this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns.dispose();
      this._cachedCompiledPatterns = null;
    }
  }
  collectPatterns(grammar, out) {
    for (const pattern of this.patterns) {
      const rule = grammar.getRule(pattern);
      rule.collectPatterns(grammar, out);
    }
  }
  compile(grammar, endRegexSource) {
    return this._getCachedCompiledPatterns(grammar).compile(grammar);
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledPatterns(grammar).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledPatterns(grammar) {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      this.collectPatterns(grammar, this._cachedCompiledPatterns);
    }
    return this._cachedCompiledPatterns;
  }
};
var BeginEndRule = class extends Rule {
  _begin;
  beginCaptures;
  _end;
  endHasBackReferences;
  endCaptures;
  applyEndPatternLast;
  hasMissingPatterns;
  patterns;
  _cachedCompiledPatterns;
  constructor($location, id, name, contentName, begin, beginCaptures, end, endCaptures, applyEndPatternLast, patterns) {
    super($location, id, name, contentName);
    this._begin = new RegExpSource(begin, this.id);
    this.beginCaptures = beginCaptures;
    this._end = new RegExpSource(end ? end : "￿", -1);
    this.endHasBackReferences = this._end.hasBackReferences;
    this.endCaptures = endCaptures;
    this.applyEndPatternLast = applyEndPatternLast || false;
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = null;
  }
  dispose() {
    if (this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns.dispose();
      this._cachedCompiledPatterns = null;
    }
  }
  get debugBeginRegExp() {
    return `${this._begin.source}`;
  }
  get debugEndRegExp() {
    return `${this._end.source}`;
  }
  getEndWithResolvedBackReferences(lineText, captureIndices) {
    return this._end.resolveBackReferences(lineText, captureIndices);
  }
  collectPatterns(grammar, out) {
    out.push(this._begin);
  }
  compile(grammar, endRegexSource) {
    return this._getCachedCompiledPatterns(grammar, endRegexSource).compile(grammar);
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledPatterns(grammar, endRegexSource).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledPatterns(grammar, endRegexSource) {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      for (const pattern of this.patterns) {
        const rule = grammar.getRule(pattern);
        rule.collectPatterns(grammar, this._cachedCompiledPatterns);
      }
      if (this.applyEndPatternLast) {
        this._cachedCompiledPatterns.push(this._end.hasBackReferences ? this._end.clone() : this._end);
      } else {
        this._cachedCompiledPatterns.unshift(this._end.hasBackReferences ? this._end.clone() : this._end);
      }
    }
    if (this._end.hasBackReferences) {
      if (this.applyEndPatternLast) {
        this._cachedCompiledPatterns.setSource(this._cachedCompiledPatterns.length() - 1, endRegexSource);
      } else {
        this._cachedCompiledPatterns.setSource(0, endRegexSource);
      }
    }
    return this._cachedCompiledPatterns;
  }
};
var BeginWhileRule = class extends Rule {
  _begin;
  beginCaptures;
  whileCaptures;
  _while;
  whileHasBackReferences;
  hasMissingPatterns;
  patterns;
  _cachedCompiledPatterns;
  _cachedCompiledWhilePatterns;
  constructor($location, id, name, contentName, begin, beginCaptures, _while, whileCaptures, patterns) {
    super($location, id, name, contentName);
    this._begin = new RegExpSource(begin, this.id);
    this.beginCaptures = beginCaptures;
    this.whileCaptures = whileCaptures;
    this._while = new RegExpSource(_while, whileRuleId);
    this.whileHasBackReferences = this._while.hasBackReferences;
    this.patterns = patterns.patterns;
    this.hasMissingPatterns = patterns.hasMissingPatterns;
    this._cachedCompiledPatterns = null;
    this._cachedCompiledWhilePatterns = null;
  }
  dispose() {
    if (this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns.dispose();
      this._cachedCompiledPatterns = null;
    }
    if (this._cachedCompiledWhilePatterns) {
      this._cachedCompiledWhilePatterns.dispose();
      this._cachedCompiledWhilePatterns = null;
    }
  }
  get debugBeginRegExp() {
    return `${this._begin.source}`;
  }
  get debugWhileRegExp() {
    return `${this._while.source}`;
  }
  getWhileWithResolvedBackReferences(lineText, captureIndices) {
    return this._while.resolveBackReferences(lineText, captureIndices);
  }
  collectPatterns(grammar, out) {
    out.push(this._begin);
  }
  compile(grammar, endRegexSource) {
    return this._getCachedCompiledPatterns(grammar).compile(grammar);
  }
  compileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledPatterns(grammar).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledPatterns(grammar) {
    if (!this._cachedCompiledPatterns) {
      this._cachedCompiledPatterns = new RegExpSourceList();
      for (const pattern of this.patterns) {
        const rule = grammar.getRule(pattern);
        rule.collectPatterns(grammar, this._cachedCompiledPatterns);
      }
    }
    return this._cachedCompiledPatterns;
  }
  compileWhile(grammar, endRegexSource) {
    return this._getCachedCompiledWhilePatterns(grammar, endRegexSource).compile(grammar);
  }
  compileWhileAG(grammar, endRegexSource, allowA, allowG) {
    return this._getCachedCompiledWhilePatterns(grammar, endRegexSource).compileAG(grammar, allowA, allowG);
  }
  _getCachedCompiledWhilePatterns(grammar, endRegexSource) {
    if (!this._cachedCompiledWhilePatterns) {
      this._cachedCompiledWhilePatterns = new RegExpSourceList();
      this._cachedCompiledWhilePatterns.push(this._while.hasBackReferences ? this._while.clone() : this._while);
    }
    if (this._while.hasBackReferences) {
      this._cachedCompiledWhilePatterns.setSource(0, endRegexSource ? endRegexSource : "￿");
    }
    return this._cachedCompiledWhilePatterns;
  }
};
var RuleFactory = class _RuleFactory {
  static createCaptureRule(helper, $location, name, contentName, retokenizeCapturedWithRuleId) {
    return helper.registerRule((id) => {
      return new CaptureRule($location, id, name, contentName, retokenizeCapturedWithRuleId);
    });
  }
  static getCompiledRuleId(desc, helper, repository) {
    if (!desc.id) {
      helper.registerRule((id) => {
        desc.id = id;
        if (desc.match) {
          return new MatchRule(
            desc.$vscodeTextmateLocation,
            desc.id,
            desc.name,
            desc.match,
            _RuleFactory._compileCaptures(desc.captures, helper, repository)
          );
        }
        if (typeof desc.begin === "undefined") {
          if (desc.repository) {
            repository = mergeObjects({}, repository, desc.repository);
          }
          let patterns = desc.patterns;
          if (typeof patterns === "undefined" && desc.include) {
            patterns = [{ include: desc.include }];
          }
          return new IncludeOnlyRule(
            desc.$vscodeTextmateLocation,
            desc.id,
            desc.name,
            desc.contentName,
            _RuleFactory._compilePatterns(patterns, helper, repository)
          );
        }
        if (desc.while) {
          return new BeginWhileRule(
            desc.$vscodeTextmateLocation,
            desc.id,
            desc.name,
            desc.contentName,
            desc.begin,
            _RuleFactory._compileCaptures(desc.beginCaptures || desc.captures, helper, repository),
            desc.while,
            _RuleFactory._compileCaptures(desc.whileCaptures || desc.captures, helper, repository),
            _RuleFactory._compilePatterns(desc.patterns, helper, repository)
          );
        }
        return new BeginEndRule(
          desc.$vscodeTextmateLocation,
          desc.id,
          desc.name,
          desc.contentName,
          desc.begin,
          _RuleFactory._compileCaptures(desc.beginCaptures || desc.captures, helper, repository),
          desc.end,
          _RuleFactory._compileCaptures(desc.endCaptures || desc.captures, helper, repository),
          desc.applyEndPatternLast,
          _RuleFactory._compilePatterns(desc.patterns, helper, repository)
        );
      });
    }
    return desc.id;
  }
  static _compileCaptures(captures, helper, repository) {
    let r = [];
    if (captures) {
      let maximumCaptureId = 0;
      for (const captureId in captures) {
        if (captureId === "$vscodeTextmateLocation") {
          continue;
        }
        const numericCaptureId = parseInt(captureId, 10);
        if (numericCaptureId > maximumCaptureId) {
          maximumCaptureId = numericCaptureId;
        }
      }
      for (let i = 0; i <= maximumCaptureId; i++) {
        r[i] = null;
      }
      for (const captureId in captures) {
        if (captureId === "$vscodeTextmateLocation") {
          continue;
        }
        const numericCaptureId = parseInt(captureId, 10);
        let retokenizeCapturedWithRuleId = 0;
        if (captures[captureId].patterns) {
          retokenizeCapturedWithRuleId = _RuleFactory.getCompiledRuleId(captures[captureId], helper, repository);
        }
        r[numericCaptureId] = _RuleFactory.createCaptureRule(helper, captures[captureId].$vscodeTextmateLocation, captures[captureId].name, captures[captureId].contentName, retokenizeCapturedWithRuleId);
      }
    }
    return r;
  }
  static _compilePatterns(patterns, helper, repository) {
    let r = [];
    if (patterns) {
      for (let i = 0, len = patterns.length; i < len; i++) {
        const pattern = patterns[i];
        let ruleId = -1;
        if (pattern.include) {
          const reference = parseInclude(pattern.include);
          switch (reference.kind) {
            case 0:
            case 1:
              ruleId = _RuleFactory.getCompiledRuleId(repository[pattern.include], helper, repository);
              break;
            case 2:
              let localIncludedRule = repository[reference.ruleName];
              if (localIncludedRule) {
                ruleId = _RuleFactory.getCompiledRuleId(localIncludedRule, helper, repository);
              }
              break;
            case 3:
            case 4:
              const externalGrammarName = reference.scopeName;
              const externalGrammarInclude = reference.kind === 4 ? reference.ruleName : null;
              const externalGrammar = helper.getExternalGrammar(externalGrammarName, repository);
              if (externalGrammar) {
                if (externalGrammarInclude) {
                  let externalIncludedRule = externalGrammar.repository[externalGrammarInclude];
                  if (externalIncludedRule) {
                    ruleId = _RuleFactory.getCompiledRuleId(externalIncludedRule, helper, externalGrammar.repository);
                  }
                } else {
                  ruleId = _RuleFactory.getCompiledRuleId(externalGrammar.repository.$self, helper, externalGrammar.repository);
                }
              }
              break;
          }
        } else {
          ruleId = _RuleFactory.getCompiledRuleId(pattern, helper, repository);
        }
        if (ruleId !== -1) {
          const rule = helper.getRule(ruleId);
          let skipRule = false;
          if (rule instanceof IncludeOnlyRule || rule instanceof BeginEndRule || rule instanceof BeginWhileRule) {
            if (rule.hasMissingPatterns && rule.patterns.length === 0) {
              skipRule = true;
            }
          }
          if (skipRule) {
            continue;
          }
          r.push(ruleId);
        }
      }
    }
    return {
      patterns: r,
      hasMissingPatterns: (patterns ? patterns.length : 0) !== r.length
    };
  }
};
var RegExpSource = class _RegExpSource {
  source;
  ruleId;
  hasAnchor;
  hasBackReferences;
  _anchorCache;
  constructor(regExpSource, ruleId) {
    if (regExpSource && typeof regExpSource === "string") {
      const len = regExpSource.length;
      let lastPushedPos = 0;
      let output = [];
      let hasAnchor = false;
      for (let pos = 0; pos < len; pos++) {
        const ch = regExpSource.charAt(pos);
        if (ch === "\\") {
          if (pos + 1 < len) {
            const nextCh = regExpSource.charAt(pos + 1);
            if (nextCh === "z") {
              output.push(regExpSource.substring(lastPushedPos, pos));
              output.push("$(?!\\n)(?<!\\n)");
              lastPushedPos = pos + 2;
            } else if (nextCh === "A" || nextCh === "G") {
              hasAnchor = true;
            }
            pos++;
          }
        }
      }
      this.hasAnchor = hasAnchor;
      if (lastPushedPos === 0) {
        this.source = regExpSource;
      } else {
        output.push(regExpSource.substring(lastPushedPos, len));
        this.source = output.join("");
      }
    } else {
      this.hasAnchor = false;
      this.source = regExpSource;
    }
    if (this.hasAnchor) {
      this._anchorCache = this._buildAnchorCache();
    } else {
      this._anchorCache = null;
    }
    this.ruleId = ruleId;
    if (typeof this.source === "string") {
      this.hasBackReferences = HAS_BACK_REFERENCES.test(this.source);
    } else {
      this.hasBackReferences = false;
    }
  }
  clone() {
    return new _RegExpSource(this.source, this.ruleId);
  }
  setSource(newSource) {
    if (this.source === newSource) {
      return;
    }
    this.source = newSource;
    if (this.hasAnchor) {
      this._anchorCache = this._buildAnchorCache();
    }
  }
  resolveBackReferences(lineText, captureIndices) {
    if (typeof this.source !== "string") {
      throw new Error("This method should only be called if the source is a string");
    }
    let capturedValues = captureIndices.map((capture) => {
      return lineText.substring(capture.start, capture.end);
    });
    BACK_REFERENCING_END.lastIndex = 0;
    return this.source.replace(BACK_REFERENCING_END, (match, g1) => {
      return escapeRegExpCharacters(capturedValues[parseInt(g1, 10)] || "");
    });
  }
  _buildAnchorCache() {
    if (typeof this.source !== "string") {
      throw new Error("This method should only be called if the source is a string");
    }
    let A0_G0_result = [];
    let A0_G1_result = [];
    let A1_G0_result = [];
    let A1_G1_result = [];
    let pos, len, ch, nextCh;
    for (pos = 0, len = this.source.length; pos < len; pos++) {
      ch = this.source.charAt(pos);
      A0_G0_result[pos] = ch;
      A0_G1_result[pos] = ch;
      A1_G0_result[pos] = ch;
      A1_G1_result[pos] = ch;
      if (ch === "\\") {
        if (pos + 1 < len) {
          nextCh = this.source.charAt(pos + 1);
          if (nextCh === "A") {
            A0_G0_result[pos + 1] = "￿";
            A0_G1_result[pos + 1] = "￿";
            A1_G0_result[pos + 1] = "A";
            A1_G1_result[pos + 1] = "A";
          } else if (nextCh === "G") {
            A0_G0_result[pos + 1] = "￿";
            A0_G1_result[pos + 1] = "G";
            A1_G0_result[pos + 1] = "￿";
            A1_G1_result[pos + 1] = "G";
          } else {
            A0_G0_result[pos + 1] = nextCh;
            A0_G1_result[pos + 1] = nextCh;
            A1_G0_result[pos + 1] = nextCh;
            A1_G1_result[pos + 1] = nextCh;
          }
          pos++;
        }
      }
    }
    return {
      A0_G0: A0_G0_result.join(""),
      A0_G1: A0_G1_result.join(""),
      A1_G0: A1_G0_result.join(""),
      A1_G1: A1_G1_result.join("")
    };
  }
  resolveAnchors(allowA, allowG) {
    if (!this.hasAnchor || !this._anchorCache || typeof this.source !== "string") {
      return this.source;
    }
    if (allowA) {
      if (allowG) {
        return this._anchorCache.A1_G1;
      } else {
        return this._anchorCache.A1_G0;
      }
    } else {
      if (allowG) {
        return this._anchorCache.A0_G1;
      } else {
        return this._anchorCache.A0_G0;
      }
    }
  }
};
var RegExpSourceList = class {
  _items;
  _hasAnchors;
  _cached;
  _anchorCache;
  constructor() {
    this._items = [];
    this._hasAnchors = false;
    this._cached = null;
    this._anchorCache = {
      A0_G0: null,
      A0_G1: null,
      A1_G0: null,
      A1_G1: null
    };
  }
  dispose() {
    this._disposeCaches();
  }
  _disposeCaches() {
    if (this._cached) {
      this._cached.dispose();
      this._cached = null;
    }
    if (this._anchorCache.A0_G0) {
      this._anchorCache.A0_G0.dispose();
      this._anchorCache.A0_G0 = null;
    }
    if (this._anchorCache.A0_G1) {
      this._anchorCache.A0_G1.dispose();
      this._anchorCache.A0_G1 = null;
    }
    if (this._anchorCache.A1_G0) {
      this._anchorCache.A1_G0.dispose();
      this._anchorCache.A1_G0 = null;
    }
    if (this._anchorCache.A1_G1) {
      this._anchorCache.A1_G1.dispose();
      this._anchorCache.A1_G1 = null;
    }
  }
  push(item) {
    this._items.push(item);
    this._hasAnchors = this._hasAnchors || item.hasAnchor;
  }
  unshift(item) {
    this._items.unshift(item);
    this._hasAnchors = this._hasAnchors || item.hasAnchor;
  }
  length() {
    return this._items.length;
  }
  setSource(index, newSource) {
    if (this._items[index].source !== newSource) {
      this._disposeCaches();
      this._items[index].setSource(newSource);
    }
  }
  compile(onigLib) {
    if (!this._cached) {
      let regExps = this._items.map((e) => e.source);
      this._cached = new CompiledRule(onigLib, regExps, this._items.map((e) => e.ruleId));
    }
    return this._cached;
  }
  compileAG(onigLib, allowA, allowG) {
    if (!this._hasAnchors) {
      return this.compile(onigLib);
    } else {
      if (allowA) {
        if (allowG) {
          if (!this._anchorCache.A1_G1) {
            this._anchorCache.A1_G1 = this._resolveAnchors(onigLib, allowA, allowG);
          }
          return this._anchorCache.A1_G1;
        } else {
          if (!this._anchorCache.A1_G0) {
            this._anchorCache.A1_G0 = this._resolveAnchors(onigLib, allowA, allowG);
          }
          return this._anchorCache.A1_G0;
        }
      } else {
        if (allowG) {
          if (!this._anchorCache.A0_G1) {
            this._anchorCache.A0_G1 = this._resolveAnchors(onigLib, allowA, allowG);
          }
          return this._anchorCache.A0_G1;
        } else {
          if (!this._anchorCache.A0_G0) {
            this._anchorCache.A0_G0 = this._resolveAnchors(onigLib, allowA, allowG);
          }
          return this._anchorCache.A0_G0;
        }
      }
    }
  }
  _resolveAnchors(onigLib, allowA, allowG) {
    let regExps = this._items.map((e) => e.resolveAnchors(allowA, allowG));
    return new CompiledRule(onigLib, regExps, this._items.map((e) => e.ruleId));
  }
};
var CompiledRule = class {
  constructor(onigLib, regExps, rules) {
    this.regExps = regExps;
    this.rules = rules;
    this.scanner = onigLib.createOnigScanner(regExps);
  }
  scanner;
  dispose() {
    if (typeof this.scanner.dispose === "function") {
      this.scanner.dispose();
    }
  }
  toString() {
    const r = [];
    for (let i = 0, len = this.rules.length; i < len; i++) {
      r.push("   - " + this.rules[i] + ": " + this.regExps[i]);
    }
    return r.join("\n");
  }
  findNextMatchSync(string, startPosition, options2) {
    const result = this.scanner.findNextMatchSync(string, startPosition, options2);
    if (!result) {
      return null;
    }
    return {
      ruleId: this.rules[result.index],
      captureIndices: result.captureIndices
    };
  }
};
var BasicScopeAttributes = class {
  constructor(languageId, tokenType) {
    this.languageId = languageId;
    this.tokenType = tokenType;
  }
};
var BasicScopeAttributesProvider = class _BasicScopeAttributesProvider {
  _defaultAttributes;
  _embeddedLanguagesMatcher;
  constructor(initialLanguageId, embeddedLanguages) {
    this._defaultAttributes = new BasicScopeAttributes(
      initialLanguageId,
      8
      /* NotSet */
    );
    this._embeddedLanguagesMatcher = new ScopeMatcher(Object.entries(embeddedLanguages || {}));
  }
  getDefaultAttributes() {
    return this._defaultAttributes;
  }
  getBasicScopeAttributes(scopeName) {
    if (scopeName === null) {
      return _BasicScopeAttributesProvider._NULL_SCOPE_METADATA;
    }
    return this._getBasicScopeAttributes.get(scopeName);
  }
  static _NULL_SCOPE_METADATA = new BasicScopeAttributes(0, 0);
  _getBasicScopeAttributes = new CachedFn((scopeName) => {
    const languageId = this._scopeToLanguage(scopeName);
    const standardTokenType = this._toStandardTokenType(scopeName);
    return new BasicScopeAttributes(languageId, standardTokenType);
  });
  /**
   * Given a produced TM scope, return the language that token describes or null if unknown.
   * e.g. source.html => html, source.css.embedded.html => css, punctuation.definition.tag.html => null
   */
  _scopeToLanguage(scope) {
    return this._embeddedLanguagesMatcher.match(scope) || 0;
  }
  _toStandardTokenType(scopeName) {
    const m = scopeName.match(_BasicScopeAttributesProvider.STANDARD_TOKEN_TYPE_REGEXP);
    if (!m) {
      return 8;
    }
    switch (m[1]) {
      case "comment":
        return 1;
      case "string":
        return 2;
      case "regex":
        return 3;
      case "meta.embedded":
        return 0;
    }
    throw new Error("Unexpected match for standard token type!");
  }
  static STANDARD_TOKEN_TYPE_REGEXP = /\b(comment|string|regex|meta\.embedded)\b/;
};
var ScopeMatcher = class {
  values;
  scopesRegExp;
  constructor(values) {
    if (values.length === 0) {
      this.values = null;
      this.scopesRegExp = null;
    } else {
      this.values = new Map(values);
      const escapedScopes = values.map(
        ([scopeName, value]) => escapeRegExpCharacters(scopeName)
      );
      escapedScopes.sort();
      escapedScopes.reverse();
      this.scopesRegExp = new RegExp(
        `^((${escapedScopes.join(")|(")}))($|\\.)`,
        ""
      );
    }
  }
  match(scope) {
    if (!this.scopesRegExp) {
      return void 0;
    }
    const m = scope.match(this.scopesRegExp);
    if (!m) {
      return void 0;
    }
    return this.values.get(m[1]);
  }
};
({
  InDebugMode: typeof process !== "undefined" && !!process.env["VSCODE_TEXTMATE_DEBUG"]
});
var TokenizeStringResult = class {
  constructor(stack, stoppedEarly) {
    this.stack = stack;
    this.stoppedEarly = stoppedEarly;
  }
};
function _tokenizeString(grammar, lineText, isFirstLine, linePos, stack, lineTokens, checkWhileConditions, timeLimit) {
  const lineLength = lineText.content.length;
  let STOP = false;
  let anchorPosition = -1;
  if (checkWhileConditions) {
    const whileCheckResult = _checkWhileConditions(
      grammar,
      lineText,
      isFirstLine,
      linePos,
      stack,
      lineTokens
    );
    stack = whileCheckResult.stack;
    linePos = whileCheckResult.linePos;
    isFirstLine = whileCheckResult.isFirstLine;
    anchorPosition = whileCheckResult.anchorPosition;
  }
  const startTime = Date.now();
  while (!STOP) {
    if (timeLimit !== 0) {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > timeLimit) {
        return new TokenizeStringResult(stack, true);
      }
    }
    scanNext();
  }
  return new TokenizeStringResult(stack, false);
  function scanNext() {
    const r = matchRuleOrInjections(
      grammar,
      lineText,
      isFirstLine,
      linePos,
      stack,
      anchorPosition
    );
    if (!r) {
      lineTokens.produce(stack, lineLength);
      STOP = true;
      return;
    }
    const captureIndices = r.captureIndices;
    const matchedRuleId = r.matchedRuleId;
    const hasAdvanced = captureIndices && captureIndices.length > 0 ? captureIndices[0].end > linePos : false;
    if (matchedRuleId === endRuleId) {
      const poppedRule = stack.getRule(grammar);
      lineTokens.produce(stack, captureIndices[0].start);
      stack = stack.withContentNameScopesList(stack.nameScopesList);
      handleCaptures(
        grammar,
        lineText,
        isFirstLine,
        stack,
        lineTokens,
        poppedRule.endCaptures,
        captureIndices
      );
      lineTokens.produce(stack, captureIndices[0].end);
      const popped = stack;
      stack = stack.parent;
      anchorPosition = popped.getAnchorPos();
      if (!hasAdvanced && popped.getEnterPos() === linePos) {
        stack = popped;
        lineTokens.produce(stack, lineLength);
        STOP = true;
        return;
      }
    } else {
      const _rule = grammar.getRule(matchedRuleId);
      lineTokens.produce(stack, captureIndices[0].start);
      const beforePush = stack;
      const scopeName = _rule.getName(lineText.content, captureIndices);
      const nameScopesList = stack.contentNameScopesList.pushAttributed(
        scopeName,
        grammar
      );
      stack = stack.push(
        matchedRuleId,
        linePos,
        anchorPosition,
        captureIndices[0].end === lineLength,
        null,
        nameScopesList,
        nameScopesList
      );
      if (_rule instanceof BeginEndRule) {
        const pushedRule = _rule;
        handleCaptures(
          grammar,
          lineText,
          isFirstLine,
          stack,
          lineTokens,
          pushedRule.beginCaptures,
          captureIndices
        );
        lineTokens.produce(stack, captureIndices[0].end);
        anchorPosition = captureIndices[0].end;
        const contentName = pushedRule.getContentName(
          lineText.content,
          captureIndices
        );
        const contentNameScopesList = nameScopesList.pushAttributed(
          contentName,
          grammar
        );
        stack = stack.withContentNameScopesList(contentNameScopesList);
        if (pushedRule.endHasBackReferences) {
          stack = stack.withEndRule(
            pushedRule.getEndWithResolvedBackReferences(
              lineText.content,
              captureIndices
            )
          );
        }
        if (!hasAdvanced && beforePush.hasSameRuleAs(stack)) {
          stack = stack.pop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      } else if (_rule instanceof BeginWhileRule) {
        const pushedRule = _rule;
        handleCaptures(
          grammar,
          lineText,
          isFirstLine,
          stack,
          lineTokens,
          pushedRule.beginCaptures,
          captureIndices
        );
        lineTokens.produce(stack, captureIndices[0].end);
        anchorPosition = captureIndices[0].end;
        const contentName = pushedRule.getContentName(
          lineText.content,
          captureIndices
        );
        const contentNameScopesList = nameScopesList.pushAttributed(
          contentName,
          grammar
        );
        stack = stack.withContentNameScopesList(contentNameScopesList);
        if (pushedRule.whileHasBackReferences) {
          stack = stack.withEndRule(
            pushedRule.getWhileWithResolvedBackReferences(
              lineText.content,
              captureIndices
            )
          );
        }
        if (!hasAdvanced && beforePush.hasSameRuleAs(stack)) {
          stack = stack.pop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      } else {
        const matchingRule = _rule;
        handleCaptures(
          grammar,
          lineText,
          isFirstLine,
          stack,
          lineTokens,
          matchingRule.captures,
          captureIndices
        );
        lineTokens.produce(stack, captureIndices[0].end);
        stack = stack.pop();
        if (!hasAdvanced) {
          stack = stack.safePop();
          lineTokens.produce(stack, lineLength);
          STOP = true;
          return;
        }
      }
    }
    if (captureIndices[0].end > linePos) {
      linePos = captureIndices[0].end;
      isFirstLine = false;
    }
  }
}
function _checkWhileConditions(grammar, lineText, isFirstLine, linePos, stack, lineTokens) {
  let anchorPosition = stack.beginRuleCapturedEOL ? 0 : -1;
  const whileRules = [];
  for (let node = stack; node; node = node.pop()) {
    const nodeRule = node.getRule(grammar);
    if (nodeRule instanceof BeginWhileRule) {
      whileRules.push({
        rule: nodeRule,
        stack: node
      });
    }
  }
  for (let whileRule = whileRules.pop(); whileRule; whileRule = whileRules.pop()) {
    const { ruleScanner, findOptions } = prepareRuleWhileSearch(whileRule.rule, grammar, whileRule.stack.endRule, isFirstLine, linePos === anchorPosition);
    const r = ruleScanner.findNextMatchSync(lineText, linePos, findOptions);
    if (r) {
      const matchedRuleId = r.ruleId;
      if (matchedRuleId !== whileRuleId) {
        stack = whileRule.stack.pop();
        break;
      }
      if (r.captureIndices && r.captureIndices.length) {
        lineTokens.produce(whileRule.stack, r.captureIndices[0].start);
        handleCaptures(grammar, lineText, isFirstLine, whileRule.stack, lineTokens, whileRule.rule.whileCaptures, r.captureIndices);
        lineTokens.produce(whileRule.stack, r.captureIndices[0].end);
        anchorPosition = r.captureIndices[0].end;
        if (r.captureIndices[0].end > linePos) {
          linePos = r.captureIndices[0].end;
          isFirstLine = false;
        }
      }
    } else {
      stack = whileRule.stack.pop();
      break;
    }
  }
  return { stack, linePos, anchorPosition, isFirstLine };
}
function matchRuleOrInjections(grammar, lineText, isFirstLine, linePos, stack, anchorPosition) {
  const matchResult = matchRule(grammar, lineText, isFirstLine, linePos, stack, anchorPosition);
  const injections = grammar.getInjections();
  if (injections.length === 0) {
    return matchResult;
  }
  const injectionResult = matchInjections(injections, grammar, lineText, isFirstLine, linePos, stack, anchorPosition);
  if (!injectionResult) {
    return matchResult;
  }
  if (!matchResult) {
    return injectionResult;
  }
  const matchResultScore = matchResult.captureIndices[0].start;
  const injectionResultScore = injectionResult.captureIndices[0].start;
  if (injectionResultScore < matchResultScore || injectionResult.priorityMatch && injectionResultScore === matchResultScore) {
    return injectionResult;
  }
  return matchResult;
}
function matchRule(grammar, lineText, isFirstLine, linePos, stack, anchorPosition) {
  const rule = stack.getRule(grammar);
  const { ruleScanner, findOptions } = prepareRuleSearch(rule, grammar, stack.endRule, isFirstLine, linePos === anchorPosition);
  const r = ruleScanner.findNextMatchSync(lineText, linePos, findOptions);
  if (r) {
    return {
      captureIndices: r.captureIndices,
      matchedRuleId: r.ruleId
    };
  }
  return null;
}
function matchInjections(injections, grammar, lineText, isFirstLine, linePos, stack, anchorPosition) {
  let bestMatchRating = Number.MAX_VALUE;
  let bestMatchCaptureIndices = null;
  let bestMatchRuleId;
  let bestMatchResultPriority = 0;
  const scopes = stack.contentNameScopesList.getScopeNames();
  for (let i = 0, len = injections.length; i < len; i++) {
    const injection = injections[i];
    if (!injection.matcher(scopes)) {
      continue;
    }
    const rule = grammar.getRule(injection.ruleId);
    const { ruleScanner, findOptions } = prepareRuleSearch(rule, grammar, null, isFirstLine, linePos === anchorPosition);
    const matchResult = ruleScanner.findNextMatchSync(lineText, linePos, findOptions);
    if (!matchResult) {
      continue;
    }
    const matchRating = matchResult.captureIndices[0].start;
    if (matchRating >= bestMatchRating) {
      continue;
    }
    bestMatchRating = matchRating;
    bestMatchCaptureIndices = matchResult.captureIndices;
    bestMatchRuleId = matchResult.ruleId;
    bestMatchResultPriority = injection.priority;
    if (bestMatchRating === linePos) {
      break;
    }
  }
  if (bestMatchCaptureIndices) {
    return {
      priorityMatch: bestMatchResultPriority === -1,
      captureIndices: bestMatchCaptureIndices,
      matchedRuleId: bestMatchRuleId
    };
  }
  return null;
}
function prepareRuleSearch(rule, grammar, endRegexSource, allowA, allowG) {
  const ruleScanner = rule.compileAG(grammar, endRegexSource, allowA, allowG);
  return {
    ruleScanner,
    findOptions: 0
    /* None */
  };
}
function prepareRuleWhileSearch(rule, grammar, endRegexSource, allowA, allowG) {
  const ruleScanner = rule.compileWhileAG(grammar, endRegexSource, allowA, allowG);
  return {
    ruleScanner,
    findOptions: 0
    /* None */
  };
}
function handleCaptures(grammar, lineText, isFirstLine, stack, lineTokens, captures, captureIndices) {
  if (captures.length === 0) {
    return;
  }
  const lineTextContent = lineText.content;
  const len = Math.min(captures.length, captureIndices.length);
  const localStack = [];
  const maxEnd = captureIndices[0].end;
  for (let i = 0; i < len; i++) {
    const captureRule = captures[i];
    if (captureRule === null) {
      continue;
    }
    const captureIndex = captureIndices[i];
    if (captureIndex.length === 0) {
      continue;
    }
    if (captureIndex.start > maxEnd) {
      break;
    }
    while (localStack.length > 0 && localStack[localStack.length - 1].endPos <= captureIndex.start) {
      lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, localStack[localStack.length - 1].endPos);
      localStack.pop();
    }
    if (localStack.length > 0) {
      lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, captureIndex.start);
    } else {
      lineTokens.produce(stack, captureIndex.start);
    }
    if (captureRule.retokenizeCapturedWithRuleId) {
      const scopeName = captureRule.getName(lineTextContent, captureIndices);
      const nameScopesList = stack.contentNameScopesList.pushAttributed(scopeName, grammar);
      const contentName = captureRule.getContentName(lineTextContent, captureIndices);
      const contentNameScopesList = nameScopesList.pushAttributed(contentName, grammar);
      const stackClone = stack.push(captureRule.retokenizeCapturedWithRuleId, captureIndex.start, -1, false, null, nameScopesList, contentNameScopesList);
      const onigSubStr = grammar.createOnigString(lineTextContent.substring(0, captureIndex.end));
      _tokenizeString(
        grammar,
        onigSubStr,
        isFirstLine && captureIndex.start === 0,
        captureIndex.start,
        stackClone,
        lineTokens,
        false,
        /* no time limit */
        0
      );
      disposeOnigString(onigSubStr);
      continue;
    }
    const captureRuleScopeName = captureRule.getName(lineTextContent, captureIndices);
    if (captureRuleScopeName !== null) {
      const base = localStack.length > 0 ? localStack[localStack.length - 1].scopes : stack.contentNameScopesList;
      const captureRuleScopesList = base.pushAttributed(captureRuleScopeName, grammar);
      localStack.push(new LocalStackElement(captureRuleScopesList, captureIndex.end));
    }
  }
  while (localStack.length > 0) {
    lineTokens.produceFromScopes(localStack[localStack.length - 1].scopes, localStack[localStack.length - 1].endPos);
    localStack.pop();
  }
}
var LocalStackElement = class {
  scopes;
  endPos;
  constructor(scopes, endPos) {
    this.scopes = scopes;
    this.endPos = endPos;
  }
};
function createGrammar(scopeName, grammar, initialLanguage, embeddedLanguages, tokenTypes, balancedBracketSelectors, grammarRepository, onigLib) {
  return new Grammar(
    scopeName,
    grammar,
    initialLanguage,
    embeddedLanguages,
    tokenTypes,
    balancedBracketSelectors,
    grammarRepository,
    onigLib
  );
}
function collectInjections(result, selector, rule, ruleFactoryHelper, grammar) {
  const matchers = createMatchers(selector, nameMatcher);
  const ruleId = RuleFactory.getCompiledRuleId(rule, ruleFactoryHelper, grammar.repository);
  for (const matcher of matchers) {
    result.push({
      debugSelector: selector,
      matcher: matcher.matcher,
      ruleId,
      grammar,
      priority: matcher.priority
    });
  }
}
function nameMatcher(identifers, scopes) {
  if (scopes.length < identifers.length) {
    return false;
  }
  let lastIndex = 0;
  return identifers.every((identifier) => {
    for (let i = lastIndex; i < scopes.length; i++) {
      if (scopesAreMatching(scopes[i], identifier)) {
        lastIndex = i + 1;
        return true;
      }
    }
    return false;
  });
}
function scopesAreMatching(thisScopeName, scopeName) {
  if (!thisScopeName) {
    return false;
  }
  if (thisScopeName === scopeName) {
    return true;
  }
  const len = scopeName.length;
  return thisScopeName.length > len && thisScopeName.substr(0, len) === scopeName && thisScopeName[len] === ".";
}
var Grammar = class {
  constructor(_rootScopeName, grammar, initialLanguage, embeddedLanguages, tokenTypes, balancedBracketSelectors, grammarRepository, _onigLib) {
    this._rootScopeName = _rootScopeName;
    this.balancedBracketSelectors = balancedBracketSelectors;
    this._onigLib = _onigLib;
    this._basicScopeAttributesProvider = new BasicScopeAttributesProvider(
      initialLanguage,
      embeddedLanguages
    );
    this._rootId = -1;
    this._lastRuleId = 0;
    this._ruleId2desc = [null];
    this._includedGrammars = {};
    this._grammarRepository = grammarRepository;
    this._grammar = initGrammar(grammar, null);
    this._injections = null;
    this._tokenTypeMatchers = [];
    if (tokenTypes) {
      for (const selector of Object.keys(tokenTypes)) {
        const matchers = createMatchers(selector, nameMatcher);
        for (const matcher of matchers) {
          this._tokenTypeMatchers.push({
            matcher: matcher.matcher,
            type: tokenTypes[selector]
          });
        }
      }
    }
  }
  _rootId;
  _lastRuleId;
  _ruleId2desc;
  _includedGrammars;
  _grammarRepository;
  _grammar;
  _injections;
  _basicScopeAttributesProvider;
  _tokenTypeMatchers;
  get themeProvider() {
    return this._grammarRepository;
  }
  dispose() {
    for (const rule of this._ruleId2desc) {
      if (rule) {
        rule.dispose();
      }
    }
  }
  createOnigScanner(sources) {
    return this._onigLib.createOnigScanner(sources);
  }
  createOnigString(sources) {
    return this._onigLib.createOnigString(sources);
  }
  getMetadataForScope(scope) {
    return this._basicScopeAttributesProvider.getBasicScopeAttributes(scope);
  }
  _collectInjections() {
    const grammarRepository = {
      lookup: (scopeName2) => {
        if (scopeName2 === this._rootScopeName) {
          return this._grammar;
        }
        return this.getExternalGrammar(scopeName2);
      },
      injections: (scopeName2) => {
        return this._grammarRepository.injections(scopeName2);
      }
    };
    const result = [];
    const scopeName = this._rootScopeName;
    const grammar = grammarRepository.lookup(scopeName);
    if (grammar) {
      const rawInjections = grammar.injections;
      if (rawInjections) {
        for (let expression in rawInjections) {
          collectInjections(
            result,
            expression,
            rawInjections[expression],
            this,
            grammar
          );
        }
      }
      const injectionScopeNames = this._grammarRepository.injections(scopeName);
      if (injectionScopeNames) {
        injectionScopeNames.forEach((injectionScopeName) => {
          const injectionGrammar = this.getExternalGrammar(injectionScopeName);
          if (injectionGrammar) {
            const selector = injectionGrammar.injectionSelector;
            if (selector) {
              collectInjections(
                result,
                selector,
                injectionGrammar,
                this,
                injectionGrammar
              );
            }
          }
        });
      }
    }
    result.sort((i1, i2) => i1.priority - i2.priority);
    return result;
  }
  getInjections() {
    if (this._injections === null) {
      this._injections = this._collectInjections();
    }
    return this._injections;
  }
  registerRule(factory) {
    const id = ++this._lastRuleId;
    const result = factory(ruleIdFromNumber(id));
    this._ruleId2desc[id] = result;
    return result;
  }
  getRule(ruleId) {
    return this._ruleId2desc[ruleIdToNumber(ruleId)];
  }
  getExternalGrammar(scopeName, repository) {
    if (this._includedGrammars[scopeName]) {
      return this._includedGrammars[scopeName];
    } else if (this._grammarRepository) {
      const rawIncludedGrammar = this._grammarRepository.lookup(scopeName);
      if (rawIncludedGrammar) {
        this._includedGrammars[scopeName] = initGrammar(
          rawIncludedGrammar,
          repository && repository.$base
        );
        return this._includedGrammars[scopeName];
      }
    }
    return void 0;
  }
  tokenizeLine(lineText, prevState, timeLimit = 0) {
    const r = this._tokenize(lineText, prevState, false, timeLimit);
    return {
      tokens: r.lineTokens.getResult(r.ruleStack, r.lineLength),
      ruleStack: r.ruleStack,
      stoppedEarly: r.stoppedEarly
    };
  }
  tokenizeLine2(lineText, prevState, timeLimit = 0) {
    const r = this._tokenize(lineText, prevState, true, timeLimit);
    return {
      tokens: r.lineTokens.getBinaryResult(r.ruleStack, r.lineLength),
      ruleStack: r.ruleStack,
      stoppedEarly: r.stoppedEarly
    };
  }
  _tokenize(lineText, prevState, emitBinaryTokens, timeLimit) {
    if (this._rootId === -1) {
      this._rootId = RuleFactory.getCompiledRuleId(
        this._grammar.repository.$self,
        this,
        this._grammar.repository
      );
      this.getInjections();
    }
    let isFirstLine;
    if (!prevState || prevState === StateStackImpl.NULL) {
      isFirstLine = true;
      const rawDefaultMetadata = this._basicScopeAttributesProvider.getDefaultAttributes();
      const defaultStyle = this.themeProvider.getDefaults();
      const defaultMetadata = EncodedTokenMetadata.set(
        0,
        rawDefaultMetadata.languageId,
        rawDefaultMetadata.tokenType,
        null,
        defaultStyle.fontStyle,
        defaultStyle.foregroundId,
        defaultStyle.backgroundId
      );
      const rootScopeName = this.getRule(this._rootId).getName(
        null,
        null
      );
      let scopeList;
      if (rootScopeName) {
        scopeList = AttributedScopeStack.createRootAndLookUpScopeName(
          rootScopeName,
          defaultMetadata,
          this
        );
      } else {
        scopeList = AttributedScopeStack.createRoot(
          "unknown",
          defaultMetadata
        );
      }
      prevState = new StateStackImpl(
        null,
        this._rootId,
        -1,
        -1,
        false,
        null,
        scopeList,
        scopeList
      );
    } else {
      isFirstLine = false;
      prevState.reset();
    }
    lineText = lineText + "\n";
    const onigLineText = this.createOnigString(lineText);
    const lineLength = onigLineText.content.length;
    const lineTokens = new LineTokens(
      emitBinaryTokens,
      lineText,
      this._tokenTypeMatchers,
      this.balancedBracketSelectors
    );
    const r = _tokenizeString(
      this,
      onigLineText,
      isFirstLine,
      0,
      prevState,
      lineTokens,
      true,
      timeLimit
    );
    disposeOnigString(onigLineText);
    return {
      lineLength,
      lineTokens,
      ruleStack: r.stack,
      stoppedEarly: r.stoppedEarly
    };
  }
};
function initGrammar(grammar, base) {
  grammar = clone(grammar);
  grammar.repository = grammar.repository || {};
  grammar.repository.$self = {
    $vscodeTextmateLocation: grammar.$vscodeTextmateLocation,
    patterns: grammar.patterns,
    name: grammar.scopeName
  };
  grammar.repository.$base = base || grammar.repository.$self;
  return grammar;
}
var AttributedScopeStack = class _AttributedScopeStack {
  /**
   * Invariant:
   * ```
   * if (parent && !scopePath.extends(parent.scopePath)) {
   * 	throw new Error();
   * }
   * ```
   */
  constructor(parent, scopePath, tokenAttributes) {
    this.parent = parent;
    this.scopePath = scopePath;
    this.tokenAttributes = tokenAttributes;
  }
  static fromExtension(namesScopeList, contentNameScopesList) {
    let current = namesScopeList;
    let scopeNames = namesScopeList?.scopePath ?? null;
    for (const frame of contentNameScopesList) {
      scopeNames = ScopeStack.push(scopeNames, frame.scopeNames);
      current = new _AttributedScopeStack(current, scopeNames, frame.encodedTokenAttributes);
    }
    return current;
  }
  static createRoot(scopeName, tokenAttributes) {
    return new _AttributedScopeStack(null, new ScopeStack(null, scopeName), tokenAttributes);
  }
  static createRootAndLookUpScopeName(scopeName, tokenAttributes, grammar) {
    const rawRootMetadata = grammar.getMetadataForScope(scopeName);
    const scopePath = new ScopeStack(null, scopeName);
    const rootStyle = grammar.themeProvider.themeMatch(scopePath);
    const resolvedTokenAttributes = _AttributedScopeStack.mergeAttributes(
      tokenAttributes,
      rawRootMetadata,
      rootStyle
    );
    return new _AttributedScopeStack(null, scopePath, resolvedTokenAttributes);
  }
  get scopeName() {
    return this.scopePath.scopeName;
  }
  toString() {
    return this.getScopeNames().join(" ");
  }
  equals(other) {
    return _AttributedScopeStack.equals(this, other);
  }
  static equals(a, b) {
    do {
      if (a === b) {
        return true;
      }
      if (!a && !b) {
        return true;
      }
      if (!a || !b) {
        return false;
      }
      if (a.scopeName !== b.scopeName || a.tokenAttributes !== b.tokenAttributes) {
        return false;
      }
      a = a.parent;
      b = b.parent;
    } while (true);
  }
  static mergeAttributes(existingTokenAttributes, basicScopeAttributes, styleAttributes) {
    let fontStyle = -1;
    let foreground = 0;
    let background = 0;
    if (styleAttributes !== null) {
      fontStyle = styleAttributes.fontStyle;
      foreground = styleAttributes.foregroundId;
      background = styleAttributes.backgroundId;
    }
    return EncodedTokenMetadata.set(
      existingTokenAttributes,
      basicScopeAttributes.languageId,
      basicScopeAttributes.tokenType,
      null,
      fontStyle,
      foreground,
      background
    );
  }
  pushAttributed(scopePath, grammar) {
    if (scopePath === null) {
      return this;
    }
    if (scopePath.indexOf(" ") === -1) {
      return _AttributedScopeStack._pushAttributed(this, scopePath, grammar);
    }
    const scopes = scopePath.split(/ /g);
    let result = this;
    for (const scope of scopes) {
      result = _AttributedScopeStack._pushAttributed(result, scope, grammar);
    }
    return result;
  }
  static _pushAttributed(target, scopeName, grammar) {
    const rawMetadata = grammar.getMetadataForScope(scopeName);
    const newPath = target.scopePath.push(scopeName);
    const scopeThemeMatchResult = grammar.themeProvider.themeMatch(newPath);
    const metadata = _AttributedScopeStack.mergeAttributes(
      target.tokenAttributes,
      rawMetadata,
      scopeThemeMatchResult
    );
    return new _AttributedScopeStack(target, newPath, metadata);
  }
  getScopeNames() {
    return this.scopePath.getSegments();
  }
  getExtensionIfDefined(base) {
    const result = [];
    let self = this;
    while (self && self !== base) {
      result.push({
        encodedTokenAttributes: self.tokenAttributes,
        scopeNames: self.scopePath.getExtensionIfDefined(self.parent?.scopePath ?? null)
      });
      self = self.parent;
    }
    return self === base ? result.reverse() : void 0;
  }
};
var StateStackImpl = class _StateStackImpl {
  /**
   * Invariant:
   * ```
   * if (contentNameScopesList !== nameScopesList && contentNameScopesList?.parent !== nameScopesList) {
   * 	throw new Error();
   * }
   * if (this.parent && !nameScopesList.extends(this.parent.contentNameScopesList)) {
   * 	throw new Error();
   * }
   * ```
   */
  constructor(parent, ruleId, enterPos, anchorPos, beginRuleCapturedEOL, endRule, nameScopesList, contentNameScopesList) {
    this.parent = parent;
    this.ruleId = ruleId;
    this.beginRuleCapturedEOL = beginRuleCapturedEOL;
    this.endRule = endRule;
    this.nameScopesList = nameScopesList;
    this.contentNameScopesList = contentNameScopesList;
    this.depth = this.parent ? this.parent.depth + 1 : 1;
    this._enterPos = enterPos;
    this._anchorPos = anchorPos;
  }
  _stackElementBrand = void 0;
  // TODO remove me
  static NULL = new _StateStackImpl(
    null,
    0,
    0,
    0,
    false,
    null,
    null,
    null
  );
  /**
   * The position on the current line where this state was pushed.
   * This is relevant only while tokenizing a line, to detect endless loops.
   * Its value is meaningless across lines.
   */
  _enterPos;
  /**
   * The captured anchor position when this stack element was pushed.
   * This is relevant only while tokenizing a line, to restore the anchor position when popping.
   * Its value is meaningless across lines.
   */
  _anchorPos;
  /**
   * The depth of the stack.
   */
  depth;
  equals(other) {
    if (other === null) {
      return false;
    }
    return _StateStackImpl._equals(this, other);
  }
  static _equals(a, b) {
    if (a === b) {
      return true;
    }
    if (!this._structuralEquals(a, b)) {
      return false;
    }
    return AttributedScopeStack.equals(a.contentNameScopesList, b.contentNameScopesList);
  }
  /**
   * A structural equals check. Does not take into account `scopes`.
   */
  static _structuralEquals(a, b) {
    do {
      if (a === b) {
        return true;
      }
      if (!a && !b) {
        return true;
      }
      if (!a || !b) {
        return false;
      }
      if (a.depth !== b.depth || a.ruleId !== b.ruleId || a.endRule !== b.endRule) {
        return false;
      }
      a = a.parent;
      b = b.parent;
    } while (true);
  }
  clone() {
    return this;
  }
  static _reset(el) {
    while (el) {
      el._enterPos = -1;
      el._anchorPos = -1;
      el = el.parent;
    }
  }
  reset() {
    _StateStackImpl._reset(this);
  }
  pop() {
    return this.parent;
  }
  safePop() {
    if (this.parent) {
      return this.parent;
    }
    return this;
  }
  push(ruleId, enterPos, anchorPos, beginRuleCapturedEOL, endRule, nameScopesList, contentNameScopesList) {
    return new _StateStackImpl(
      this,
      ruleId,
      enterPos,
      anchorPos,
      beginRuleCapturedEOL,
      endRule,
      nameScopesList,
      contentNameScopesList
    );
  }
  getEnterPos() {
    return this._enterPos;
  }
  getAnchorPos() {
    return this._anchorPos;
  }
  getRule(grammar) {
    return grammar.getRule(this.ruleId);
  }
  toString() {
    const r = [];
    this._writeString(r, 0);
    return "[" + r.join(",") + "]";
  }
  _writeString(res, outIndex) {
    if (this.parent) {
      outIndex = this.parent._writeString(res, outIndex);
    }
    res[outIndex++] = `(${this.ruleId}, ${this.nameScopesList?.toString()}, ${this.contentNameScopesList?.toString()})`;
    return outIndex;
  }
  withContentNameScopesList(contentNameScopeStack) {
    if (this.contentNameScopesList === contentNameScopeStack) {
      return this;
    }
    return this.parent.push(
      this.ruleId,
      this._enterPos,
      this._anchorPos,
      this.beginRuleCapturedEOL,
      this.endRule,
      this.nameScopesList,
      contentNameScopeStack
    );
  }
  withEndRule(endRule) {
    if (this.endRule === endRule) {
      return this;
    }
    return new _StateStackImpl(
      this.parent,
      this.ruleId,
      this._enterPos,
      this._anchorPos,
      this.beginRuleCapturedEOL,
      endRule,
      this.nameScopesList,
      this.contentNameScopesList
    );
  }
  // Used to warn of endless loops
  hasSameRuleAs(other) {
    let el = this;
    while (el && el._enterPos === other._enterPos) {
      if (el.ruleId === other.ruleId) {
        return true;
      }
      el = el.parent;
    }
    return false;
  }
  toStateStackFrame() {
    return {
      ruleId: ruleIdToNumber(this.ruleId),
      beginRuleCapturedEOL: this.beginRuleCapturedEOL,
      endRule: this.endRule,
      nameScopesList: this.nameScopesList?.getExtensionIfDefined(this.parent?.nameScopesList ?? null) ?? [],
      contentNameScopesList: this.contentNameScopesList?.getExtensionIfDefined(this.nameScopesList) ?? []
    };
  }
  static pushFrame(self, frame) {
    const namesScopeList = AttributedScopeStack.fromExtension(self?.nameScopesList ?? null, frame.nameScopesList);
    return new _StateStackImpl(
      self,
      ruleIdFromNumber(frame.ruleId),
      frame.enterPos ?? -1,
      frame.anchorPos ?? -1,
      frame.beginRuleCapturedEOL,
      frame.endRule,
      namesScopeList,
      AttributedScopeStack.fromExtension(namesScopeList, frame.contentNameScopesList)
    );
  }
};
var BalancedBracketSelectors = class {
  balancedBracketScopes;
  unbalancedBracketScopes;
  allowAny = false;
  constructor(balancedBracketScopes, unbalancedBracketScopes) {
    this.balancedBracketScopes = balancedBracketScopes.flatMap(
      (selector) => {
        if (selector === "*") {
          this.allowAny = true;
          return [];
        }
        return createMatchers(selector, nameMatcher).map((m) => m.matcher);
      }
    );
    this.unbalancedBracketScopes = unbalancedBracketScopes.flatMap(
      (selector) => createMatchers(selector, nameMatcher).map((m) => m.matcher)
    );
  }
  get matchesAlways() {
    return this.allowAny && this.unbalancedBracketScopes.length === 0;
  }
  get matchesNever() {
    return this.balancedBracketScopes.length === 0 && !this.allowAny;
  }
  match(scopes) {
    for (const excluder of this.unbalancedBracketScopes) {
      if (excluder(scopes)) {
        return false;
      }
    }
    for (const includer of this.balancedBracketScopes) {
      if (includer(scopes)) {
        return true;
      }
    }
    return this.allowAny;
  }
};
var LineTokens = class {
  constructor(emitBinaryTokens, lineText, tokenTypeOverrides, balancedBracketSelectors) {
    this.balancedBracketSelectors = balancedBracketSelectors;
    this._emitBinaryTokens = emitBinaryTokens;
    this._tokenTypeOverrides = tokenTypeOverrides;
    {
      this._lineText = null;
    }
    this._tokens = [];
    this._binaryTokens = [];
    this._lastTokenEndIndex = 0;
  }
  _emitBinaryTokens;
  /**
   * defined only if `false`.
   */
  _lineText;
  /**
   * used only if `_emitBinaryTokens` is false.
   */
  _tokens;
  /**
   * used only if `_emitBinaryTokens` is true.
   */
  _binaryTokens;
  _lastTokenEndIndex;
  _tokenTypeOverrides;
  produce(stack, endIndex) {
    this.produceFromScopes(stack.contentNameScopesList, endIndex);
  }
  produceFromScopes(scopesList, endIndex) {
    if (this._lastTokenEndIndex >= endIndex) {
      return;
    }
    if (this._emitBinaryTokens) {
      let metadata = scopesList?.tokenAttributes ?? 0;
      let containsBalancedBrackets = false;
      if (this.balancedBracketSelectors?.matchesAlways) {
        containsBalancedBrackets = true;
      }
      if (this._tokenTypeOverrides.length > 0 || this.balancedBracketSelectors && !this.balancedBracketSelectors.matchesAlways && !this.balancedBracketSelectors.matchesNever) {
        const scopes2 = scopesList?.getScopeNames() ?? [];
        for (const tokenType of this._tokenTypeOverrides) {
          if (tokenType.matcher(scopes2)) {
            metadata = EncodedTokenMetadata.set(
              metadata,
              0,
              toOptionalTokenType(tokenType.type),
              null,
              -1,
              0,
              0
            );
          }
        }
        if (this.balancedBracketSelectors) {
          containsBalancedBrackets = this.balancedBracketSelectors.match(scopes2);
        }
      }
      if (containsBalancedBrackets) {
        metadata = EncodedTokenMetadata.set(
          metadata,
          0,
          8,
          containsBalancedBrackets,
          -1,
          0,
          0
        );
      }
      if (this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 1] === metadata) {
        this._lastTokenEndIndex = endIndex;
        return;
      }
      this._binaryTokens.push(this._lastTokenEndIndex);
      this._binaryTokens.push(metadata);
      this._lastTokenEndIndex = endIndex;
      return;
    }
    const scopes = scopesList?.getScopeNames() ?? [];
    this._tokens.push({
      startIndex: this._lastTokenEndIndex,
      endIndex,
      // value: lineText.substring(lastTokenEndIndex, endIndex),
      scopes
    });
    this._lastTokenEndIndex = endIndex;
  }
  getResult(stack, lineLength) {
    if (this._tokens.length > 0 && this._tokens[this._tokens.length - 1].startIndex === lineLength - 1) {
      this._tokens.pop();
    }
    if (this._tokens.length === 0) {
      this._lastTokenEndIndex = -1;
      this.produce(stack, lineLength);
      this._tokens[this._tokens.length - 1].startIndex = 0;
    }
    return this._tokens;
  }
  getBinaryResult(stack, lineLength) {
    if (this._binaryTokens.length > 0 && this._binaryTokens[this._binaryTokens.length - 2] === lineLength - 1) {
      this._binaryTokens.pop();
      this._binaryTokens.pop();
    }
    if (this._binaryTokens.length === 0) {
      this._lastTokenEndIndex = -1;
      this.produce(stack, lineLength);
      this._binaryTokens[this._binaryTokens.length - 2] = 0;
    }
    const result = new Uint32Array(this._binaryTokens.length);
    for (let i = 0, len = this._binaryTokens.length; i < len; i++) {
      result[i] = this._binaryTokens[i];
    }
    return result;
  }
};
var SyncRegistry = class {
  constructor(theme, _onigLib) {
    this._onigLib = _onigLib;
    this._theme = theme;
  }
  _grammars = /* @__PURE__ */ new Map();
  _rawGrammars = /* @__PURE__ */ new Map();
  _injectionGrammars = /* @__PURE__ */ new Map();
  _theme;
  dispose() {
    for (const grammar of this._grammars.values()) {
      grammar.dispose();
    }
  }
  setTheme(theme) {
    this._theme = theme;
  }
  getColorMap() {
    return this._theme.getColorMap();
  }
  /**
   * Add `grammar` to registry and return a list of referenced scope names
   */
  addGrammar(grammar, injectionScopeNames) {
    this._rawGrammars.set(grammar.scopeName, grammar);
    if (injectionScopeNames) {
      this._injectionGrammars.set(grammar.scopeName, injectionScopeNames);
    }
  }
  /**
   * Lookup a raw grammar.
   */
  lookup(scopeName) {
    return this._rawGrammars.get(scopeName);
  }
  /**
   * Returns the injections for the given grammar
   */
  injections(targetScope) {
    return this._injectionGrammars.get(targetScope);
  }
  /**
   * Get the default theme settings
   */
  getDefaults() {
    return this._theme.getDefaults();
  }
  /**
   * Match a scope in the theme.
   */
  themeMatch(scopePath) {
    return this._theme.match(scopePath);
  }
  /**
   * Lookup a grammar.
   */
  grammarForScopeName(scopeName, initialLanguage, embeddedLanguages, tokenTypes, balancedBracketSelectors) {
    if (!this._grammars.has(scopeName)) {
      let rawGrammar = this._rawGrammars.get(scopeName);
      if (!rawGrammar) {
        return null;
      }
      this._grammars.set(scopeName, createGrammar(
        scopeName,
        rawGrammar,
        initialLanguage,
        embeddedLanguages,
        tokenTypes,
        balancedBracketSelectors,
        this,
        this._onigLib
      ));
    }
    return this._grammars.get(scopeName);
  }
};
var Registry$1 = class Registry2 {
  _options;
  _syncRegistry;
  _ensureGrammarCache;
  constructor(options2) {
    this._options = options2;
    this._syncRegistry = new SyncRegistry(
      Theme.createFromRawTheme(options2.theme, options2.colorMap),
      options2.onigLib
    );
    this._ensureGrammarCache = /* @__PURE__ */ new Map();
  }
  dispose() {
    this._syncRegistry.dispose();
  }
  /**
   * Change the theme. Once called, no previous `ruleStack` should be used anymore.
   */
  setTheme(theme, colorMap) {
    this._syncRegistry.setTheme(Theme.createFromRawTheme(theme, colorMap));
  }
  /**
   * Returns a lookup array for color ids.
   */
  getColorMap() {
    return this._syncRegistry.getColorMap();
  }
  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   * Please do not use language id 0.
   */
  loadGrammarWithEmbeddedLanguages(initialScopeName, initialLanguage, embeddedLanguages) {
    return this.loadGrammarWithConfiguration(initialScopeName, initialLanguage, { embeddedLanguages });
  }
  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   * Please do not use language id 0.
   */
  loadGrammarWithConfiguration(initialScopeName, initialLanguage, configuration) {
    return this._loadGrammar(
      initialScopeName,
      initialLanguage,
      configuration.embeddedLanguages,
      configuration.tokenTypes,
      new BalancedBracketSelectors(
        configuration.balancedBracketSelectors || [],
        configuration.unbalancedBracketSelectors || []
      )
    );
  }
  /**
   * Load the grammar for `scopeName` and all referenced included grammars asynchronously.
   */
  loadGrammar(initialScopeName) {
    return this._loadGrammar(initialScopeName, 0, null, null, null);
  }
  _loadGrammar(initialScopeName, initialLanguage, embeddedLanguages, tokenTypes, balancedBracketSelectors) {
    const dependencyProcessor = new ScopeDependencyProcessor(this._syncRegistry, initialScopeName);
    while (dependencyProcessor.Q.length > 0) {
      dependencyProcessor.Q.map((request) => this._loadSingleGrammar(request.scopeName));
      dependencyProcessor.processQueue();
    }
    return this._grammarForScopeName(
      initialScopeName,
      initialLanguage,
      embeddedLanguages,
      tokenTypes,
      balancedBracketSelectors
    );
  }
  _loadSingleGrammar(scopeName) {
    if (!this._ensureGrammarCache.has(scopeName)) {
      this._doLoadSingleGrammar(scopeName);
      this._ensureGrammarCache.set(scopeName, true);
    }
  }
  _doLoadSingleGrammar(scopeName) {
    const grammar = this._options.loadGrammar(scopeName);
    if (grammar) {
      const injections = typeof this._options.getInjections === "function" ? this._options.getInjections(scopeName) : void 0;
      this._syncRegistry.addGrammar(grammar, injections);
    }
  }
  /**
   * Adds a rawGrammar.
   */
  addGrammar(rawGrammar, injections = [], initialLanguage = 0, embeddedLanguages = null) {
    this._syncRegistry.addGrammar(rawGrammar, injections);
    return this._grammarForScopeName(rawGrammar.scopeName, initialLanguage, embeddedLanguages);
  }
  /**
   * Get the grammar for `scopeName`. The grammar must first be created via `loadGrammar` or `addGrammar`.
   */
  _grammarForScopeName(scopeName, initialLanguage = 0, embeddedLanguages = null, tokenTypes = null, balancedBracketSelectors = null) {
    return this._syncRegistry.grammarForScopeName(
      scopeName,
      initialLanguage,
      embeddedLanguages,
      tokenTypes,
      balancedBracketSelectors
    );
  }
};
var INITIAL = StateStackImpl.NULL;
const htmlVoidElements = [
  "area",
  "base",
  "basefont",
  "bgsound",
  "br",
  "col",
  "command",
  "embed",
  "frame",
  "hr",
  "image",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
];
class Schema {
  /**
   * @param {SchemaType['property']} property
   *   Property.
   * @param {SchemaType['normal']} normal
   *   Normal.
   * @param {Space | undefined} [space]
   *   Space.
   * @returns
   *   Schema.
   */
  constructor(property, normal, space) {
    this.normal = normal;
    this.property = property;
    if (space) {
      this.space = space;
    }
  }
}
Schema.prototype.normal = {};
Schema.prototype.property = {};
Schema.prototype.space = void 0;
function merge(definitions, space) {
  const property = {};
  const normal = {};
  for (const definition of definitions) {
    Object.assign(property, definition.property);
    Object.assign(normal, definition.normal);
  }
  return new Schema(property, normal, space);
}
function normalize(value) {
  return value.toLowerCase();
}
class Info {
  /**
   * @param {string} property
   *   Property.
   * @param {string} attribute
   *   Attribute.
   * @returns
   *   Info.
   */
  constructor(property, attribute) {
    this.attribute = attribute;
    this.property = property;
  }
}
Info.prototype.attribute = "";
Info.prototype.booleanish = false;
Info.prototype.boolean = false;
Info.prototype.commaOrSpaceSeparated = false;
Info.prototype.commaSeparated = false;
Info.prototype.defined = false;
Info.prototype.mustUseProperty = false;
Info.prototype.number = false;
Info.prototype.overloadedBoolean = false;
Info.prototype.property = "";
Info.prototype.spaceSeparated = false;
Info.prototype.space = void 0;
let powers = 0;
const boolean = increment();
const booleanish = increment();
const overloadedBoolean = increment();
const number = increment();
const spaceSeparated = increment();
const commaSeparated = increment();
const commaOrSpaceSeparated = increment();
function increment() {
  return 2 ** ++powers;
}
const types = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  boolean,
  booleanish,
  commaOrSpaceSeparated,
  commaSeparated,
  number,
  overloadedBoolean,
  spaceSeparated
}, Symbol.toStringTag, { value: "Module" }));
const checks = (
  /** @type {ReadonlyArray<keyof typeof types>} */
  Object.keys(types)
);
class DefinedInfo extends Info {
  /**
   * @constructor
   * @param {string} property
   *   Property.
   * @param {string} attribute
   *   Attribute.
   * @param {number | null | undefined} [mask]
   *   Mask.
   * @param {Space | undefined} [space]
   *   Space.
   * @returns
   *   Info.
   */
  constructor(property, attribute, mask, space) {
    let index = -1;
    super(property, attribute);
    mark(this, "space", space);
    if (typeof mask === "number") {
      while (++index < checks.length) {
        const check = checks[index];
        mark(this, checks[index], (mask & types[check]) === types[check]);
      }
    }
  }
}
DefinedInfo.prototype.defined = true;
function mark(values, key2, value) {
  if (value) {
    values[key2] = value;
  }
}
function create(definition) {
  const properties = {};
  const normals = {};
  for (const [property, value] of Object.entries(definition.properties)) {
    const info = new DefinedInfo(
      property,
      definition.transform(definition.attributes || {}, property),
      value,
      definition.space
    );
    if (definition.mustUseProperty && definition.mustUseProperty.includes(property)) {
      info.mustUseProperty = true;
    }
    properties[property] = info;
    normals[normalize(property)] = property;
    normals[normalize(info.attribute)] = property;
  }
  return new Schema(properties, normals, definition.space);
}
const aria = create({
  properties: {
    ariaActiveDescendant: null,
    ariaAtomic: booleanish,
    ariaAutoComplete: null,
    ariaBusy: booleanish,
    ariaChecked: booleanish,
    ariaColCount: number,
    ariaColIndex: number,
    ariaColSpan: number,
    ariaControls: spaceSeparated,
    ariaCurrent: null,
    ariaDescribedBy: spaceSeparated,
    ariaDetails: null,
    ariaDisabled: booleanish,
    ariaDropEffect: spaceSeparated,
    ariaErrorMessage: null,
    ariaExpanded: booleanish,
    ariaFlowTo: spaceSeparated,
    ariaGrabbed: booleanish,
    ariaHasPopup: null,
    ariaHidden: booleanish,
    ariaInvalid: null,
    ariaKeyShortcuts: null,
    ariaLabel: null,
    ariaLabelledBy: spaceSeparated,
    ariaLevel: number,
    ariaLive: null,
    ariaModal: booleanish,
    ariaMultiLine: booleanish,
    ariaMultiSelectable: booleanish,
    ariaOrientation: null,
    ariaOwns: spaceSeparated,
    ariaPlaceholder: null,
    ariaPosInSet: number,
    ariaPressed: booleanish,
    ariaReadOnly: booleanish,
    ariaRelevant: null,
    ariaRequired: booleanish,
    ariaRoleDescription: spaceSeparated,
    ariaRowCount: number,
    ariaRowIndex: number,
    ariaRowSpan: number,
    ariaSelected: booleanish,
    ariaSetSize: number,
    ariaSort: null,
    ariaValueMax: number,
    ariaValueMin: number,
    ariaValueNow: number,
    ariaValueText: null,
    role: null
  },
  transform(_, property) {
    return property === "role" ? property : "aria-" + property.slice(4).toLowerCase();
  }
});
function caseSensitiveTransform(attributes, attribute) {
  return attribute in attributes ? attributes[attribute] : attribute;
}
function caseInsensitiveTransform(attributes, property) {
  return caseSensitiveTransform(attributes, property.toLowerCase());
}
const html$3 = create({
  attributes: {
    acceptcharset: "accept-charset",
    classname: "class",
    htmlfor: "for",
    httpequiv: "http-equiv"
  },
  mustUseProperty: ["checked", "multiple", "muted", "selected"],
  properties: {
    // Standard Properties.
    abbr: null,
    accept: commaSeparated,
    acceptCharset: spaceSeparated,
    accessKey: spaceSeparated,
    action: null,
    allow: null,
    allowFullScreen: boolean,
    allowPaymentRequest: boolean,
    allowUserMedia: boolean,
    alt: null,
    as: null,
    async: boolean,
    autoCapitalize: null,
    autoComplete: spaceSeparated,
    autoFocus: boolean,
    autoPlay: boolean,
    blocking: spaceSeparated,
    capture: null,
    charSet: null,
    checked: boolean,
    cite: null,
    className: spaceSeparated,
    cols: number,
    colSpan: null,
    content: null,
    contentEditable: booleanish,
    controls: boolean,
    controlsList: spaceSeparated,
    coords: number | commaSeparated,
    crossOrigin: null,
    data: null,
    dateTime: null,
    decoding: null,
    default: boolean,
    defer: boolean,
    dir: null,
    dirName: null,
    disabled: boolean,
    download: overloadedBoolean,
    draggable: booleanish,
    encType: null,
    enterKeyHint: null,
    fetchPriority: null,
    form: null,
    formAction: null,
    formEncType: null,
    formMethod: null,
    formNoValidate: boolean,
    formTarget: null,
    headers: spaceSeparated,
    height: number,
    hidden: overloadedBoolean,
    high: number,
    href: null,
    hrefLang: null,
    htmlFor: spaceSeparated,
    httpEquiv: spaceSeparated,
    id: null,
    imageSizes: null,
    imageSrcSet: null,
    inert: boolean,
    inputMode: null,
    integrity: null,
    is: null,
    isMap: boolean,
    itemId: null,
    itemProp: spaceSeparated,
    itemRef: spaceSeparated,
    itemScope: boolean,
    itemType: spaceSeparated,
    kind: null,
    label: null,
    lang: null,
    language: null,
    list: null,
    loading: null,
    loop: boolean,
    low: number,
    manifest: null,
    max: null,
    maxLength: number,
    media: null,
    method: null,
    min: null,
    minLength: number,
    multiple: boolean,
    muted: boolean,
    name: null,
    nonce: null,
    noModule: boolean,
    noValidate: boolean,
    onAbort: null,
    onAfterPrint: null,
    onAuxClick: null,
    onBeforeMatch: null,
    onBeforePrint: null,
    onBeforeToggle: null,
    onBeforeUnload: null,
    onBlur: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onContextLost: null,
    onContextMenu: null,
    onContextRestored: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFormData: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLanguageChange: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadEnd: null,
    onLoadStart: null,
    onMessage: null,
    onMessageError: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRejectionHandled: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onScrollEnd: null,
    onSecurityPolicyViolation: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onSlotChange: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnhandledRejection: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onWheel: null,
    open: boolean,
    optimum: number,
    pattern: null,
    ping: spaceSeparated,
    placeholder: null,
    playsInline: boolean,
    popover: null,
    popoverTarget: null,
    popoverTargetAction: null,
    poster: null,
    preload: null,
    readOnly: boolean,
    referrerPolicy: null,
    rel: spaceSeparated,
    required: boolean,
    reversed: boolean,
    rows: number,
    rowSpan: number,
    sandbox: spaceSeparated,
    scope: null,
    scoped: boolean,
    seamless: boolean,
    selected: boolean,
    shadowRootClonable: boolean,
    shadowRootDelegatesFocus: boolean,
    shadowRootMode: null,
    shape: null,
    size: number,
    sizes: null,
    slot: null,
    span: number,
    spellCheck: booleanish,
    src: null,
    srcDoc: null,
    srcLang: null,
    srcSet: null,
    start: number,
    step: null,
    style: null,
    tabIndex: number,
    target: null,
    title: null,
    translate: null,
    type: null,
    typeMustMatch: boolean,
    useMap: null,
    value: booleanish,
    width: number,
    wrap: null,
    writingSuggestions: null,
    // Legacy.
    // See: https://html.spec.whatwg.org/#other-elements,-attributes-and-apis
    align: null,
    // Several. Use CSS `text-align` instead,
    aLink: null,
    // `<body>`. Use CSS `a:active {color}` instead
    archive: spaceSeparated,
    // `<object>`. List of URIs to archives
    axis: null,
    // `<td>` and `<th>`. Use `scope` on `<th>`
    background: null,
    // `<body>`. Use CSS `background-image` instead
    bgColor: null,
    // `<body>` and table elements. Use CSS `background-color` instead
    border: number,
    // `<table>`. Use CSS `border-width` instead,
    borderColor: null,
    // `<table>`. Use CSS `border-color` instead,
    bottomMargin: number,
    // `<body>`
    cellPadding: null,
    // `<table>`
    cellSpacing: null,
    // `<table>`
    char: null,
    // Several table elements. When `align=char`, sets the character to align on
    charOff: null,
    // Several table elements. When `char`, offsets the alignment
    classId: null,
    // `<object>`
    clear: null,
    // `<br>`. Use CSS `clear` instead
    code: null,
    // `<object>`
    codeBase: null,
    // `<object>`
    codeType: null,
    // `<object>`
    color: null,
    // `<font>` and `<hr>`. Use CSS instead
    compact: boolean,
    // Lists. Use CSS to reduce space between items instead
    declare: boolean,
    // `<object>`
    event: null,
    // `<script>`
    face: null,
    // `<font>`. Use CSS instead
    frame: null,
    // `<table>`
    frameBorder: null,
    // `<iframe>`. Use CSS `border` instead
    hSpace: number,
    // `<img>` and `<object>`
    leftMargin: number,
    // `<body>`
    link: null,
    // `<body>`. Use CSS `a:link {color: *}` instead
    longDesc: null,
    // `<frame>`, `<iframe>`, and `<img>`. Use an `<a>`
    lowSrc: null,
    // `<img>`. Use a `<picture>`
    marginHeight: number,
    // `<body>`
    marginWidth: number,
    // `<body>`
    noResize: boolean,
    // `<frame>`
    noHref: boolean,
    // `<area>`. Use no href instead of an explicit `nohref`
    noShade: boolean,
    // `<hr>`. Use background-color and height instead of borders
    noWrap: boolean,
    // `<td>` and `<th>`
    object: null,
    // `<applet>`
    profile: null,
    // `<head>`
    prompt: null,
    // `<isindex>`
    rev: null,
    // `<link>`
    rightMargin: number,
    // `<body>`
    rules: null,
    // `<table>`
    scheme: null,
    // `<meta>`
    scrolling: booleanish,
    // `<frame>`. Use overflow in the child context
    standby: null,
    // `<object>`
    summary: null,
    // `<table>`
    text: null,
    // `<body>`. Use CSS `color` instead
    topMargin: number,
    // `<body>`
    valueType: null,
    // `<param>`
    version: null,
    // `<html>`. Use a doctype.
    vAlign: null,
    // Several. Use CSS `vertical-align` instead
    vLink: null,
    // `<body>`. Use CSS `a:visited {color}` instead
    vSpace: number,
    // `<img>` and `<object>`
    // Non-standard Properties.
    allowTransparency: null,
    autoCorrect: null,
    autoSave: null,
    disablePictureInPicture: boolean,
    disableRemotePlayback: boolean,
    prefix: null,
    property: null,
    results: number,
    security: null,
    unselectable: null
  },
  space: "html",
  transform: caseInsensitiveTransform
});
const svg$1 = create({
  attributes: {
    accentHeight: "accent-height",
    alignmentBaseline: "alignment-baseline",
    arabicForm: "arabic-form",
    baselineShift: "baseline-shift",
    capHeight: "cap-height",
    className: "class",
    clipPath: "clip-path",
    clipRule: "clip-rule",
    colorInterpolation: "color-interpolation",
    colorInterpolationFilters: "color-interpolation-filters",
    colorProfile: "color-profile",
    colorRendering: "color-rendering",
    crossOrigin: "crossorigin",
    dataType: "datatype",
    dominantBaseline: "dominant-baseline",
    enableBackground: "enable-background",
    fillOpacity: "fill-opacity",
    fillRule: "fill-rule",
    floodColor: "flood-color",
    floodOpacity: "flood-opacity",
    fontFamily: "font-family",
    fontSize: "font-size",
    fontSizeAdjust: "font-size-adjust",
    fontStretch: "font-stretch",
    fontStyle: "font-style",
    fontVariant: "font-variant",
    fontWeight: "font-weight",
    glyphName: "glyph-name",
    glyphOrientationHorizontal: "glyph-orientation-horizontal",
    glyphOrientationVertical: "glyph-orientation-vertical",
    hrefLang: "hreflang",
    horizAdvX: "horiz-adv-x",
    horizOriginX: "horiz-origin-x",
    horizOriginY: "horiz-origin-y",
    imageRendering: "image-rendering",
    letterSpacing: "letter-spacing",
    lightingColor: "lighting-color",
    markerEnd: "marker-end",
    markerMid: "marker-mid",
    markerStart: "marker-start",
    navDown: "nav-down",
    navDownLeft: "nav-down-left",
    navDownRight: "nav-down-right",
    navLeft: "nav-left",
    navNext: "nav-next",
    navPrev: "nav-prev",
    navRight: "nav-right",
    navUp: "nav-up",
    navUpLeft: "nav-up-left",
    navUpRight: "nav-up-right",
    onAbort: "onabort",
    onActivate: "onactivate",
    onAfterPrint: "onafterprint",
    onBeforePrint: "onbeforeprint",
    onBegin: "onbegin",
    onCancel: "oncancel",
    onCanPlay: "oncanplay",
    onCanPlayThrough: "oncanplaythrough",
    onChange: "onchange",
    onClick: "onclick",
    onClose: "onclose",
    onCopy: "oncopy",
    onCueChange: "oncuechange",
    onCut: "oncut",
    onDblClick: "ondblclick",
    onDrag: "ondrag",
    onDragEnd: "ondragend",
    onDragEnter: "ondragenter",
    onDragExit: "ondragexit",
    onDragLeave: "ondragleave",
    onDragOver: "ondragover",
    onDragStart: "ondragstart",
    onDrop: "ondrop",
    onDurationChange: "ondurationchange",
    onEmptied: "onemptied",
    onEnd: "onend",
    onEnded: "onended",
    onError: "onerror",
    onFocus: "onfocus",
    onFocusIn: "onfocusin",
    onFocusOut: "onfocusout",
    onHashChange: "onhashchange",
    onInput: "oninput",
    onInvalid: "oninvalid",
    onKeyDown: "onkeydown",
    onKeyPress: "onkeypress",
    onKeyUp: "onkeyup",
    onLoad: "onload",
    onLoadedData: "onloadeddata",
    onLoadedMetadata: "onloadedmetadata",
    onLoadStart: "onloadstart",
    onMessage: "onmessage",
    onMouseDown: "onmousedown",
    onMouseEnter: "onmouseenter",
    onMouseLeave: "onmouseleave",
    onMouseMove: "onmousemove",
    onMouseOut: "onmouseout",
    onMouseOver: "onmouseover",
    onMouseUp: "onmouseup",
    onMouseWheel: "onmousewheel",
    onOffline: "onoffline",
    onOnline: "ononline",
    onPageHide: "onpagehide",
    onPageShow: "onpageshow",
    onPaste: "onpaste",
    onPause: "onpause",
    onPlay: "onplay",
    onPlaying: "onplaying",
    onPopState: "onpopstate",
    onProgress: "onprogress",
    onRateChange: "onratechange",
    onRepeat: "onrepeat",
    onReset: "onreset",
    onResize: "onresize",
    onScroll: "onscroll",
    onSeeked: "onseeked",
    onSeeking: "onseeking",
    onSelect: "onselect",
    onShow: "onshow",
    onStalled: "onstalled",
    onStorage: "onstorage",
    onSubmit: "onsubmit",
    onSuspend: "onsuspend",
    onTimeUpdate: "ontimeupdate",
    onToggle: "ontoggle",
    onUnload: "onunload",
    onVolumeChange: "onvolumechange",
    onWaiting: "onwaiting",
    onZoom: "onzoom",
    overlinePosition: "overline-position",
    overlineThickness: "overline-thickness",
    paintOrder: "paint-order",
    panose1: "panose-1",
    pointerEvents: "pointer-events",
    referrerPolicy: "referrerpolicy",
    renderingIntent: "rendering-intent",
    shapeRendering: "shape-rendering",
    stopColor: "stop-color",
    stopOpacity: "stop-opacity",
    strikethroughPosition: "strikethrough-position",
    strikethroughThickness: "strikethrough-thickness",
    strokeDashArray: "stroke-dasharray",
    strokeDashOffset: "stroke-dashoffset",
    strokeLineCap: "stroke-linecap",
    strokeLineJoin: "stroke-linejoin",
    strokeMiterLimit: "stroke-miterlimit",
    strokeOpacity: "stroke-opacity",
    strokeWidth: "stroke-width",
    tabIndex: "tabindex",
    textAnchor: "text-anchor",
    textDecoration: "text-decoration",
    textRendering: "text-rendering",
    transformOrigin: "transform-origin",
    typeOf: "typeof",
    underlinePosition: "underline-position",
    underlineThickness: "underline-thickness",
    unicodeBidi: "unicode-bidi",
    unicodeRange: "unicode-range",
    unitsPerEm: "units-per-em",
    vAlphabetic: "v-alphabetic",
    vHanging: "v-hanging",
    vIdeographic: "v-ideographic",
    vMathematical: "v-mathematical",
    vectorEffect: "vector-effect",
    vertAdvY: "vert-adv-y",
    vertOriginX: "vert-origin-x",
    vertOriginY: "vert-origin-y",
    wordSpacing: "word-spacing",
    writingMode: "writing-mode",
    xHeight: "x-height",
    // These were camelcased in Tiny. Now lowercased in SVG 2
    playbackOrder: "playbackorder",
    timelineBegin: "timelinebegin"
  },
  properties: {
    about: commaOrSpaceSeparated,
    accentHeight: number,
    accumulate: null,
    additive: null,
    alignmentBaseline: null,
    alphabetic: number,
    amplitude: number,
    arabicForm: null,
    ascent: number,
    attributeName: null,
    attributeType: null,
    azimuth: number,
    bandwidth: null,
    baselineShift: null,
    baseFrequency: null,
    baseProfile: null,
    bbox: null,
    begin: null,
    bias: number,
    by: null,
    calcMode: null,
    capHeight: number,
    className: spaceSeparated,
    clip: null,
    clipPath: null,
    clipPathUnits: null,
    clipRule: null,
    color: null,
    colorInterpolation: null,
    colorInterpolationFilters: null,
    colorProfile: null,
    colorRendering: null,
    content: null,
    contentScriptType: null,
    contentStyleType: null,
    crossOrigin: null,
    cursor: null,
    cx: null,
    cy: null,
    d: null,
    dataType: null,
    defaultAction: null,
    descent: number,
    diffuseConstant: number,
    direction: null,
    display: null,
    dur: null,
    divisor: number,
    dominantBaseline: null,
    download: boolean,
    dx: null,
    dy: null,
    edgeMode: null,
    editable: null,
    elevation: number,
    enableBackground: null,
    end: null,
    event: null,
    exponent: number,
    externalResourcesRequired: null,
    fill: null,
    fillOpacity: number,
    fillRule: null,
    filter: null,
    filterRes: null,
    filterUnits: null,
    floodColor: null,
    floodOpacity: null,
    focusable: null,
    focusHighlight: null,
    fontFamily: null,
    fontSize: null,
    fontSizeAdjust: null,
    fontStretch: null,
    fontStyle: null,
    fontVariant: null,
    fontWeight: null,
    format: null,
    fr: null,
    from: null,
    fx: null,
    fy: null,
    g1: commaSeparated,
    g2: commaSeparated,
    glyphName: commaSeparated,
    glyphOrientationHorizontal: null,
    glyphOrientationVertical: null,
    glyphRef: null,
    gradientTransform: null,
    gradientUnits: null,
    handler: null,
    hanging: number,
    hatchContentUnits: null,
    hatchUnits: null,
    height: null,
    href: null,
    hrefLang: null,
    horizAdvX: number,
    horizOriginX: number,
    horizOriginY: number,
    id: null,
    ideographic: number,
    imageRendering: null,
    initialVisibility: null,
    in: null,
    in2: null,
    intercept: number,
    k: number,
    k1: number,
    k2: number,
    k3: number,
    k4: number,
    kernelMatrix: commaOrSpaceSeparated,
    kernelUnitLength: null,
    keyPoints: null,
    // SEMI_COLON_SEPARATED
    keySplines: null,
    // SEMI_COLON_SEPARATED
    keyTimes: null,
    // SEMI_COLON_SEPARATED
    kerning: null,
    lang: null,
    lengthAdjust: null,
    letterSpacing: null,
    lightingColor: null,
    limitingConeAngle: number,
    local: null,
    markerEnd: null,
    markerMid: null,
    markerStart: null,
    markerHeight: null,
    markerUnits: null,
    markerWidth: null,
    mask: null,
    maskContentUnits: null,
    maskUnits: null,
    mathematical: null,
    max: null,
    media: null,
    mediaCharacterEncoding: null,
    mediaContentEncodings: null,
    mediaSize: number,
    mediaTime: null,
    method: null,
    min: null,
    mode: null,
    name: null,
    navDown: null,
    navDownLeft: null,
    navDownRight: null,
    navLeft: null,
    navNext: null,
    navPrev: null,
    navRight: null,
    navUp: null,
    navUpLeft: null,
    navUpRight: null,
    numOctaves: null,
    observer: null,
    offset: null,
    onAbort: null,
    onActivate: null,
    onAfterPrint: null,
    onBeforePrint: null,
    onBegin: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnd: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFocusIn: null,
    onFocusOut: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadStart: null,
    onMessage: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onMouseWheel: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRepeat: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onShow: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onZoom: null,
    opacity: null,
    operator: null,
    order: null,
    orient: null,
    orientation: null,
    origin: null,
    overflow: null,
    overlay: null,
    overlinePosition: number,
    overlineThickness: number,
    paintOrder: null,
    panose1: null,
    path: null,
    pathLength: number,
    patternContentUnits: null,
    patternTransform: null,
    patternUnits: null,
    phase: null,
    ping: spaceSeparated,
    pitch: null,
    playbackOrder: null,
    pointerEvents: null,
    points: null,
    pointsAtX: number,
    pointsAtY: number,
    pointsAtZ: number,
    preserveAlpha: null,
    preserveAspectRatio: null,
    primitiveUnits: null,
    propagate: null,
    property: commaOrSpaceSeparated,
    r: null,
    radius: null,
    referrerPolicy: null,
    refX: null,
    refY: null,
    rel: commaOrSpaceSeparated,
    rev: commaOrSpaceSeparated,
    renderingIntent: null,
    repeatCount: null,
    repeatDur: null,
    requiredExtensions: commaOrSpaceSeparated,
    requiredFeatures: commaOrSpaceSeparated,
    requiredFonts: commaOrSpaceSeparated,
    requiredFormats: commaOrSpaceSeparated,
    resource: null,
    restart: null,
    result: null,
    rotate: null,
    rx: null,
    ry: null,
    scale: null,
    seed: null,
    shapeRendering: null,
    side: null,
    slope: null,
    snapshotTime: null,
    specularConstant: number,
    specularExponent: number,
    spreadMethod: null,
    spacing: null,
    startOffset: null,
    stdDeviation: null,
    stemh: null,
    stemv: null,
    stitchTiles: null,
    stopColor: null,
    stopOpacity: null,
    strikethroughPosition: number,
    strikethroughThickness: number,
    string: null,
    stroke: null,
    strokeDashArray: commaOrSpaceSeparated,
    strokeDashOffset: null,
    strokeLineCap: null,
    strokeLineJoin: null,
    strokeMiterLimit: number,
    strokeOpacity: number,
    strokeWidth: null,
    style: null,
    surfaceScale: number,
    syncBehavior: null,
    syncBehaviorDefault: null,
    syncMaster: null,
    syncTolerance: null,
    syncToleranceDefault: null,
    systemLanguage: commaOrSpaceSeparated,
    tabIndex: number,
    tableValues: null,
    target: null,
    targetX: number,
    targetY: number,
    textAnchor: null,
    textDecoration: null,
    textRendering: null,
    textLength: null,
    timelineBegin: null,
    title: null,
    transformBehavior: null,
    type: null,
    typeOf: commaOrSpaceSeparated,
    to: null,
    transform: null,
    transformOrigin: null,
    u1: null,
    u2: null,
    underlinePosition: number,
    underlineThickness: number,
    unicode: null,
    unicodeBidi: null,
    unicodeRange: null,
    unitsPerEm: number,
    values: null,
    vAlphabetic: number,
    vMathematical: number,
    vectorEffect: null,
    vHanging: number,
    vIdeographic: number,
    version: null,
    vertAdvY: number,
    vertOriginX: number,
    vertOriginY: number,
    viewBox: null,
    viewTarget: null,
    visibility: null,
    width: null,
    widths: null,
    wordSpacing: null,
    writingMode: null,
    x: null,
    x1: null,
    x2: null,
    xChannelSelector: null,
    xHeight: number,
    y: null,
    y1: null,
    y2: null,
    yChannelSelector: null,
    z: null,
    zoomAndPan: null
  },
  space: "svg",
  transform: caseSensitiveTransform
});
const xlink = create({
  properties: {
    xLinkActuate: null,
    xLinkArcRole: null,
    xLinkHref: null,
    xLinkRole: null,
    xLinkShow: null,
    xLinkTitle: null,
    xLinkType: null
  },
  space: "xlink",
  transform(_, property) {
    return "xlink:" + property.slice(5).toLowerCase();
  }
});
const xmlns = create({
  attributes: { xmlnsxlink: "xmlns:xlink" },
  properties: { xmlnsXLink: null, xmlns: null },
  space: "xmlns",
  transform: caseInsensitiveTransform
});
const xml = create({
  properties: { xmlBase: null, xmlLang: null, xmlSpace: null },
  space: "xml",
  transform(_, property) {
    return "xml:" + property.slice(3).toLowerCase();
  }
});
const cap = /[A-Z]/g;
const dash = /-[a-z]/g;
const valid = /^data[-\w.:]+$/i;
function find(schema2, value) {
  const normal = normalize(value);
  let property = value;
  let Type = Info;
  if (normal in schema2.normal) {
    return schema2.property[schema2.normal[normal]];
  }
  if (normal.length > 4 && normal.slice(0, 4) === "data" && valid.test(value)) {
    if (value.charAt(4) === "-") {
      const rest = value.slice(5).replace(dash, camelcase);
      property = "data" + rest.charAt(0).toUpperCase() + rest.slice(1);
    } else {
      const rest = value.slice(4);
      if (!dash.test(rest)) {
        let dashes = rest.replace(cap, kebab);
        if (dashes.charAt(0) !== "-") {
          dashes = "-" + dashes;
        }
        value = "data" + dashes;
      }
    }
    Type = DefinedInfo;
  }
  return new Type(property, value);
}
function kebab($0) {
  return "-" + $0.toLowerCase();
}
function camelcase($0) {
  return $0.charAt(1).toUpperCase();
}
const html$2 = merge([aria, html$3, xlink, xmlns, xml], "html");
const svg = merge([aria, svg$1, xlink, xmlns, xml], "svg");
const own$2 = {}.hasOwnProperty;
function zwitch(key2, options2) {
  const settings = options2 || {};
  function one2(value, ...parameters) {
    let fn = one2.invalid;
    const handlers = one2.handlers;
    if (value && own$2.call(value, key2)) {
      const id = String(value[key2]);
      fn = own$2.call(handlers, id) ? handlers[id] : one2.unknown;
    }
    if (fn) {
      return fn.call(this, value, ...parameters);
    }
  }
  one2.handlers = settings.handlers || {};
  one2.invalid = settings.invalid;
  one2.unknown = settings.unknown;
  return one2;
}
const defaultSubsetRegex = /["&'<>`]/g;
const surrogatePairsRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
const controlCharactersRegex = (
  // eslint-disable-next-line no-control-regex, unicorn/no-hex-escape
  /[\x01-\t\v\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g
);
const regexEscapeRegex = /[|\\{}()[\]^$+*?.]/g;
const subsetToRegexCache = /* @__PURE__ */ new WeakMap();
function core(value, options2) {
  value = value.replace(
    options2.subset ? charactersToExpressionCached(options2.subset) : defaultSubsetRegex,
    basic
  );
  if (options2.subset || options2.escapeOnly) {
    return value;
  }
  return value.replace(surrogatePairsRegex, surrogate).replace(controlCharactersRegex, basic);
  function surrogate(pair, index, all2) {
    return options2.format(
      (pair.charCodeAt(0) - 55296) * 1024 + pair.charCodeAt(1) - 56320 + 65536,
      all2.charCodeAt(index + 2),
      options2
    );
  }
  function basic(character, index, all2) {
    return options2.format(
      character.charCodeAt(0),
      all2.charCodeAt(index + 1),
      options2
    );
  }
}
function charactersToExpressionCached(subset) {
  let cached = subsetToRegexCache.get(subset);
  if (!cached) {
    cached = charactersToExpression(subset);
    subsetToRegexCache.set(subset, cached);
  }
  return cached;
}
function charactersToExpression(subset) {
  const groups = [];
  let index = -1;
  while (++index < subset.length) {
    groups.push(subset[index].replace(regexEscapeRegex, "\\$&"));
  }
  return new RegExp("(?:" + groups.join("|") + ")", "g");
}
const hexadecimalRegex = /[\dA-Fa-f]/;
function toHexadecimal(code, next, omit) {
  const value = "&#x" + code.toString(16).toUpperCase();
  return omit && next && !hexadecimalRegex.test(String.fromCharCode(next)) ? value : value + ";";
}
const decimalRegex = /\d/;
function toDecimal(code, next, omit) {
  const value = "&#" + String(code);
  return omit && next && !decimalRegex.test(String.fromCharCode(next)) ? value : value + ";";
}
const characterEntitiesLegacy = [
  "AElig",
  "AMP",
  "Aacute",
  "Acirc",
  "Agrave",
  "Aring",
  "Atilde",
  "Auml",
  "COPY",
  "Ccedil",
  "ETH",
  "Eacute",
  "Ecirc",
  "Egrave",
  "Euml",
  "GT",
  "Iacute",
  "Icirc",
  "Igrave",
  "Iuml",
  "LT",
  "Ntilde",
  "Oacute",
  "Ocirc",
  "Ograve",
  "Oslash",
  "Otilde",
  "Ouml",
  "QUOT",
  "REG",
  "THORN",
  "Uacute",
  "Ucirc",
  "Ugrave",
  "Uuml",
  "Yacute",
  "aacute",
  "acirc",
  "acute",
  "aelig",
  "agrave",
  "amp",
  "aring",
  "atilde",
  "auml",
  "brvbar",
  "ccedil",
  "cedil",
  "cent",
  "copy",
  "curren",
  "deg",
  "divide",
  "eacute",
  "ecirc",
  "egrave",
  "eth",
  "euml",
  "frac12",
  "frac14",
  "frac34",
  "gt",
  "iacute",
  "icirc",
  "iexcl",
  "igrave",
  "iquest",
  "iuml",
  "laquo",
  "lt",
  "macr",
  "micro",
  "middot",
  "nbsp",
  "not",
  "ntilde",
  "oacute",
  "ocirc",
  "ograve",
  "ordf",
  "ordm",
  "oslash",
  "otilde",
  "ouml",
  "para",
  "plusmn",
  "pound",
  "quot",
  "raquo",
  "reg",
  "sect",
  "shy",
  "sup1",
  "sup2",
  "sup3",
  "szlig",
  "thorn",
  "times",
  "uacute",
  "ucirc",
  "ugrave",
  "uml",
  "uuml",
  "yacute",
  "yen",
  "yuml"
];
const characterEntitiesHtml4 = {
  nbsp: " ",
  iexcl: "¡",
  cent: "¢",
  pound: "£",
  curren: "¤",
  yen: "¥",
  brvbar: "¦",
  sect: "§",
  uml: "¨",
  copy: "©",
  ordf: "ª",
  laquo: "«",
  not: "¬",
  shy: "­",
  reg: "®",
  macr: "¯",
  deg: "°",
  plusmn: "±",
  sup2: "²",
  sup3: "³",
  acute: "´",
  micro: "µ",
  para: "¶",
  middot: "·",
  cedil: "¸",
  sup1: "¹",
  ordm: "º",
  raquo: "»",
  frac14: "¼",
  frac12: "½",
  frac34: "¾",
  iquest: "¿",
  Agrave: "À",
  Aacute: "Á",
  Acirc: "Â",
  Atilde: "Ã",
  Auml: "Ä",
  Aring: "Å",
  AElig: "Æ",
  Ccedil: "Ç",
  Egrave: "È",
  Eacute: "É",
  Ecirc: "Ê",
  Euml: "Ë",
  Igrave: "Ì",
  Iacute: "Í",
  Icirc: "Î",
  Iuml: "Ï",
  ETH: "Ð",
  Ntilde: "Ñ",
  Ograve: "Ò",
  Oacute: "Ó",
  Ocirc: "Ô",
  Otilde: "Õ",
  Ouml: "Ö",
  times: "×",
  Oslash: "Ø",
  Ugrave: "Ù",
  Uacute: "Ú",
  Ucirc: "Û",
  Uuml: "Ü",
  Yacute: "Ý",
  THORN: "Þ",
  szlig: "ß",
  agrave: "à",
  aacute: "á",
  acirc: "â",
  atilde: "ã",
  auml: "ä",
  aring: "å",
  aelig: "æ",
  ccedil: "ç",
  egrave: "è",
  eacute: "é",
  ecirc: "ê",
  euml: "ë",
  igrave: "ì",
  iacute: "í",
  icirc: "î",
  iuml: "ï",
  eth: "ð",
  ntilde: "ñ",
  ograve: "ò",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  ouml: "ö",
  divide: "÷",
  oslash: "ø",
  ugrave: "ù",
  uacute: "ú",
  ucirc: "û",
  uuml: "ü",
  yacute: "ý",
  thorn: "þ",
  yuml: "ÿ",
  fnof: "ƒ",
  Alpha: "Α",
  Beta: "Β",
  Gamma: "Γ",
  Delta: "Δ",
  Epsilon: "Ε",
  Zeta: "Ζ",
  Eta: "Η",
  Theta: "Θ",
  Iota: "Ι",
  Kappa: "Κ",
  Lambda: "Λ",
  Mu: "Μ",
  Nu: "Ν",
  Xi: "Ξ",
  Omicron: "Ο",
  Pi: "Π",
  Rho: "Ρ",
  Sigma: "Σ",
  Tau: "Τ",
  Upsilon: "Υ",
  Phi: "Φ",
  Chi: "Χ",
  Psi: "Ψ",
  Omega: "Ω",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  omicron: "ο",
  pi: "π",
  rho: "ρ",
  sigmaf: "ς",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  thetasym: "ϑ",
  upsih: "ϒ",
  piv: "ϖ",
  bull: "•",
  hellip: "…",
  prime: "′",
  Prime: "″",
  oline: "‾",
  frasl: "⁄",
  weierp: "℘",
  image: "ℑ",
  real: "ℜ",
  trade: "™",
  alefsym: "ℵ",
  larr: "←",
  uarr: "↑",
  rarr: "→",
  darr: "↓",
  harr: "↔",
  crarr: "↵",
  lArr: "⇐",
  uArr: "⇑",
  rArr: "⇒",
  dArr: "⇓",
  hArr: "⇔",
  forall: "∀",
  part: "∂",
  exist: "∃",
  empty: "∅",
  nabla: "∇",
  isin: "∈",
  notin: "∉",
  ni: "∋",
  prod: "∏",
  sum: "∑",
  minus: "−",
  lowast: "∗",
  radic: "√",
  prop: "∝",
  infin: "∞",
  ang: "∠",
  and: "∧",
  or: "∨",
  cap: "∩",
  cup: "∪",
  int: "∫",
  there4: "∴",
  sim: "∼",
  cong: "≅",
  asymp: "≈",
  ne: "≠",
  equiv: "≡",
  le: "≤",
  ge: "≥",
  sub: "⊂",
  sup: "⊃",
  nsub: "⊄",
  sube: "⊆",
  supe: "⊇",
  oplus: "⊕",
  otimes: "⊗",
  perp: "⊥",
  sdot: "⋅",
  lceil: "⌈",
  rceil: "⌉",
  lfloor: "⌊",
  rfloor: "⌋",
  lang: "〈",
  rang: "〉",
  loz: "◊",
  spades: "♠",
  clubs: "♣",
  hearts: "♥",
  diams: "♦",
  quot: '"',
  amp: "&",
  lt: "<",
  gt: ">",
  OElig: "Œ",
  oelig: "œ",
  Scaron: "Š",
  scaron: "š",
  Yuml: "Ÿ",
  circ: "ˆ",
  tilde: "˜",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  zwnj: "‌",
  zwj: "‍",
  lrm: "‎",
  rlm: "‏",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  dagger: "†",
  Dagger: "‡",
  permil: "‰",
  lsaquo: "‹",
  rsaquo: "›",
  euro: "€"
};
const dangerous = [
  "cent",
  "copy",
  "divide",
  "gt",
  "lt",
  "not",
  "para",
  "times"
];
const own$1 = {}.hasOwnProperty;
const characters = {};
let key;
for (key in characterEntitiesHtml4) {
  if (own$1.call(characterEntitiesHtml4, key)) {
    characters[characterEntitiesHtml4[key]] = key;
  }
}
const notAlphanumericRegex = /[^\dA-Za-z]/;
function toNamed(code, next, omit, attribute) {
  const character = String.fromCharCode(code);
  if (own$1.call(characters, character)) {
    const name = characters[character];
    const value = "&" + name;
    if (omit && characterEntitiesLegacy.includes(name) && !dangerous.includes(name) && (!attribute || next && next !== 61 && notAlphanumericRegex.test(String.fromCharCode(next)))) {
      return value;
    }
    return value + ";";
  }
  return "";
}
function formatSmart(code, next, options2) {
  let numeric = toHexadecimal(code, next, options2.omitOptionalSemicolons);
  let named;
  if (options2.useNamedReferences || options2.useShortestReferences) {
    named = toNamed(
      code,
      next,
      options2.omitOptionalSemicolons,
      options2.attribute
    );
  }
  if ((options2.useShortestReferences || !named) && options2.useShortestReferences) {
    const decimal = toDecimal(code, next, options2.omitOptionalSemicolons);
    if (decimal.length < numeric.length) {
      numeric = decimal;
    }
  }
  return named && (!options2.useShortestReferences || named.length < numeric.length) ? named : numeric;
}
function stringifyEntities(value, options2) {
  return core(value, Object.assign({ format: formatSmart }, options2));
}
const htmlCommentRegex = /^>|^->|<!--|-->|--!>|<!-$/g;
const bogusCommentEntitySubset = [">"];
const commentEntitySubset = ["<", ">"];
function comment(node, _1, _2, state) {
  return state.settings.bogusComments ? "<?" + stringifyEntities(
    node.value,
    Object.assign({}, state.settings.characterReferences, {
      subset: bogusCommentEntitySubset
    })
  ) + ">" : "<!--" + node.value.replace(htmlCommentRegex, encode) + "-->";
  function encode($0) {
    return stringifyEntities(
      $0,
      Object.assign({}, state.settings.characterReferences, {
        subset: commentEntitySubset
      })
    );
  }
}
function doctype(_1, _2, _3, state) {
  return "<!" + (state.settings.upperDoctype ? "DOCTYPE" : "doctype") + (state.settings.tightDoctype ? "" : " ") + "html>";
}
function ccount(value, character) {
  const source = String(value);
  if (typeof character !== "string") {
    throw new TypeError("Expected character");
  }
  let count = 0;
  let index = source.indexOf(character);
  while (index !== -1) {
    count++;
    index = source.indexOf(character, index + character.length);
  }
  return count;
}
function stringify$2(values, options2) {
  const settings = options2 || {};
  const input = values[values.length - 1] === "" ? [...values, ""] : values;
  return input.join(
    (settings.padRight ? " " : "") + "," + (settings.padLeft === false ? "" : " ")
  ).trim();
}
function stringify$1(values) {
  return values.join(" ").trim();
}
const re = /[ \t\n\f\r]/g;
function whitespace(thing) {
  return typeof thing === "object" ? thing.type === "text" ? empty(thing.value) : false : empty(thing);
}
function empty(value) {
  return value.replace(re, "") === "";
}
const siblingAfter = siblings(1);
const siblingBefore = siblings(-1);
const emptyChildren$1 = [];
function siblings(increment2) {
  return sibling;
  function sibling(parent, index, includeWhitespace) {
    const siblings2 = parent ? parent.children : emptyChildren$1;
    let offset = (index || 0) + increment2;
    let next = siblings2[offset];
    if (!includeWhitespace) {
      while (next && whitespace(next)) {
        offset += increment2;
        next = siblings2[offset];
      }
    }
    return next;
  }
}
const own = {}.hasOwnProperty;
function omission(handlers) {
  return omit;
  function omit(node, index, parent) {
    return own.call(handlers, node.tagName) && handlers[node.tagName](node, index, parent);
  }
}
const closing = omission({
  body: body$1,
  caption: headOrColgroupOrCaption,
  colgroup: headOrColgroupOrCaption,
  dd,
  dt,
  head: headOrColgroupOrCaption,
  html: html$1,
  li,
  optgroup,
  option,
  p,
  rp: rubyElement,
  rt: rubyElement,
  tbody: tbody$1,
  td: cells,
  tfoot,
  th: cells,
  thead,
  tr
});
function headOrColgroupOrCaption(_, index, parent) {
  const next = siblingAfter(parent, index, true);
  return !next || next.type !== "comment" && !(next.type === "text" && whitespace(next.value.charAt(0)));
}
function html$1(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type !== "comment";
}
function body$1(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type !== "comment";
}
function p(_, index, parent) {
  const next = siblingAfter(parent, index);
  return next ? next.type === "element" && (next.tagName === "address" || next.tagName === "article" || next.tagName === "aside" || next.tagName === "blockquote" || next.tagName === "details" || next.tagName === "div" || next.tagName === "dl" || next.tagName === "fieldset" || next.tagName === "figcaption" || next.tagName === "figure" || next.tagName === "footer" || next.tagName === "form" || next.tagName === "h1" || next.tagName === "h2" || next.tagName === "h3" || next.tagName === "h4" || next.tagName === "h5" || next.tagName === "h6" || next.tagName === "header" || next.tagName === "hgroup" || next.tagName === "hr" || next.tagName === "main" || next.tagName === "menu" || next.tagName === "nav" || next.tagName === "ol" || next.tagName === "p" || next.tagName === "pre" || next.tagName === "section" || next.tagName === "table" || next.tagName === "ul") : !parent || // Confusing parent.
  !(parent.type === "element" && (parent.tagName === "a" || parent.tagName === "audio" || parent.tagName === "del" || parent.tagName === "ins" || parent.tagName === "map" || parent.tagName === "noscript" || parent.tagName === "video"));
}
function li(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && next.tagName === "li";
}
function dt(_, index, parent) {
  const next = siblingAfter(parent, index);
  return Boolean(
    next && next.type === "element" && (next.tagName === "dt" || next.tagName === "dd")
  );
}
function dd(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "dt" || next.tagName === "dd");
}
function rubyElement(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "rp" || next.tagName === "rt");
}
function optgroup(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && next.tagName === "optgroup";
}
function option(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "option" || next.tagName === "optgroup");
}
function thead(_, index, parent) {
  const next = siblingAfter(parent, index);
  return Boolean(
    next && next.type === "element" && (next.tagName === "tbody" || next.tagName === "tfoot")
  );
}
function tbody$1(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "tbody" || next.tagName === "tfoot");
}
function tfoot(_, index, parent) {
  return !siblingAfter(parent, index);
}
function tr(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && next.tagName === "tr";
}
function cells(_, index, parent) {
  const next = siblingAfter(parent, index);
  return !next || next.type === "element" && (next.tagName === "td" || next.tagName === "th");
}
const opening = omission({
  body,
  colgroup,
  head,
  html,
  tbody
});
function html(node) {
  const head2 = siblingAfter(node, -1);
  return !head2 || head2.type !== "comment";
}
function head(node) {
  const seen = /* @__PURE__ */ new Set();
  for (const child2 of node.children) {
    if (child2.type === "element" && (child2.tagName === "base" || child2.tagName === "title")) {
      if (seen.has(child2.tagName)) return false;
      seen.add(child2.tagName);
    }
  }
  const child = node.children[0];
  return !child || child.type === "element";
}
function body(node) {
  const head2 = siblingAfter(node, -1, true);
  return !head2 || head2.type !== "comment" && !(head2.type === "text" && whitespace(head2.value.charAt(0))) && !(head2.type === "element" && (head2.tagName === "meta" || head2.tagName === "link" || head2.tagName === "script" || head2.tagName === "style" || head2.tagName === "template"));
}
function colgroup(node, index, parent) {
  const previous = siblingBefore(parent, index);
  const head2 = siblingAfter(node, -1, true);
  if (parent && previous && previous.type === "element" && previous.tagName === "colgroup" && closing(previous, parent.children.indexOf(previous), parent)) {
    return false;
  }
  return Boolean(head2 && head2.type === "element" && head2.tagName === "col");
}
function tbody(node, index, parent) {
  const previous = siblingBefore(parent, index);
  const head2 = siblingAfter(node, -1);
  if (parent && previous && previous.type === "element" && (previous.tagName === "thead" || previous.tagName === "tbody") && closing(previous, parent.children.indexOf(previous), parent)) {
    return false;
  }
  return Boolean(head2 && head2.type === "element" && head2.tagName === "tr");
}
const constants = {
  // See: <https://html.spec.whatwg.org/#attribute-name-state>.
  name: [
    ["	\n\f\r &/=>".split(""), "	\n\f\r \"&'/=>`".split("")],
    [`\0	
\f\r "&'/<=>`.split(""), "\0	\n\f\r \"&'/<=>`".split("")]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(unquoted)-state>.
  unquoted: [
    ["	\n\f\r &>".split(""), "\0	\n\f\r \"&'<=>`".split("")],
    ["\0	\n\f\r \"&'<=>`".split(""), "\0	\n\f\r \"&'<=>`".split("")]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(single-quoted)-state>.
  single: [
    ["&'".split(""), "\"&'`".split("")],
    ["\0&'".split(""), "\0\"&'`".split("")]
  ],
  // See: <https://html.spec.whatwg.org/#attribute-value-(double-quoted)-state>.
  double: [
    ['"&'.split(""), "\"&'`".split("")],
    ['\0"&'.split(""), "\0\"&'`".split("")]
  ]
};
function element(node, index, parent, state) {
  const schema2 = state.schema;
  const omit = schema2.space === "svg" ? false : state.settings.omitOptionalTags;
  let selfClosing = schema2.space === "svg" ? state.settings.closeEmptyElements : state.settings.voids.includes(node.tagName.toLowerCase());
  const parts = [];
  let last;
  if (schema2.space === "html" && node.tagName === "svg") {
    state.schema = svg;
  }
  const attributes = serializeAttributes(state, node.properties);
  const content = state.all(
    schema2.space === "html" && node.tagName === "template" ? node.content : node
  );
  state.schema = schema2;
  if (content) selfClosing = false;
  if (attributes || !omit || !opening(node, index, parent)) {
    parts.push("<", node.tagName, attributes ? " " + attributes : "");
    if (selfClosing && (schema2.space === "svg" || state.settings.closeSelfClosing)) {
      last = attributes.charAt(attributes.length - 1);
      if (!state.settings.tightSelfClosing || last === "/" || last && last !== '"' && last !== "'") {
        parts.push(" ");
      }
      parts.push("/");
    }
    parts.push(">");
  }
  parts.push(content);
  if (!selfClosing && (!omit || !closing(node, index, parent))) {
    parts.push("</" + node.tagName + ">");
  }
  return parts.join("");
}
function serializeAttributes(state, properties) {
  const values = [];
  let index = -1;
  let key2;
  if (properties) {
    for (key2 in properties) {
      if (properties[key2] !== null && properties[key2] !== void 0) {
        const value = serializeAttribute(state, key2, properties[key2]);
        if (value) values.push(value);
      }
    }
  }
  while (++index < values.length) {
    const last = state.settings.tightAttributes ? values[index].charAt(values[index].length - 1) : void 0;
    if (index !== values.length - 1 && last !== '"' && last !== "'") {
      values[index] += " ";
    }
  }
  return values.join("");
}
function serializeAttribute(state, key2, value) {
  const info = find(state.schema, key2);
  const x = state.settings.allowParseErrors && state.schema.space === "html" ? 0 : 1;
  const y = state.settings.allowDangerousCharacters ? 0 : 1;
  let quote = state.quote;
  let result;
  if (info.overloadedBoolean && (value === info.attribute || value === "")) {
    value = true;
  } else if ((info.boolean || info.overloadedBoolean) && (typeof value !== "string" || value === info.attribute || value === "")) {
    value = Boolean(value);
  }
  if (value === null || value === void 0 || value === false || typeof value === "number" && Number.isNaN(value)) {
    return "";
  }
  const name = stringifyEntities(
    info.attribute,
    Object.assign({}, state.settings.characterReferences, {
      // Always encode without parse errors in non-HTML.
      subset: constants.name[x][y]
    })
  );
  if (value === true) return name;
  value = Array.isArray(value) ? (info.commaSeparated ? stringify$2 : stringify$1)(value, {
    padLeft: !state.settings.tightCommaSeparatedLists
  }) : String(value);
  if (state.settings.collapseEmptyAttributes && !value) return name;
  if (state.settings.preferUnquoted) {
    result = stringifyEntities(
      value,
      Object.assign({}, state.settings.characterReferences, {
        attribute: true,
        subset: constants.unquoted[x][y]
      })
    );
  }
  if (result !== value) {
    if (state.settings.quoteSmart && ccount(value, quote) > ccount(value, state.alternative)) {
      quote = state.alternative;
    }
    result = quote + stringifyEntities(
      value,
      Object.assign({}, state.settings.characterReferences, {
        // Always encode without parse errors in non-HTML.
        subset: (quote === "'" ? constants.single : constants.double)[x][y],
        attribute: true
      })
    ) + quote;
  }
  return name + (result ? "=" + result : result);
}
const textEntitySubset = ["<", "&"];
function text(node, _, parent, state) {
  return parent && parent.type === "element" && (parent.tagName === "script" || parent.tagName === "style") ? node.value : stringifyEntities(
    node.value,
    Object.assign({}, state.settings.characterReferences, {
      subset: textEntitySubset
    })
  );
}
function raw(node, index, parent, state) {
  return state.settings.allowDangerousHtml ? node.value : text(node, index, parent, state);
}
function root(node, _1, _2, state) {
  return state.all(node);
}
const handle = zwitch("type", {
  invalid,
  unknown,
  handlers: { comment, doctype, element, raw, root, text }
});
function invalid(node) {
  throw new Error("Expected node, not `" + node + "`");
}
function unknown(node_) {
  const node = (
    /** @type {Nodes} */
    node_
  );
  throw new Error("Cannot compile unknown node `" + node.type + "`");
}
const emptyOptions = {};
const emptyCharacterReferences = {};
const emptyChildren = [];
function toHtml(tree, options2) {
  const options_ = options2 || emptyOptions;
  const quote = options_.quote || '"';
  const alternative = quote === '"' ? "'" : '"';
  if (quote !== '"' && quote !== "'") {
    throw new Error("Invalid quote `" + quote + "`, expected `'` or `\"`");
  }
  const state = {
    one,
    all,
    settings: {
      omitOptionalTags: options_.omitOptionalTags || false,
      allowParseErrors: options_.allowParseErrors || false,
      allowDangerousCharacters: options_.allowDangerousCharacters || false,
      quoteSmart: options_.quoteSmart || false,
      preferUnquoted: options_.preferUnquoted || false,
      tightAttributes: options_.tightAttributes || false,
      upperDoctype: options_.upperDoctype || false,
      tightDoctype: options_.tightDoctype || false,
      bogusComments: options_.bogusComments || false,
      tightCommaSeparatedLists: options_.tightCommaSeparatedLists || false,
      tightSelfClosing: options_.tightSelfClosing || false,
      collapseEmptyAttributes: options_.collapseEmptyAttributes || false,
      allowDangerousHtml: options_.allowDangerousHtml || false,
      voids: options_.voids || htmlVoidElements,
      characterReferences: options_.characterReferences || emptyCharacterReferences,
      closeSelfClosing: options_.closeSelfClosing || false,
      closeEmptyElements: options_.closeEmptyElements || false
    },
    schema: options_.space === "svg" ? svg : html$2,
    quote,
    alternative
  };
  return state.one(
    Array.isArray(tree) ? { type: "root", children: tree } : tree,
    void 0,
    void 0
  );
}
function one(node, index, parent) {
  return handle(node, index, parent, this);
}
function all(parent) {
  const results = [];
  const children = parent && parent.children || emptyChildren;
  let index = -1;
  while (++index < children.length) {
    results[index] = this.one(children[index], index, parent);
  }
  return results.join("");
}
function resolveColorReplacements(theme, options2) {
  const replacements = typeof theme === "string" ? {} : { ...theme.colorReplacements };
  const themeName = typeof theme === "string" ? theme : theme.name;
  for (const [key2, value] of Object.entries(options2?.colorReplacements || {})) {
    if (typeof value === "string")
      replacements[key2] = value;
    else if (key2 === themeName)
      Object.assign(replacements, value);
  }
  return replacements;
}
function applyColorReplacements(color, replacements) {
  if (!color)
    return color;
  return replacements?.[color?.toLowerCase()] || color;
}
function toArray(x) {
  return Array.isArray(x) ? x : [x];
}
async function normalizeGetter(p2) {
  return Promise.resolve(typeof p2 === "function" ? p2() : p2).then((r) => r.default || r);
}
function isPlainLang(lang) {
  return !lang || ["plaintext", "txt", "text", "plain"].includes(lang);
}
function isSpecialLang(lang) {
  return lang === "ansi" || isPlainLang(lang);
}
function isNoneTheme(theme) {
  return theme === "none";
}
function isSpecialTheme(theme) {
  return isNoneTheme(theme);
}
function addClassToHast(node, className) {
  if (!className)
    return node;
  node.properties ||= {};
  node.properties.class ||= [];
  if (typeof node.properties.class === "string")
    node.properties.class = node.properties.class.split(/\s+/g);
  if (!Array.isArray(node.properties.class))
    node.properties.class = [];
  const targets = Array.isArray(className) ? className : className.split(/\s+/g);
  for (const c of targets) {
    if (c && !node.properties.class.includes(c))
      node.properties.class.push(c);
  }
  return node;
}
function splitLines(code, preserveEnding = false) {
  if (code.length === 0) {
    return [["", 0]];
  }
  const parts = code.split(/(\r?\n)/g);
  let index = 0;
  const lines = [];
  for (let i = 0; i < parts.length; i += 2) {
    const line = preserveEnding ? parts[i] + (parts[i + 1] || "") : parts[i];
    lines.push([line, index]);
    index += parts[i].length;
    index += parts[i + 1]?.length || 0;
  }
  return lines;
}
function createPositionConverter(code) {
  const lines = splitLines(code, true).map(([line]) => line);
  function indexToPos(index) {
    if (index === code.length) {
      return {
        line: lines.length - 1,
        character: lines[lines.length - 1].length
      };
    }
    let character = index;
    let line = 0;
    for (const lineText of lines) {
      if (character < lineText.length)
        break;
      character -= lineText.length;
      line++;
    }
    return { line, character };
  }
  function posToIndex(line, character) {
    let index = 0;
    for (let i = 0; i < line; i++)
      index += lines[i].length;
    index += character;
    return index;
  }
  return {
    lines,
    indexToPos,
    posToIndex
  };
}
const DEFAULT_COLOR_LIGHT_DARK = "light-dark()";
const COLOR_KEYS = ["color", "background-color"];
function splitToken(token, offsets) {
  let lastOffset = 0;
  const tokens = [];
  for (const offset of offsets) {
    if (offset > lastOffset) {
      tokens.push({
        ...token,
        content: token.content.slice(lastOffset, offset),
        offset: token.offset + lastOffset
      });
    }
    lastOffset = offset;
  }
  if (lastOffset < token.content.length) {
    tokens.push({
      ...token,
      content: token.content.slice(lastOffset),
      offset: token.offset + lastOffset
    });
  }
  return tokens;
}
function splitTokens(tokens, breakpoints) {
  const sorted = Array.from(breakpoints instanceof Set ? breakpoints : new Set(breakpoints)).sort((a, b) => a - b);
  if (!sorted.length)
    return tokens;
  return tokens.map((line) => {
    return line.flatMap((token) => {
      const breakpointsInToken = sorted.filter((i) => token.offset < i && i < token.offset + token.content.length).map((i) => i - token.offset).sort((a, b) => a - b);
      if (!breakpointsInToken.length)
        return token;
      return splitToken(token, breakpointsInToken);
    });
  });
}
function flatTokenVariants(merged, variantsOrder, cssVariablePrefix, defaultColor, colorsRendering = "css-vars") {
  const token = {
    content: merged.content,
    explanation: merged.explanation,
    offset: merged.offset
  };
  const styles = variantsOrder.map((t) => getTokenStyleObject(merged.variants[t]));
  const styleKeys = new Set(styles.flatMap((t) => Object.keys(t)));
  const mergedStyles = {};
  const varKey = (idx, key2) => {
    const keyName = key2 === "color" ? "" : key2 === "background-color" ? "-bg" : `-${key2}`;
    return cssVariablePrefix + variantsOrder[idx] + (key2 === "color" ? "" : keyName);
  };
  styles.forEach((cur, idx) => {
    for (const key2 of styleKeys) {
      const value = cur[key2] || "inherit";
      if (idx === 0 && defaultColor && COLOR_KEYS.includes(key2)) {
        if (defaultColor === DEFAULT_COLOR_LIGHT_DARK && styles.length > 1) {
          const lightIndex = variantsOrder.findIndex((t) => t === "light");
          const darkIndex = variantsOrder.findIndex((t) => t === "dark");
          if (lightIndex === -1 || darkIndex === -1)
            throw new ShikiError$2('When using `defaultColor: "light-dark()"`, you must provide both `light` and `dark` themes');
          const lightValue = styles[lightIndex][key2] || "inherit";
          const darkValue = styles[darkIndex][key2] || "inherit";
          mergedStyles[key2] = `light-dark(${lightValue}, ${darkValue})`;
          if (colorsRendering === "css-vars")
            mergedStyles[varKey(idx, key2)] = value;
        } else {
          mergedStyles[key2] = value;
        }
      } else {
        if (colorsRendering === "css-vars")
          mergedStyles[varKey(idx, key2)] = value;
      }
    }
  });
  token.htmlStyle = mergedStyles;
  return token;
}
function getTokenStyleObject(token) {
  const styles = {};
  if (token.color)
    styles.color = token.color;
  if (token.bgColor)
    styles["background-color"] = token.bgColor;
  if (token.fontStyle) {
    if (token.fontStyle & FontStyle.Italic)
      styles["font-style"] = "italic";
    if (token.fontStyle & FontStyle.Bold)
      styles["font-weight"] = "bold";
    const decorations2 = [];
    if (token.fontStyle & FontStyle.Underline)
      decorations2.push("underline");
    if (token.fontStyle & FontStyle.Strikethrough)
      decorations2.push("line-through");
    if (decorations2.length)
      styles["text-decoration"] = decorations2.join(" ");
  }
  return styles;
}
function stringifyTokenStyle(token) {
  if (typeof token === "string")
    return token;
  return Object.entries(token).map(([key2, value]) => `${key2}:${value}`).join(";");
}
const _grammarStateMap = /* @__PURE__ */ new WeakMap();
function setLastGrammarStateToMap(keys, state) {
  _grammarStateMap.set(keys, state);
}
function getLastGrammarStateFromMap(keys) {
  return _grammarStateMap.get(keys);
}
class GrammarState {
  /**
   * Theme to Stack mapping
   */
  _stacks = {};
  lang;
  get themes() {
    return Object.keys(this._stacks);
  }
  get theme() {
    return this.themes[0];
  }
  get _stack() {
    return this._stacks[this.theme];
  }
  /**
   * Static method to create a initial grammar state.
   */
  static initial(lang, themes) {
    return new GrammarState(
      Object.fromEntries(toArray(themes).map((theme) => [theme, INITIAL])),
      lang
    );
  }
  constructor(...args) {
    if (args.length === 2) {
      const [stacksMap, lang] = args;
      this.lang = lang;
      this._stacks = stacksMap;
    } else {
      const [stack, lang, theme] = args;
      this.lang = lang;
      this._stacks = { [theme]: stack };
    }
  }
  /**
   * Get the internal stack object.
   * @internal
   */
  getInternalStack(theme = this.theme) {
    return this._stacks[theme];
  }
  getScopes(theme = this.theme) {
    return getScopes(this._stacks[theme]);
  }
  toJSON() {
    return {
      lang: this.lang,
      theme: this.theme,
      themes: this.themes,
      scopes: this.getScopes()
    };
  }
}
function getScopes(stack) {
  const scopes = [];
  const visited = /* @__PURE__ */ new Set();
  function pushScope(stack2) {
    if (visited.has(stack2))
      return;
    visited.add(stack2);
    const name = stack2?.nameScopesList?.scopeName;
    if (name)
      scopes.push(name);
    if (stack2.parent)
      pushScope(stack2.parent);
  }
  pushScope(stack);
  return scopes;
}
function getGrammarStack(state, theme) {
  if (!(state instanceof GrammarState))
    throw new ShikiError$2("Invalid grammar state");
  return state.getInternalStack(theme);
}
function transformerDecorations() {
  const map2 = /* @__PURE__ */ new WeakMap();
  function getContext(shiki) {
    if (!map2.has(shiki.meta)) {
      let normalizePosition = function(p2) {
        if (typeof p2 === "number") {
          if (p2 < 0 || p2 > shiki.source.length)
            throw new ShikiError$2(`Invalid decoration offset: ${p2}. Code length: ${shiki.source.length}`);
          return {
            ...converter.indexToPos(p2),
            offset: p2
          };
        } else {
          const line = converter.lines[p2.line];
          if (line === void 0)
            throw new ShikiError$2(`Invalid decoration position ${JSON.stringify(p2)}. Lines length: ${converter.lines.length}`);
          let character = p2.character;
          if (character < 0)
            character = line.length + character;
          if (character < 0 || character > line.length)
            throw new ShikiError$2(`Invalid decoration position ${JSON.stringify(p2)}. Line ${p2.line} length: ${line.length}`);
          return {
            ...p2,
            character,
            offset: converter.posToIndex(p2.line, character)
          };
        }
      };
      const converter = createPositionConverter(shiki.source);
      const decorations2 = (shiki.options.decorations || []).map((d) => ({
        ...d,
        start: normalizePosition(d.start),
        end: normalizePosition(d.end)
      }));
      verifyIntersections(decorations2);
      map2.set(shiki.meta, {
        decorations: decorations2,
        converter,
        source: shiki.source
      });
    }
    return map2.get(shiki.meta);
  }
  return {
    name: "shiki:decorations",
    tokens(tokens) {
      if (!this.options.decorations?.length)
        return;
      const ctx = getContext(this);
      const breakpoints = ctx.decorations.flatMap((d) => [d.start.offset, d.end.offset]);
      const splitted = splitTokens(tokens, breakpoints);
      return splitted;
    },
    code(codeEl) {
      if (!this.options.decorations?.length)
        return;
      const ctx = getContext(this);
      const lines = Array.from(codeEl.children).filter((i) => i.type === "element" && i.tagName === "span");
      if (lines.length !== ctx.converter.lines.length)
        throw new ShikiError$2(`Number of lines in code element (${lines.length}) does not match the number of lines in the source (${ctx.converter.lines.length}). Failed to apply decorations.`);
      function applyLineSection(line, start, end, decoration) {
        const lineEl = lines[line];
        let text2 = "";
        let startIndex = -1;
        let endIndex = -1;
        if (start === 0)
          startIndex = 0;
        if (end === 0)
          endIndex = 0;
        if (end === Number.POSITIVE_INFINITY)
          endIndex = lineEl.children.length;
        if (startIndex === -1 || endIndex === -1) {
          for (let i = 0; i < lineEl.children.length; i++) {
            text2 += stringify(lineEl.children[i]);
            if (startIndex === -1 && text2.length === start)
              startIndex = i + 1;
            if (endIndex === -1 && text2.length === end)
              endIndex = i + 1;
          }
        }
        if (startIndex === -1)
          throw new ShikiError$2(`Failed to find start index for decoration ${JSON.stringify(decoration.start)}`);
        if (endIndex === -1)
          throw new ShikiError$2(`Failed to find end index for decoration ${JSON.stringify(decoration.end)}`);
        const children = lineEl.children.slice(startIndex, endIndex);
        if (!decoration.alwaysWrap && children.length === lineEl.children.length) {
          applyDecoration(lineEl, decoration, "line");
        } else if (!decoration.alwaysWrap && children.length === 1 && children[0].type === "element") {
          applyDecoration(children[0], decoration, "token");
        } else {
          const wrapper = {
            type: "element",
            tagName: "span",
            properties: {},
            children
          };
          applyDecoration(wrapper, decoration, "wrapper");
          lineEl.children.splice(startIndex, children.length, wrapper);
        }
      }
      function applyLine(line, decoration) {
        lines[line] = applyDecoration(lines[line], decoration, "line");
      }
      function applyDecoration(el, decoration, type2) {
        const properties = decoration.properties || {};
        const transform = decoration.transform || ((i) => i);
        el.tagName = decoration.tagName || "span";
        el.properties = {
          ...el.properties,
          ...properties,
          class: el.properties.class
        };
        if (decoration.properties?.class)
          addClassToHast(el, decoration.properties.class);
        el = transform(el, type2) || el;
        return el;
      }
      const lineApplies = [];
      const sorted = ctx.decorations.sort((a, b) => b.start.offset - a.start.offset || a.end.offset - b.end.offset);
      for (const decoration of sorted) {
        const { start, end } = decoration;
        if (start.line === end.line) {
          applyLineSection(start.line, start.character, end.character, decoration);
        } else if (start.line < end.line) {
          applyLineSection(start.line, start.character, Number.POSITIVE_INFINITY, decoration);
          for (let i = start.line + 1; i < end.line; i++)
            lineApplies.unshift(() => applyLine(i, decoration));
          applyLineSection(end.line, 0, end.character, decoration);
        }
      }
      lineApplies.forEach((i) => i());
    }
  };
}
function verifyIntersections(items) {
  for (let i = 0; i < items.length; i++) {
    const foo = items[i];
    if (foo.start.offset > foo.end.offset)
      throw new ShikiError$2(`Invalid decoration range: ${JSON.stringify(foo.start)} - ${JSON.stringify(foo.end)}`);
    for (let j = i + 1; j < items.length; j++) {
      const bar = items[j];
      const isFooHasBarStart = foo.start.offset <= bar.start.offset && bar.start.offset < foo.end.offset;
      const isFooHasBarEnd = foo.start.offset < bar.end.offset && bar.end.offset <= foo.end.offset;
      const isBarHasFooStart = bar.start.offset <= foo.start.offset && foo.start.offset < bar.end.offset;
      const isBarHasFooEnd = bar.start.offset < foo.end.offset && foo.end.offset <= bar.end.offset;
      if (isFooHasBarStart || isFooHasBarEnd || isBarHasFooStart || isBarHasFooEnd) {
        if (isFooHasBarStart && isFooHasBarEnd)
          continue;
        if (isBarHasFooStart && isBarHasFooEnd)
          continue;
        if (isBarHasFooStart && foo.start.offset === foo.end.offset)
          continue;
        if (isFooHasBarEnd && bar.start.offset === bar.end.offset)
          continue;
        throw new ShikiError$2(`Decorations ${JSON.stringify(foo.start)} and ${JSON.stringify(bar.start)} intersect.`);
      }
    }
  }
}
function stringify(el) {
  if (el.type === "text")
    return el.value;
  if (el.type === "element")
    return el.children.map(stringify).join("");
  return "";
}
const builtInTransformers = [
  /* @__PURE__ */ transformerDecorations()
];
function getTransformers(options2) {
  const transformers = sortTransformersByEnforcement(options2.transformers || []);
  return [
    ...transformers.pre,
    ...transformers.normal,
    ...transformers.post,
    ...builtInTransformers
  ];
}
function sortTransformersByEnforcement(transformers) {
  const pre = [];
  const post = [];
  const normal = [];
  for (const transformer of transformers) {
    switch (transformer.enforce) {
      case "pre":
        pre.push(transformer);
        break;
      case "post":
        post.push(transformer);
        break;
      default:
        normal.push(transformer);
    }
  }
  return { pre, post, normal };
}
var namedColors = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite"
];
var decorations = {
  1: "bold",
  2: "dim",
  3: "italic",
  4: "underline",
  7: "reverse",
  8: "hidden",
  9: "strikethrough"
};
function findSequence(value, position) {
  const nextEscape = value.indexOf("\x1B", position);
  if (nextEscape !== -1) {
    if (value[nextEscape + 1] === "[") {
      const nextClose = value.indexOf("m", nextEscape);
      if (nextClose !== -1) {
        return {
          sequence: value.substring(nextEscape + 2, nextClose).split(";"),
          startPosition: nextEscape,
          position: nextClose + 1
        };
      }
    }
  }
  return {
    position: value.length
  };
}
function parseColor(sequence) {
  const colorMode = sequence.shift();
  if (colorMode === "2") {
    const rgb = sequence.splice(0, 3).map((x) => Number.parseInt(x));
    if (rgb.length !== 3 || rgb.some((x) => Number.isNaN(x)))
      return;
    return {
      type: "rgb",
      rgb
    };
  } else if (colorMode === "5") {
    const index = sequence.shift();
    if (index) {
      return { type: "table", index: Number(index) };
    }
  }
}
function parseSequence(sequence) {
  const commands = [];
  while (sequence.length > 0) {
    const code = sequence.shift();
    if (!code)
      continue;
    const codeInt = Number.parseInt(code);
    if (Number.isNaN(codeInt))
      continue;
    if (codeInt === 0) {
      commands.push({ type: "resetAll" });
    } else if (codeInt <= 9) {
      const decoration = decorations[codeInt];
      if (decoration) {
        commands.push({
          type: "setDecoration",
          value: decorations[codeInt]
        });
      }
    } else if (codeInt <= 29) {
      const decoration = decorations[codeInt - 20];
      if (decoration) {
        commands.push({
          type: "resetDecoration",
          value: decoration
        });
        if (decoration === "dim") {
          commands.push({
            type: "resetDecoration",
            value: "bold"
          });
        }
      }
    } else if (codeInt <= 37) {
      commands.push({
        type: "setForegroundColor",
        value: { type: "named", name: namedColors[codeInt - 30] }
      });
    } else if (codeInt === 38) {
      const color = parseColor(sequence);
      if (color) {
        commands.push({
          type: "setForegroundColor",
          value: color
        });
      }
    } else if (codeInt === 39) {
      commands.push({
        type: "resetForegroundColor"
      });
    } else if (codeInt <= 47) {
      commands.push({
        type: "setBackgroundColor",
        value: { type: "named", name: namedColors[codeInt - 40] }
      });
    } else if (codeInt === 48) {
      const color = parseColor(sequence);
      if (color) {
        commands.push({
          type: "setBackgroundColor",
          value: color
        });
      }
    } else if (codeInt === 49) {
      commands.push({
        type: "resetBackgroundColor"
      });
    } else if (codeInt === 53) {
      commands.push({
        type: "setDecoration",
        value: "overline"
      });
    } else if (codeInt === 55) {
      commands.push({
        type: "resetDecoration",
        value: "overline"
      });
    } else if (codeInt >= 90 && codeInt <= 97) {
      commands.push({
        type: "setForegroundColor",
        value: { type: "named", name: namedColors[codeInt - 90 + 8] }
      });
    } else if (codeInt >= 100 && codeInt <= 107) {
      commands.push({
        type: "setBackgroundColor",
        value: { type: "named", name: namedColors[codeInt - 100 + 8] }
      });
    }
  }
  return commands;
}
function createAnsiSequenceParser() {
  let foreground = null;
  let background = null;
  let decorations2 = /* @__PURE__ */ new Set();
  return {
    parse(value) {
      const tokens = [];
      let position = 0;
      do {
        const findResult = findSequence(value, position);
        const text2 = findResult.sequence ? value.substring(position, findResult.startPosition) : value.substring(position);
        if (text2.length > 0) {
          tokens.push({
            value: text2,
            foreground,
            background,
            decorations: new Set(decorations2)
          });
        }
        if (findResult.sequence) {
          const commands = parseSequence(findResult.sequence);
          for (const styleToken of commands) {
            if (styleToken.type === "resetAll") {
              foreground = null;
              background = null;
              decorations2.clear();
            } else if (styleToken.type === "resetForegroundColor") {
              foreground = null;
            } else if (styleToken.type === "resetBackgroundColor") {
              background = null;
            } else if (styleToken.type === "resetDecoration") {
              decorations2.delete(styleToken.value);
            }
          }
          for (const styleToken of commands) {
            if (styleToken.type === "setForegroundColor") {
              foreground = styleToken.value;
            } else if (styleToken.type === "setBackgroundColor") {
              background = styleToken.value;
            } else if (styleToken.type === "setDecoration") {
              decorations2.add(styleToken.value);
            }
          }
        }
        position = findResult.position;
      } while (position < value.length);
      return tokens;
    }
  };
}
var defaultNamedColorsMap = {
  black: "#000000",
  red: "#bb0000",
  green: "#00bb00",
  yellow: "#bbbb00",
  blue: "#0000bb",
  magenta: "#ff00ff",
  cyan: "#00bbbb",
  white: "#eeeeee",
  brightBlack: "#555555",
  brightRed: "#ff5555",
  brightGreen: "#00ff00",
  brightYellow: "#ffff55",
  brightBlue: "#5555ff",
  brightMagenta: "#ff55ff",
  brightCyan: "#55ffff",
  brightWhite: "#ffffff"
};
function createColorPalette(namedColorsMap = defaultNamedColorsMap) {
  function namedColor(name) {
    return namedColorsMap[name];
  }
  function rgbColor(rgb) {
    return `#${rgb.map((x) => Math.max(0, Math.min(x, 255)).toString(16).padStart(2, "0")).join("")}`;
  }
  let colorTable;
  function getColorTable() {
    if (colorTable) {
      return colorTable;
    }
    colorTable = [];
    for (let i = 0; i < namedColors.length; i++) {
      colorTable.push(namedColor(namedColors[i]));
    }
    let levels = [0, 95, 135, 175, 215, 255];
    for (let r = 0; r < 6; r++) {
      for (let g = 0; g < 6; g++) {
        for (let b = 0; b < 6; b++) {
          colorTable.push(rgbColor([levels[r], levels[g], levels[b]]));
        }
      }
    }
    let level = 8;
    for (let i = 0; i < 24; i++, level += 10) {
      colorTable.push(rgbColor([level, level, level]));
    }
    return colorTable;
  }
  function tableColor(index) {
    return getColorTable()[index];
  }
  function value(color) {
    switch (color.type) {
      case "named":
        return namedColor(color.name);
      case "rgb":
        return rgbColor(color.rgb);
      case "table":
        return tableColor(color.index);
    }
  }
  return {
    value
  };
}
const defaultAnsiColors = {
  black: "#000000",
  red: "#cd3131",
  green: "#0DBC79",
  yellow: "#E5E510",
  blue: "#2472C8",
  magenta: "#BC3FBC",
  cyan: "#11A8CD",
  white: "#E5E5E5",
  brightBlack: "#666666",
  brightRed: "#F14C4C",
  brightGreen: "#23D18B",
  brightYellow: "#F5F543",
  brightBlue: "#3B8EEA",
  brightMagenta: "#D670D6",
  brightCyan: "#29B8DB",
  brightWhite: "#FFFFFF"
};
function tokenizeAnsiWithTheme(theme, fileContents, options2) {
  const colorReplacements = resolveColorReplacements(theme, options2);
  const lines = splitLines(fileContents);
  const ansiPalette = Object.fromEntries(
    namedColors.map((name) => {
      const key2 = `terminal.ansi${name[0].toUpperCase()}${name.substring(1)}`;
      const themeColor = theme.colors?.[key2];
      return [name, themeColor || defaultAnsiColors[name]];
    })
  );
  const colorPalette = createColorPalette(ansiPalette);
  const parser = createAnsiSequenceParser();
  return lines.map(
    (line) => parser.parse(line[0]).map((token) => {
      let color;
      let bgColor;
      if (token.decorations.has("reverse")) {
        color = token.background ? colorPalette.value(token.background) : theme.bg;
        bgColor = token.foreground ? colorPalette.value(token.foreground) : theme.fg;
      } else {
        color = token.foreground ? colorPalette.value(token.foreground) : theme.fg;
        bgColor = token.background ? colorPalette.value(token.background) : void 0;
      }
      color = applyColorReplacements(color, colorReplacements);
      bgColor = applyColorReplacements(bgColor, colorReplacements);
      if (token.decorations.has("dim"))
        color = dimColor(color);
      let fontStyle = FontStyle.None;
      if (token.decorations.has("bold"))
        fontStyle |= FontStyle.Bold;
      if (token.decorations.has("italic"))
        fontStyle |= FontStyle.Italic;
      if (token.decorations.has("underline"))
        fontStyle |= FontStyle.Underline;
      if (token.decorations.has("strikethrough"))
        fontStyle |= FontStyle.Strikethrough;
      return {
        content: token.value,
        offset: line[1],
        // TODO: more accurate offset? might need to fork ansi-sequence-parser
        color,
        bgColor,
        fontStyle
      };
    })
  );
}
function dimColor(color) {
  const hexMatch = color.match(/#([0-9a-f]{3,8})/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 8) {
      const alpha = Math.round(Number.parseInt(hex.slice(6, 8), 16) / 2).toString(16).padStart(2, "0");
      return `#${hex.slice(0, 6)}${alpha}`;
    } else if (hex.length === 6) {
      return `#${hex}80`;
    } else if (hex.length === 4) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      const a = hex[3];
      const alpha = Math.round(Number.parseInt(`${a}${a}`, 16) / 2).toString(16).padStart(2, "0");
      return `#${r}${r}${g}${g}${b}${b}${alpha}`;
    } else if (hex.length === 3) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      return `#${r}${r}${g}${g}${b}${b}80`;
    }
  }
  const cssVarMatch = color.match(/var\((--[\w-]+-ansi-[\w-]+)\)/);
  if (cssVarMatch)
    return `var(${cssVarMatch[1]}-dim)`;
  return color;
}
function codeToTokensBase(internal, code, options2 = {}) {
  const {
    theme: themeName = internal.getLoadedThemes()[0]
  } = options2;
  const lang = internal.resolveLangAlias(options2.lang || "text");
  if (isPlainLang(lang) || isNoneTheme(themeName))
    return splitLines(code).map((line) => [{ content: line[0], offset: line[1] }]);
  const { theme, colorMap } = internal.setTheme(themeName);
  if (lang === "ansi")
    return tokenizeAnsiWithTheme(theme, code, options2);
  const _grammar = internal.getLanguage(options2.lang || "text");
  if (options2.grammarState) {
    if (options2.grammarState.lang !== _grammar.name) {
      throw new ShikiError$2(`Grammar state language "${options2.grammarState.lang}" does not match highlight language "${_grammar.name}"`);
    }
    if (!options2.grammarState.themes.includes(theme.name)) {
      throw new ShikiError$2(`Grammar state themes "${options2.grammarState.themes}" do not contain highlight theme "${theme.name}"`);
    }
  }
  return tokenizeWithTheme(code, _grammar, theme, colorMap, options2);
}
function getLastGrammarState(...args) {
  if (args.length === 2) {
    return getLastGrammarStateFromMap(args[1]);
  }
  const [internal, code, options2 = {}] = args;
  const {
    lang = "text",
    theme: themeName = internal.getLoadedThemes()[0]
  } = options2;
  if (isPlainLang(lang) || isNoneTheme(themeName))
    throw new ShikiError$2("Plain language does not have grammar state");
  if (lang === "ansi")
    throw new ShikiError$2("ANSI language does not have grammar state");
  const { theme, colorMap } = internal.setTheme(themeName);
  const _grammar = internal.getLanguage(lang);
  return new GrammarState(
    _tokenizeWithTheme(code, _grammar, theme, colorMap, options2).stateStack,
    _grammar.name,
    theme.name
  );
}
function tokenizeWithTheme(code, grammar, theme, colorMap, options2) {
  const result = _tokenizeWithTheme(code, grammar, theme, colorMap, options2);
  const grammarState = new GrammarState(
    result.stateStack,
    grammar.name,
    theme.name
  );
  setLastGrammarStateToMap(result.tokens, grammarState);
  return result.tokens;
}
function _tokenizeWithTheme(code, grammar, theme, colorMap, options2) {
  const colorReplacements = resolveColorReplacements(theme, options2);
  const {
    tokenizeMaxLineLength = 0,
    tokenizeTimeLimit = 500
  } = options2;
  const lines = splitLines(code);
  let stateStack = options2.grammarState ? getGrammarStack(options2.grammarState, theme.name) ?? INITIAL : options2.grammarContextCode != null ? _tokenizeWithTheme(
    options2.grammarContextCode,
    grammar,
    theme,
    colorMap,
    {
      ...options2,
      grammarState: void 0,
      grammarContextCode: void 0
    }
  ).stateStack : INITIAL;
  let actual = [];
  const final = [];
  for (let i = 0, len = lines.length; i < len; i++) {
    const [line, lineOffset] = lines[i];
    if (line === "") {
      actual = [];
      final.push([]);
      continue;
    }
    if (tokenizeMaxLineLength > 0 && line.length >= tokenizeMaxLineLength) {
      actual = [];
      final.push([{
        content: line,
        offset: lineOffset,
        color: "",
        fontStyle: 0
      }]);
      continue;
    }
    let resultWithScopes;
    let tokensWithScopes;
    let tokensWithScopesIndex;
    if (options2.includeExplanation) {
      resultWithScopes = grammar.tokenizeLine(line, stateStack, tokenizeTimeLimit);
      tokensWithScopes = resultWithScopes.tokens;
      tokensWithScopesIndex = 0;
    }
    const result = grammar.tokenizeLine2(line, stateStack, tokenizeTimeLimit);
    const tokensLength = result.tokens.length / 2;
    for (let j = 0; j < tokensLength; j++) {
      const startIndex = result.tokens[2 * j];
      const nextStartIndex = j + 1 < tokensLength ? result.tokens[2 * j + 2] : line.length;
      if (startIndex === nextStartIndex)
        continue;
      const metadata = result.tokens[2 * j + 1];
      const color = applyColorReplacements(
        colorMap[EncodedTokenMetadata.getForeground(metadata)],
        colorReplacements
      );
      const fontStyle = EncodedTokenMetadata.getFontStyle(metadata);
      const token = {
        content: line.substring(startIndex, nextStartIndex),
        offset: lineOffset + startIndex,
        color,
        fontStyle
      };
      if (options2.includeExplanation) {
        const themeSettingsSelectors = [];
        if (options2.includeExplanation !== "scopeName") {
          for (const setting of theme.settings) {
            let selectors;
            switch (typeof setting.scope) {
              case "string":
                selectors = setting.scope.split(/,/).map((scope) => scope.trim());
                break;
              case "object":
                selectors = setting.scope;
                break;
              default:
                continue;
            }
            themeSettingsSelectors.push({
              settings: setting,
              selectors: selectors.map((selector) => selector.split(/ /))
            });
          }
        }
        token.explanation = [];
        let offset = 0;
        while (startIndex + offset < nextStartIndex) {
          const tokenWithScopes = tokensWithScopes[tokensWithScopesIndex];
          const tokenWithScopesText = line.substring(
            tokenWithScopes.startIndex,
            tokenWithScopes.endIndex
          );
          offset += tokenWithScopesText.length;
          token.explanation.push({
            content: tokenWithScopesText,
            scopes: options2.includeExplanation === "scopeName" ? explainThemeScopesNameOnly(
              tokenWithScopes.scopes
            ) : explainThemeScopesFull(
              themeSettingsSelectors,
              tokenWithScopes.scopes
            )
          });
          tokensWithScopesIndex += 1;
        }
      }
      actual.push(token);
    }
    final.push(actual);
    actual = [];
    stateStack = result.ruleStack;
  }
  return {
    tokens: final,
    stateStack
  };
}
function explainThemeScopesNameOnly(scopes) {
  return scopes.map((scope) => ({ scopeName: scope }));
}
function explainThemeScopesFull(themeSelectors, scopes) {
  const result = [];
  for (let i = 0, len = scopes.length; i < len; i++) {
    const scope = scopes[i];
    result[i] = {
      scopeName: scope,
      themeMatches: explainThemeScope(themeSelectors, scope, scopes.slice(0, i))
    };
  }
  return result;
}
function matchesOne(selector, scope) {
  return selector === scope || scope.substring(0, selector.length) === selector && scope[selector.length] === ".";
}
function matches(selectors, scope, parentScopes) {
  if (!matchesOne(selectors[selectors.length - 1], scope))
    return false;
  let selectorParentIndex = selectors.length - 2;
  let parentIndex = parentScopes.length - 1;
  while (selectorParentIndex >= 0 && parentIndex >= 0) {
    if (matchesOne(selectors[selectorParentIndex], parentScopes[parentIndex]))
      selectorParentIndex -= 1;
    parentIndex -= 1;
  }
  if (selectorParentIndex === -1)
    return true;
  return false;
}
function explainThemeScope(themeSettingsSelectors, scope, parentScopes) {
  const result = [];
  for (const { selectors, settings } of themeSettingsSelectors) {
    for (const selectorPieces of selectors) {
      if (matches(selectorPieces, scope, parentScopes)) {
        result.push(settings);
        break;
      }
    }
  }
  return result;
}
function codeToTokensWithThemes(internal, code, options2) {
  const themes = Object.entries(options2.themes).filter((i) => i[1]).map((i) => ({ color: i[0], theme: i[1] }));
  const themedTokens = themes.map((t) => {
    const tokens2 = codeToTokensBase(internal, code, {
      ...options2,
      theme: t.theme
    });
    const state = getLastGrammarStateFromMap(tokens2);
    const theme = typeof t.theme === "string" ? t.theme : t.theme.name;
    return {
      tokens: tokens2,
      state,
      theme
    };
  });
  const tokens = syncThemesTokenization(
    ...themedTokens.map((i) => i.tokens)
  );
  const mergedTokens = tokens[0].map(
    (line, lineIdx) => line.map((_token, tokenIdx) => {
      const mergedToken = {
        content: _token.content,
        variants: {},
        offset: _token.offset
      };
      if ("includeExplanation" in options2 && options2.includeExplanation) {
        mergedToken.explanation = _token.explanation;
      }
      tokens.forEach((t, themeIdx) => {
        const {
          content: _,
          explanation: __,
          offset: ___,
          ...styles
        } = t[lineIdx][tokenIdx];
        mergedToken.variants[themes[themeIdx].color] = styles;
      });
      return mergedToken;
    })
  );
  const mergedGrammarState = themedTokens[0].state ? new GrammarState(
    Object.fromEntries(themedTokens.map((s) => [s.theme, s.state?.getInternalStack(s.theme)])),
    themedTokens[0].state.lang
  ) : void 0;
  if (mergedGrammarState)
    setLastGrammarStateToMap(mergedTokens, mergedGrammarState);
  return mergedTokens;
}
function syncThemesTokenization(...themes) {
  const outThemes = themes.map(() => []);
  const count = themes.length;
  for (let i = 0; i < themes[0].length; i++) {
    const lines = themes.map((t) => t[i]);
    const outLines = outThemes.map(() => []);
    outThemes.forEach((t, i2) => t.push(outLines[i2]));
    const indexes = lines.map(() => 0);
    const current = lines.map((l) => l[0]);
    while (current.every((t) => t)) {
      const minLength = Math.min(...current.map((t) => t.content.length));
      for (let n = 0; n < count; n++) {
        const token = current[n];
        if (token.content.length === minLength) {
          outLines[n].push(token);
          indexes[n] += 1;
          current[n] = lines[n][indexes[n]];
        } else {
          outLines[n].push({
            ...token,
            content: token.content.slice(0, minLength)
          });
          current[n] = {
            ...token,
            content: token.content.slice(minLength),
            offset: token.offset + minLength
          };
        }
      }
    }
  }
  return outThemes;
}
function codeToTokens(internal, code, options2) {
  let bg;
  let fg;
  let tokens;
  let themeName;
  let rootStyle;
  let grammarState;
  if ("themes" in options2) {
    const {
      defaultColor = "light",
      cssVariablePrefix = "--shiki-",
      colorsRendering = "css-vars"
    } = options2;
    const themes = Object.entries(options2.themes).filter((i) => i[1]).map((i) => ({ color: i[0], theme: i[1] })).sort((a, b) => a.color === defaultColor ? -1 : b.color === defaultColor ? 1 : 0);
    if (themes.length === 0)
      throw new ShikiError$2("`themes` option must not be empty");
    const themeTokens = codeToTokensWithThemes(
      internal,
      code,
      options2
    );
    grammarState = getLastGrammarStateFromMap(themeTokens);
    if (defaultColor && DEFAULT_COLOR_LIGHT_DARK !== defaultColor && !themes.find((t) => t.color === defaultColor))
      throw new ShikiError$2(`\`themes\` option must contain the defaultColor key \`${defaultColor}\``);
    const themeRegs = themes.map((t) => internal.getTheme(t.theme));
    const themesOrder = themes.map((t) => t.color);
    tokens = themeTokens.map((line) => line.map((token) => flatTokenVariants(token, themesOrder, cssVariablePrefix, defaultColor, colorsRendering)));
    if (grammarState)
      setLastGrammarStateToMap(tokens, grammarState);
    const themeColorReplacements = themes.map((t) => resolveColorReplacements(t.theme, options2));
    fg = mapThemeColors(themes, themeRegs, themeColorReplacements, cssVariablePrefix, defaultColor, "fg", colorsRendering);
    bg = mapThemeColors(themes, themeRegs, themeColorReplacements, cssVariablePrefix, defaultColor, "bg", colorsRendering);
    themeName = `shiki-themes ${themeRegs.map((t) => t.name).join(" ")}`;
    rootStyle = defaultColor ? void 0 : [fg, bg].join(";");
  } else if ("theme" in options2) {
    const colorReplacements = resolveColorReplacements(options2.theme, options2);
    tokens = codeToTokensBase(
      internal,
      code,
      options2
    );
    const _theme = internal.getTheme(options2.theme);
    bg = applyColorReplacements(_theme.bg, colorReplacements);
    fg = applyColorReplacements(_theme.fg, colorReplacements);
    themeName = _theme.name;
    grammarState = getLastGrammarStateFromMap(tokens);
  } else {
    throw new ShikiError$2("Invalid options, either `theme` or `themes` must be provided");
  }
  return {
    tokens,
    fg,
    bg,
    themeName,
    rootStyle,
    grammarState
  };
}
function mapThemeColors(themes, themeRegs, themeColorReplacements, cssVariablePrefix, defaultColor, property, colorsRendering) {
  return themes.map((t, idx) => {
    const value = applyColorReplacements(themeRegs[idx][property], themeColorReplacements[idx]) || "inherit";
    const cssVar = `${cssVariablePrefix + t.color}${property === "bg" ? "-bg" : ""}:${value}`;
    if (idx === 0 && defaultColor) {
      if (defaultColor === DEFAULT_COLOR_LIGHT_DARK && themes.length > 1) {
        const lightIndex = themes.findIndex((t2) => t2.color === "light");
        const darkIndex = themes.findIndex((t2) => t2.color === "dark");
        if (lightIndex === -1 || darkIndex === -1)
          throw new ShikiError$2('When using `defaultColor: "light-dark()"`, you must provide both `light` and `dark` themes');
        const lightValue = applyColorReplacements(themeRegs[lightIndex][property], themeColorReplacements[lightIndex]) || "inherit";
        const darkValue = applyColorReplacements(themeRegs[darkIndex][property], themeColorReplacements[darkIndex]) || "inherit";
        return `light-dark(${lightValue}, ${darkValue});${cssVar}`;
      }
      return value;
    }
    if (colorsRendering === "css-vars") {
      return cssVar;
    }
    return null;
  }).filter((i) => !!i).join(";");
}
function codeToHast(internal, code, options2, transformerContext = {
  meta: {},
  options: options2,
  codeToHast: (_code, _options) => codeToHast(internal, _code, _options),
  codeToTokens: (_code, _options) => codeToTokens(internal, _code, _options)
}) {
  let input = code;
  for (const transformer of getTransformers(options2))
    input = transformer.preprocess?.call(transformerContext, input, options2) || input;
  let {
    tokens,
    fg,
    bg,
    themeName,
    rootStyle,
    grammarState
  } = codeToTokens(internal, input, options2);
  const {
    mergeWhitespaces = true,
    mergeSameStyleTokens = false
  } = options2;
  if (mergeWhitespaces === true)
    tokens = mergeWhitespaceTokens(tokens);
  else if (mergeWhitespaces === "never")
    tokens = splitWhitespaceTokens(tokens);
  if (mergeSameStyleTokens) {
    tokens = mergeAdjacentStyledTokens(tokens);
  }
  const contextSource = {
    ...transformerContext,
    get source() {
      return input;
    }
  };
  for (const transformer of getTransformers(options2))
    tokens = transformer.tokens?.call(contextSource, tokens) || tokens;
  return tokensToHast(
    tokens,
    {
      ...options2,
      fg,
      bg,
      themeName,
      rootStyle: options2.rootStyle === false ? false : options2.rootStyle ?? rootStyle
    },
    contextSource,
    grammarState
  );
}
function tokensToHast(tokens, options2, transformerContext, grammarState = getLastGrammarStateFromMap(tokens)) {
  const transformers = getTransformers(options2);
  const lines = [];
  const root2 = {
    type: "root",
    children: []
  };
  const {
    structure = "classic",
    tabindex = "0"
  } = options2;
  const properties = {
    class: `shiki ${options2.themeName || ""}`
  };
  if (options2.rootStyle !== false) {
    if (options2.rootStyle != null)
      properties.style = options2.rootStyle;
    else
      properties.style = `background-color:${options2.bg};color:${options2.fg}`;
  }
  if (tabindex !== false && tabindex != null)
    properties.tabindex = tabindex.toString();
  for (const [key2, value] of Object.entries(options2.meta || {})) {
    if (!key2.startsWith("_"))
      properties[key2] = value;
  }
  let preNode = {
    type: "element",
    tagName: "pre",
    properties,
    children: [],
    data: options2.data
  };
  let codeNode = {
    type: "element",
    tagName: "code",
    properties: {},
    children: lines
  };
  const lineNodes = [];
  const context = {
    ...transformerContext,
    structure,
    addClassToHast,
    get source() {
      return transformerContext.source;
    },
    get tokens() {
      return tokens;
    },
    get options() {
      return options2;
    },
    get root() {
      return root2;
    },
    get pre() {
      return preNode;
    },
    get code() {
      return codeNode;
    },
    get lines() {
      return lineNodes;
    }
  };
  tokens.forEach((line, idx) => {
    if (idx) {
      if (structure === "inline")
        root2.children.push({ type: "element", tagName: "br", properties: {}, children: [] });
      else if (structure === "classic")
        lines.push({ type: "text", value: "\n" });
    }
    let lineNode = {
      type: "element",
      tagName: "span",
      properties: { class: "line" },
      children: []
    };
    let col = 0;
    for (const token of line) {
      let tokenNode = {
        type: "element",
        tagName: "span",
        properties: {
          ...token.htmlAttrs
        },
        children: [{ type: "text", value: token.content }]
      };
      const style = stringifyTokenStyle(token.htmlStyle || getTokenStyleObject(token));
      if (style)
        tokenNode.properties.style = style;
      for (const transformer of transformers)
        tokenNode = transformer?.span?.call(context, tokenNode, idx + 1, col, lineNode, token) || tokenNode;
      if (structure === "inline")
        root2.children.push(tokenNode);
      else if (structure === "classic")
        lineNode.children.push(tokenNode);
      col += token.content.length;
    }
    if (structure === "classic") {
      for (const transformer of transformers)
        lineNode = transformer?.line?.call(context, lineNode, idx + 1) || lineNode;
      lineNodes.push(lineNode);
      lines.push(lineNode);
    } else if (structure === "inline") {
      lineNodes.push(lineNode);
    }
  });
  if (structure === "classic") {
    for (const transformer of transformers)
      codeNode = transformer?.code?.call(context, codeNode) || codeNode;
    preNode.children.push(codeNode);
    for (const transformer of transformers)
      preNode = transformer?.pre?.call(context, preNode) || preNode;
    root2.children.push(preNode);
  } else if (structure === "inline") {
    const syntheticLines = [];
    let currentLine = {
      type: "element",
      tagName: "span",
      properties: { class: "line" },
      children: []
    };
    for (const child of root2.children) {
      if (child.type === "element" && child.tagName === "br") {
        syntheticLines.push(currentLine);
        currentLine = {
          type: "element",
          tagName: "span",
          properties: { class: "line" },
          children: []
        };
      } else if (child.type === "element" || child.type === "text") {
        currentLine.children.push(child);
      }
    }
    syntheticLines.push(currentLine);
    const syntheticCode = {
      type: "element",
      tagName: "code",
      properties: {},
      children: syntheticLines
    };
    let transformedCode = syntheticCode;
    for (const transformer of transformers)
      transformedCode = transformer?.code?.call(context, transformedCode) || transformedCode;
    root2.children = [];
    for (let i = 0; i < transformedCode.children.length; i++) {
      if (i > 0)
        root2.children.push({ type: "element", tagName: "br", properties: {}, children: [] });
      const line = transformedCode.children[i];
      if (line.type === "element")
        root2.children.push(...line.children);
    }
  }
  let result = root2;
  for (const transformer of transformers)
    result = transformer?.root?.call(context, result) || result;
  if (grammarState)
    setLastGrammarStateToMap(result, grammarState);
  return result;
}
function mergeWhitespaceTokens(tokens) {
  return tokens.map((line) => {
    const newLine = [];
    let carryOnContent = "";
    let firstOffset;
    line.forEach((token, idx) => {
      const isDecorated = token.fontStyle && (token.fontStyle & FontStyle.Underline || token.fontStyle & FontStyle.Strikethrough);
      const couldMerge = !isDecorated;
      if (couldMerge && token.content.match(/^\s+$/) && line[idx + 1]) {
        if (firstOffset === void 0)
          firstOffset = token.offset;
        carryOnContent += token.content;
      } else {
        if (carryOnContent) {
          if (couldMerge) {
            newLine.push({
              ...token,
              offset: firstOffset,
              content: carryOnContent + token.content
            });
          } else {
            newLine.push(
              {
                content: carryOnContent,
                offset: firstOffset
              },
              token
            );
          }
          firstOffset = void 0;
          carryOnContent = "";
        } else {
          newLine.push(token);
        }
      }
    });
    return newLine;
  });
}
function splitWhitespaceTokens(tokens) {
  return tokens.map((line) => {
    return line.flatMap((token) => {
      if (token.content.match(/^\s+$/))
        return token;
      const match = token.content.match(/^(\s*)(.*?)(\s*)$/);
      if (!match)
        return token;
      const [, leading, content, trailing] = match;
      if (!leading && !trailing)
        return token;
      const expanded = [{
        ...token,
        offset: token.offset + leading.length,
        content
      }];
      if (leading) {
        expanded.unshift({
          content: leading,
          offset: token.offset
        });
      }
      if (trailing) {
        expanded.push({
          content: trailing,
          offset: token.offset + leading.length + content.length
        });
      }
      return expanded;
    });
  });
}
function mergeAdjacentStyledTokens(tokens) {
  return tokens.map((line) => {
    const newLine = [];
    for (const token of line) {
      if (newLine.length === 0) {
        newLine.push({ ...token });
        continue;
      }
      const prevToken = newLine[newLine.length - 1];
      const prevStyle = stringifyTokenStyle(prevToken.htmlStyle || getTokenStyleObject(prevToken));
      const currentStyle = stringifyTokenStyle(token.htmlStyle || getTokenStyleObject(token));
      const isPrevDecorated = prevToken.fontStyle && (prevToken.fontStyle & FontStyle.Underline || prevToken.fontStyle & FontStyle.Strikethrough);
      const isDecorated = token.fontStyle && (token.fontStyle & FontStyle.Underline || token.fontStyle & FontStyle.Strikethrough);
      if (!isPrevDecorated && !isDecorated && prevStyle === currentStyle) {
        prevToken.content += token.content;
      } else {
        newLine.push({ ...token });
      }
    }
    return newLine;
  });
}
const hastToHtml = toHtml;
function codeToHtml(internal, code, options2) {
  const context = {
    meta: {},
    options: options2,
    codeToHast: (_code, _options) => codeToHast(internal, _code, _options),
    codeToTokens: (_code, _options) => codeToTokens(internal, _code, _options)
  };
  let result = hastToHtml(codeToHast(internal, code, options2, context));
  for (const transformer of getTransformers(options2))
    result = transformer.postprocess?.call(context, result, options2) || result;
  return result;
}
const VSCODE_FALLBACK_EDITOR_FG = { light: "#333333", dark: "#bbbbbb" };
const VSCODE_FALLBACK_EDITOR_BG = { light: "#fffffe", dark: "#1e1e1e" };
const RESOLVED_KEY = "__shiki_resolved";
function normalizeTheme(rawTheme) {
  if (rawTheme?.[RESOLVED_KEY])
    return rawTheme;
  const theme = {
    ...rawTheme
  };
  if (theme.tokenColors && !theme.settings) {
    theme.settings = theme.tokenColors;
    delete theme.tokenColors;
  }
  theme.type ||= "dark";
  theme.colorReplacements = { ...theme.colorReplacements };
  theme.settings ||= [];
  let { bg, fg } = theme;
  if (!bg || !fg) {
    const globalSetting = theme.settings ? theme.settings.find((s) => !s.name && !s.scope) : void 0;
    if (globalSetting?.settings?.foreground)
      fg = globalSetting.settings.foreground;
    if (globalSetting?.settings?.background)
      bg = globalSetting.settings.background;
    if (!fg && theme?.colors?.["editor.foreground"])
      fg = theme.colors["editor.foreground"];
    if (!bg && theme?.colors?.["editor.background"])
      bg = theme.colors["editor.background"];
    if (!fg)
      fg = theme.type === "light" ? VSCODE_FALLBACK_EDITOR_FG.light : VSCODE_FALLBACK_EDITOR_FG.dark;
    if (!bg)
      bg = theme.type === "light" ? VSCODE_FALLBACK_EDITOR_BG.light : VSCODE_FALLBACK_EDITOR_BG.dark;
    theme.fg = fg;
    theme.bg = bg;
  }
  if (!(theme.settings[0] && theme.settings[0].settings && !theme.settings[0].scope)) {
    theme.settings.unshift({
      settings: {
        foreground: theme.fg,
        background: theme.bg
      }
    });
  }
  let replacementCount = 0;
  const replacementMap = /* @__PURE__ */ new Map();
  function getReplacementColor(value) {
    if (replacementMap.has(value))
      return replacementMap.get(value);
    replacementCount += 1;
    const hex = `#${replacementCount.toString(16).padStart(8, "0").toLowerCase()}`;
    if (theme.colorReplacements?.[`#${hex}`])
      return getReplacementColor(value);
    replacementMap.set(value, hex);
    return hex;
  }
  theme.settings = theme.settings.map((setting) => {
    const replaceFg = setting.settings?.foreground && !setting.settings.foreground.startsWith("#");
    const replaceBg = setting.settings?.background && !setting.settings.background.startsWith("#");
    if (!replaceFg && !replaceBg)
      return setting;
    const clone2 = {
      ...setting,
      settings: {
        ...setting.settings
      }
    };
    if (replaceFg) {
      const replacement = getReplacementColor(setting.settings.foreground);
      theme.colorReplacements[replacement] = setting.settings.foreground;
      clone2.settings.foreground = replacement;
    }
    if (replaceBg) {
      const replacement = getReplacementColor(setting.settings.background);
      theme.colorReplacements[replacement] = setting.settings.background;
      clone2.settings.background = replacement;
    }
    return clone2;
  });
  for (const key2 of Object.keys(theme.colors || {})) {
    if (key2 === "editor.foreground" || key2 === "editor.background" || key2.startsWith("terminal.ansi")) {
      if (!theme.colors[key2]?.startsWith("#")) {
        const replacement = getReplacementColor(theme.colors[key2]);
        theme.colorReplacements[replacement] = theme.colors[key2];
        theme.colors[key2] = replacement;
      }
    }
  }
  Object.defineProperty(theme, RESOLVED_KEY, {
    enumerable: false,
    writable: false,
    value: true
  });
  return theme;
}
async function resolveLangs(langs) {
  return Array.from(new Set((await Promise.all(
    langs.filter((l) => !isSpecialLang(l)).map(async (lang) => await normalizeGetter(lang).then((r) => Array.isArray(r) ? r : [r]))
  )).flat()));
}
async function resolveThemes(themes) {
  const resolved = await Promise.all(
    themes.map(
      async (theme) => isSpecialTheme(theme) ? null : normalizeTheme(await normalizeGetter(theme))
    )
  );
  return resolved.filter((i) => !!i);
}
let _emitDeprecation = 3;
function warnDeprecated(message, version = 3) {
  if (version > _emitDeprecation)
    return;
  {
    console.trace(`[SHIKI DEPRECATE]: ${message}`);
  }
}
let ShikiError$1 = class ShikiError3 extends Error {
  constructor(message) {
    super(message);
    this.name = "ShikiError";
  }
};
function resolveLangAlias(name, alias) {
  if (!alias)
    return name;
  if (alias[name]) {
    const resolved = /* @__PURE__ */ new Set([name]);
    while (alias[name]) {
      name = alias[name];
      if (resolved.has(name))
        throw new ShikiError$1(`Circular alias \`${Array.from(resolved).join(" -> ")} -> ${name}\``);
      resolved.add(name);
    }
  }
  return name;
}
class Registry extends Registry$1 {
  constructor(_resolver, _themes, _langs, _alias = {}) {
    super(_resolver);
    this._resolver = _resolver;
    this._themes = _themes;
    this._langs = _langs;
    this._alias = _alias;
    this._themes.map((t) => this.loadTheme(t));
    this.loadLanguages(this._langs);
  }
  _resolvedThemes = /* @__PURE__ */ new Map();
  _resolvedGrammars = /* @__PURE__ */ new Map();
  _langMap = /* @__PURE__ */ new Map();
  _langGraph = /* @__PURE__ */ new Map();
  _textmateThemeCache = /* @__PURE__ */ new WeakMap();
  _loadedThemesCache = null;
  _loadedLanguagesCache = null;
  getTheme(theme) {
    if (typeof theme === "string")
      return this._resolvedThemes.get(theme);
    else
      return this.loadTheme(theme);
  }
  loadTheme(theme) {
    const _theme = normalizeTheme(theme);
    if (_theme.name) {
      this._resolvedThemes.set(_theme.name, _theme);
      this._loadedThemesCache = null;
    }
    return _theme;
  }
  getLoadedThemes() {
    if (!this._loadedThemesCache)
      this._loadedThemesCache = [...this._resolvedThemes.keys()];
    return this._loadedThemesCache;
  }
  // Override and re-implement this method to cache the textmate themes as `TextMateTheme.createFromRawTheme`
  // is expensive. Themes can switch often especially for dual-theme support.
  //
  // The parent class also accepts `colorMap` as the second parameter, but since we don't use that,
  // we omit here so it's easier to cache the themes.
  setTheme(theme) {
    let textmateTheme = this._textmateThemeCache.get(theme);
    if (!textmateTheme) {
      textmateTheme = Theme.createFromRawTheme(theme);
      this._textmateThemeCache.set(theme, textmateTheme);
    }
    this._syncRegistry.setTheme(textmateTheme);
  }
  getGrammar(name) {
    name = resolveLangAlias(name, this._alias);
    return this._resolvedGrammars.get(name);
  }
  loadLanguage(lang) {
    if (this.getGrammar(lang.name))
      return;
    const embeddedLazilyBy = new Set(
      [...this._langMap.values()].filter((i) => i.embeddedLangsLazy?.includes(lang.name))
    );
    this._resolver.addLanguage(lang);
    const grammarConfig = {
      balancedBracketSelectors: lang.balancedBracketSelectors || ["*"],
      unbalancedBracketSelectors: lang.unbalancedBracketSelectors || []
    };
    this._syncRegistry._rawGrammars.set(lang.scopeName, lang);
    const g = this.loadGrammarWithConfiguration(lang.scopeName, 1, grammarConfig);
    g.name = lang.name;
    this._resolvedGrammars.set(lang.name, g);
    if (lang.aliases) {
      lang.aliases.forEach((alias) => {
        this._alias[alias] = lang.name;
      });
    }
    this._loadedLanguagesCache = null;
    if (embeddedLazilyBy.size) {
      for (const e of embeddedLazilyBy) {
        this._resolvedGrammars.delete(e.name);
        this._loadedLanguagesCache = null;
        this._syncRegistry?._injectionGrammars?.delete(e.scopeName);
        this._syncRegistry?._grammars?.delete(e.scopeName);
        this.loadLanguage(this._langMap.get(e.name));
      }
    }
  }
  dispose() {
    super.dispose();
    this._resolvedThemes.clear();
    this._resolvedGrammars.clear();
    this._langMap.clear();
    this._langGraph.clear();
    this._loadedThemesCache = null;
  }
  loadLanguages(langs) {
    for (const lang of langs)
      this.resolveEmbeddedLanguages(lang);
    const langsGraphArray = Array.from(this._langGraph.entries());
    const missingLangs = langsGraphArray.filter(([_, lang]) => !lang);
    if (missingLangs.length) {
      const dependents = langsGraphArray.filter(([_, lang]) => {
        if (!lang)
          return false;
        const embedded = lang.embeddedLanguages || lang.embeddedLangs;
        return embedded?.some((l) => missingLangs.map(([name]) => name).includes(l));
      }).filter((lang) => !missingLangs.includes(lang));
      throw new ShikiError$1(`Missing languages ${missingLangs.map(([name]) => `\`${name}\``).join(", ")}, required by ${dependents.map(([name]) => `\`${name}\``).join(", ")}`);
    }
    for (const [_, lang] of langsGraphArray)
      this._resolver.addLanguage(lang);
    for (const [_, lang] of langsGraphArray)
      this.loadLanguage(lang);
  }
  getLoadedLanguages() {
    if (!this._loadedLanguagesCache) {
      this._loadedLanguagesCache = [
        .../* @__PURE__ */ new Set([...this._resolvedGrammars.keys(), ...Object.keys(this._alias)])
      ];
    }
    return this._loadedLanguagesCache;
  }
  resolveEmbeddedLanguages(lang) {
    this._langMap.set(lang.name, lang);
    this._langGraph.set(lang.name, lang);
    const embedded = lang.embeddedLanguages ?? lang.embeddedLangs;
    if (embedded) {
      for (const embeddedLang of embedded)
        this._langGraph.set(embeddedLang, this._langMap.get(embeddedLang));
    }
  }
}
class Resolver {
  _langs = /* @__PURE__ */ new Map();
  _scopeToLang = /* @__PURE__ */ new Map();
  _injections = /* @__PURE__ */ new Map();
  _onigLib;
  constructor(engine2, langs) {
    this._onigLib = {
      createOnigScanner: (patterns) => engine2.createScanner(patterns),
      createOnigString: (s) => engine2.createString(s)
    };
    langs.forEach((i) => this.addLanguage(i));
  }
  get onigLib() {
    return this._onigLib;
  }
  getLangRegistration(langIdOrAlias) {
    return this._langs.get(langIdOrAlias);
  }
  loadGrammar(scopeName) {
    return this._scopeToLang.get(scopeName);
  }
  addLanguage(l) {
    this._langs.set(l.name, l);
    if (l.aliases) {
      l.aliases.forEach((a) => {
        this._langs.set(a, l);
      });
    }
    this._scopeToLang.set(l.scopeName, l);
    if (l.injectTo) {
      l.injectTo.forEach((i) => {
        if (!this._injections.get(i))
          this._injections.set(i, []);
        this._injections.get(i).push(l.scopeName);
      });
    }
  }
  getInjections(scopeName) {
    const scopeParts = scopeName.split(".");
    let injections = [];
    for (let i = 1; i <= scopeParts.length; i++) {
      const subScopeName = scopeParts.slice(0, i).join(".");
      injections = [...injections, ...this._injections.get(subScopeName) || []];
    }
    return injections;
  }
}
let instancesCount = 0;
function createShikiInternalSync(options2) {
  instancesCount += 1;
  if (options2.warnings !== false && instancesCount >= 10 && instancesCount % 10 === 0)
    console.warn(`[Shiki] ${instancesCount} instances have been created. Shiki is supposed to be used as a singleton, consider refactoring your code to cache your highlighter instance; Or call \`highlighter.dispose()\` to release unused instances.`);
  let isDisposed = false;
  if (!options2.engine)
    throw new ShikiError$1("`engine` option is required for synchronous mode");
  const langs = (options2.langs || []).flat(1);
  const themes = (options2.themes || []).flat(1).map(normalizeTheme);
  const resolver = new Resolver(options2.engine, langs);
  const _registry = new Registry(resolver, themes, langs, options2.langAlias);
  let _lastTheme;
  function resolveLangAlias$1(name) {
    return resolveLangAlias(name, options2.langAlias);
  }
  function getLanguage(name) {
    ensureNotDisposed();
    const _lang = _registry.getGrammar(typeof name === "string" ? name : name.name);
    if (!_lang)
      throw new ShikiError$1(`Language \`${name}\` not found, you may need to load it first`);
    return _lang;
  }
  function getTheme(name) {
    if (name === "none")
      return { bg: "", fg: "", name: "none", settings: [], type: "dark" };
    ensureNotDisposed();
    const _theme = _registry.getTheme(name);
    if (!_theme)
      throw new ShikiError$1(`Theme \`${name}\` not found, you may need to load it first`);
    return _theme;
  }
  function setTheme(name) {
    ensureNotDisposed();
    const theme = getTheme(name);
    if (_lastTheme !== name) {
      _registry.setTheme(theme);
      _lastTheme = name;
    }
    const colorMap = _registry.getColorMap();
    return {
      theme,
      colorMap
    };
  }
  function getLoadedThemes() {
    ensureNotDisposed();
    return _registry.getLoadedThemes();
  }
  function getLoadedLanguages() {
    ensureNotDisposed();
    return _registry.getLoadedLanguages();
  }
  function loadLanguageSync(...langs2) {
    ensureNotDisposed();
    _registry.loadLanguages(langs2.flat(1));
  }
  async function loadLanguage(...langs2) {
    return loadLanguageSync(await resolveLangs(langs2));
  }
  function loadThemeSync(...themes2) {
    ensureNotDisposed();
    for (const theme of themes2.flat(1)) {
      _registry.loadTheme(theme);
    }
  }
  async function loadTheme(...themes2) {
    ensureNotDisposed();
    return loadThemeSync(await resolveThemes(themes2));
  }
  function ensureNotDisposed() {
    if (isDisposed)
      throw new ShikiError$1("Shiki instance has been disposed");
  }
  function dispose() {
    if (isDisposed)
      return;
    isDisposed = true;
    _registry.dispose();
    instancesCount -= 1;
  }
  return {
    setTheme,
    getTheme,
    getLanguage,
    getLoadedThemes,
    getLoadedLanguages,
    resolveLangAlias: resolveLangAlias$1,
    loadLanguage,
    loadLanguageSync,
    loadTheme,
    loadThemeSync,
    dispose,
    [Symbol.dispose]: dispose
  };
}
async function createShikiInternal(options2) {
  if (!options2.engine) {
    warnDeprecated("`engine` option is required. Use `createOnigurumaEngine` or `createJavaScriptRegexEngine` to create an engine.");
  }
  const [
    themes,
    langs,
    engine2
  ] = await Promise.all([
    resolveThemes(options2.themes || []),
    resolveLangs(options2.langs || []),
    options2.engine
  ]);
  return createShikiInternalSync({
    ...options2,
    themes,
    langs,
    engine: engine2
  });
}
async function createHighlighterCore(options2) {
  const internal = await createShikiInternal(options2);
  return {
    getLastGrammarState: (...args) => getLastGrammarState(internal, ...args),
    codeToTokensBase: (code, options22) => codeToTokensBase(internal, code, options22),
    codeToTokensWithThemes: (code, options22) => codeToTokensWithThemes(internal, code, options22),
    codeToTokens: (code, options22) => codeToTokens(internal, code, options22),
    codeToHast: (code, options22) => codeToHast(internal, code, options22),
    codeToHtml: (code, options22) => codeToHtml(internal, code, options22),
    getBundledLanguages: () => ({}),
    getBundledThemes: () => ({}),
    ...internal,
    getInternalContext: () => internal
  };
}
function createBundledHighlighter(options2) {
  const bundledLanguages2 = options2.langs;
  const bundledThemes2 = options2.themes;
  const engine2 = options2.engine;
  async function createHighlighter2(options22) {
    function resolveLang(lang) {
      if (typeof lang === "string") {
        lang = options22.langAlias?.[lang] || lang;
        if (isSpecialLang(lang))
          return [];
        const bundle = bundledLanguages2[lang];
        if (!bundle)
          throw new ShikiError$2(`Language \`${lang}\` is not included in this bundle. You may want to load it from external source.`);
        return bundle;
      }
      return lang;
    }
    function resolveTheme(theme) {
      if (isSpecialTheme(theme))
        return "none";
      if (typeof theme === "string") {
        const bundle = bundledThemes2[theme];
        if (!bundle)
          throw new ShikiError$2(`Theme \`${theme}\` is not included in this bundle. You may want to load it from external source.`);
        return bundle;
      }
      return theme;
    }
    const _themes = (options22.themes ?? []).map((i) => resolveTheme(i));
    const langs = (options22.langs ?? []).map((i) => resolveLang(i));
    const core2 = await createHighlighterCore({
      engine: options22.engine ?? engine2(),
      ...options22,
      themes: _themes,
      langs
    });
    return {
      ...core2,
      loadLanguage(...langs2) {
        return core2.loadLanguage(...langs2.map(resolveLang));
      },
      loadTheme(...themes) {
        return core2.loadTheme(...themes.map(resolveTheme));
      },
      getBundledLanguages() {
        return bundledLanguages2;
      },
      getBundledThemes() {
        return bundledThemes2;
      }
    };
  }
  return createHighlighter2;
}
const bundledLanguagesInfo = [
  {
    "id": "abap",
    "name": "ABAP",
    "import": (() => import("./abap.js"))
  },
  {
    "id": "actionscript-3",
    "name": "ActionScript",
    "import": (() => import("./actionscript-3.js"))
  },
  {
    "id": "ada",
    "name": "Ada",
    "import": (() => import("./ada.js"))
  },
  {
    "id": "angular-html",
    "name": "Angular HTML",
    "import": (() => import("./angular-html.js").then((n) => n.f))
  },
  {
    "id": "angular-ts",
    "name": "Angular TypeScript",
    "import": (() => import("./angular-ts.js"))
  },
  {
    "id": "apache",
    "name": "Apache Conf",
    "import": (() => import("./apache.js"))
  },
  {
    "id": "apex",
    "name": "Apex",
    "import": (() => import("./apex.js"))
  },
  {
    "id": "apl",
    "name": "APL",
    "import": (() => import("./apl.js"))
  },
  {
    "id": "applescript",
    "name": "AppleScript",
    "import": (() => import("./applescript.js"))
  },
  {
    "id": "ara",
    "name": "Ara",
    "import": (() => import("./ara.js"))
  },
  {
    "id": "asciidoc",
    "name": "AsciiDoc",
    "aliases": [
      "adoc"
    ],
    "import": (() => import("./asciidoc.js"))
  },
  {
    "id": "asm",
    "name": "Assembly",
    "import": (() => import("./asm.js"))
  },
  {
    "id": "astro",
    "name": "Astro",
    "import": (() => import("./astro.js"))
  },
  {
    "id": "awk",
    "name": "AWK",
    "import": (() => import("./awk.js"))
  },
  {
    "id": "ballerina",
    "name": "Ballerina",
    "import": (() => import("./ballerina.js"))
  },
  {
    "id": "bat",
    "name": "Batch File",
    "aliases": [
      "batch"
    ],
    "import": (() => import("./bat.js"))
  },
  {
    "id": "beancount",
    "name": "Beancount",
    "import": (() => import("./beancount.js"))
  },
  {
    "id": "berry",
    "name": "Berry",
    "aliases": [
      "be"
    ],
    "import": (() => import("./berry.js"))
  },
  {
    "id": "bibtex",
    "name": "BibTeX",
    "import": (() => import("./bibtex.js"))
  },
  {
    "id": "bicep",
    "name": "Bicep",
    "import": (() => import("./bicep.js"))
  },
  {
    "id": "blade",
    "name": "Blade",
    "import": (() => import("./blade.js"))
  },
  {
    "id": "bsl",
    "name": "1C (Enterprise)",
    "aliases": [
      "1c"
    ],
    "import": (() => import("./bsl.js"))
  },
  {
    "id": "c",
    "name": "C",
    "import": (() => import("./c.js"))
  },
  {
    "id": "c3",
    "name": "C3",
    "import": (() => import("./c3.js"))
  },
  {
    "id": "cadence",
    "name": "Cadence",
    "aliases": [
      "cdc"
    ],
    "import": (() => import("./cadence.js"))
  },
  {
    "id": "cairo",
    "name": "Cairo",
    "import": (() => import("./cairo.js"))
  },
  {
    "id": "clarity",
    "name": "Clarity",
    "import": (() => import("./clarity.js"))
  },
  {
    "id": "clojure",
    "name": "Clojure",
    "aliases": [
      "clj"
    ],
    "import": (() => import("./clojure.js"))
  },
  {
    "id": "cmake",
    "name": "CMake",
    "import": (() => import("./cmake.js"))
  },
  {
    "id": "cobol",
    "name": "COBOL",
    "import": (() => import("./cobol.js"))
  },
  {
    "id": "codeowners",
    "name": "CODEOWNERS",
    "import": (() => import("./codeowners.js"))
  },
  {
    "id": "codeql",
    "name": "CodeQL",
    "aliases": [
      "ql"
    ],
    "import": (() => import("./codeql.js"))
  },
  {
    "id": "coffee",
    "name": "CoffeeScript",
    "aliases": [
      "coffeescript"
    ],
    "import": (() => import("./coffee.js"))
  },
  {
    "id": "common-lisp",
    "name": "Common Lisp",
    "aliases": [
      "lisp"
    ],
    "import": (() => import("./common-lisp.js"))
  },
  {
    "id": "coq",
    "name": "Coq",
    "import": (() => import("./coq.js"))
  },
  {
    "id": "cpp",
    "name": "C++",
    "aliases": [
      "c++"
    ],
    "import": (() => import("./cpp.js"))
  },
  {
    "id": "crystal",
    "name": "Crystal",
    "import": (() => import("./crystal.js"))
  },
  {
    "id": "csharp",
    "name": "C#",
    "aliases": [
      "c#",
      "cs"
    ],
    "import": (() => import("./csharp.js"))
  },
  {
    "id": "css",
    "name": "CSS",
    "import": (() => import("./css.js"))
  },
  {
    "id": "csv",
    "name": "CSV",
    "import": (() => import("./csv.js"))
  },
  {
    "id": "cue",
    "name": "CUE",
    "import": (() => import("./cue.js"))
  },
  {
    "id": "cypher",
    "name": "Cypher",
    "aliases": [
      "cql"
    ],
    "import": (() => import("./cypher.js"))
  },
  {
    "id": "d",
    "name": "D",
    "import": (() => import("./d.js"))
  },
  {
    "id": "dart",
    "name": "Dart",
    "import": (() => import("./dart.js"))
  },
  {
    "id": "dax",
    "name": "DAX",
    "import": (() => import("./dax.js"))
  },
  {
    "id": "desktop",
    "name": "Desktop",
    "import": (() => import("./desktop.js"))
  },
  {
    "id": "diff",
    "name": "Diff",
    "import": (() => import("./diff.js"))
  },
  {
    "id": "docker",
    "name": "Dockerfile",
    "aliases": [
      "dockerfile"
    ],
    "import": (() => import("./docker.js"))
  },
  {
    "id": "dotenv",
    "name": "dotEnv",
    "import": (() => import("./dotenv.js"))
  },
  {
    "id": "dream-maker",
    "name": "Dream Maker",
    "import": (() => import("./dream-maker.js"))
  },
  {
    "id": "edge",
    "name": "Edge",
    "import": (() => import("./edge.js"))
  },
  {
    "id": "elixir",
    "name": "Elixir",
    "import": (() => import("./elixir.js"))
  },
  {
    "id": "elm",
    "name": "Elm",
    "import": (() => import("./elm.js"))
  },
  {
    "id": "emacs-lisp",
    "name": "Emacs Lisp",
    "aliases": [
      "elisp"
    ],
    "import": (() => import("./emacs-lisp.js"))
  },
  {
    "id": "erb",
    "name": "ERB",
    "import": (() => import("./erb.js"))
  },
  {
    "id": "erlang",
    "name": "Erlang",
    "aliases": [
      "erl"
    ],
    "import": (() => import("./erlang.js"))
  },
  {
    "id": "fennel",
    "name": "Fennel",
    "import": (() => import("./fennel.js"))
  },
  {
    "id": "fish",
    "name": "Fish",
    "import": (() => import("./fish.js"))
  },
  {
    "id": "fluent",
    "name": "Fluent",
    "aliases": [
      "ftl"
    ],
    "import": (() => import("./fluent.js"))
  },
  {
    "id": "fortran-fixed-form",
    "name": "Fortran (Fixed Form)",
    "aliases": [
      "f",
      "for",
      "f77"
    ],
    "import": (() => import("./fortran-fixed-form.js"))
  },
  {
    "id": "fortran-free-form",
    "name": "Fortran (Free Form)",
    "aliases": [
      "f90",
      "f95",
      "f03",
      "f08",
      "f18"
    ],
    "import": (() => import("./fortran-free-form.js"))
  },
  {
    "id": "fsharp",
    "name": "F#",
    "aliases": [
      "f#",
      "fs"
    ],
    "import": (() => import("./fsharp.js"))
  },
  {
    "id": "gdresource",
    "name": "GDResource",
    "aliases": [
      "tscn",
      "tres"
    ],
    "import": (() => import("./gdresource.js"))
  },
  {
    "id": "gdscript",
    "name": "GDScript",
    "aliases": [
      "gd"
    ],
    "import": (() => import("./gdscript.js"))
  },
  {
    "id": "gdshader",
    "name": "GDShader",
    "import": (() => import("./gdshader.js"))
  },
  {
    "id": "genie",
    "name": "Genie",
    "import": (() => import("./genie.js"))
  },
  {
    "id": "gherkin",
    "name": "Gherkin",
    "import": (() => import("./gherkin.js"))
  },
  {
    "id": "git-commit",
    "name": "Git Commit Message",
    "import": (() => import("./git-commit.js"))
  },
  {
    "id": "git-rebase",
    "name": "Git Rebase Message",
    "import": (() => import("./git-rebase.js"))
  },
  {
    "id": "gleam",
    "name": "Gleam",
    "import": (() => import("./gleam.js"))
  },
  {
    "id": "glimmer-js",
    "name": "Glimmer JS",
    "aliases": [
      "gjs"
    ],
    "import": (() => import("./glimmer-js.js"))
  },
  {
    "id": "glimmer-ts",
    "name": "Glimmer TS",
    "aliases": [
      "gts"
    ],
    "import": (() => import("./glimmer-ts.js"))
  },
  {
    "id": "glsl",
    "name": "GLSL",
    "import": (() => import("./glsl.js"))
  },
  {
    "id": "gn",
    "name": "GN",
    "import": (() => import("./gn.js"))
  },
  {
    "id": "gnuplot",
    "name": "Gnuplot",
    "import": (() => import("./gnuplot.js"))
  },
  {
    "id": "go",
    "name": "Go",
    "import": (() => import("./go.js"))
  },
  {
    "id": "graphql",
    "name": "GraphQL",
    "aliases": [
      "gql"
    ],
    "import": (() => import("./graphql.js"))
  },
  {
    "id": "groovy",
    "name": "Groovy",
    "import": (() => import("./groovy.js"))
  },
  {
    "id": "hack",
    "name": "Hack",
    "import": (() => import("./hack.js"))
  },
  {
    "id": "haml",
    "name": "Ruby Haml",
    "import": (() => import("./haml.js"))
  },
  {
    "id": "handlebars",
    "name": "Handlebars",
    "aliases": [
      "hbs"
    ],
    "import": (() => import("./handlebars.js"))
  },
  {
    "id": "haskell",
    "name": "Haskell",
    "aliases": [
      "hs"
    ],
    "import": (() => import("./haskell.js"))
  },
  {
    "id": "haxe",
    "name": "Haxe",
    "import": (() => import("./haxe.js"))
  },
  {
    "id": "hcl",
    "name": "HashiCorp HCL",
    "import": (() => import("./hcl.js"))
  },
  {
    "id": "hjson",
    "name": "Hjson",
    "import": (() => import("./hjson.js"))
  },
  {
    "id": "hlsl",
    "name": "HLSL",
    "import": (() => import("./hlsl.js"))
  },
  {
    "id": "html",
    "name": "HTML",
    "import": (() => import("./html.js"))
  },
  {
    "id": "html-derivative",
    "name": "HTML (Derivative)",
    "import": (() => import("./html-derivative.js"))
  },
  {
    "id": "http",
    "name": "HTTP",
    "import": (() => import("./http.js"))
  },
  {
    "id": "hurl",
    "name": "Hurl",
    "import": (() => import("./hurl.js"))
  },
  {
    "id": "hxml",
    "name": "HXML",
    "import": (() => import("./hxml.js"))
  },
  {
    "id": "hy",
    "name": "Hy",
    "import": (() => import("./hy.js"))
  },
  {
    "id": "imba",
    "name": "Imba",
    "import": (() => import("./imba.js"))
  },
  {
    "id": "ini",
    "name": "INI",
    "aliases": [
      "properties"
    ],
    "import": (() => import("./ini.js"))
  },
  {
    "id": "java",
    "name": "Java",
    "import": (() => import("./java.js"))
  },
  {
    "id": "javascript",
    "name": "JavaScript",
    "aliases": [
      "js",
      "cjs",
      "mjs"
    ],
    "import": (() => import("./javascript.js"))
  },
  {
    "id": "jinja",
    "name": "Jinja",
    "import": (() => import("./jinja.js"))
  },
  {
    "id": "jison",
    "name": "Jison",
    "import": (() => import("./jison.js"))
  },
  {
    "id": "json",
    "name": "JSON",
    "import": (() => import("./json.js"))
  },
  {
    "id": "json5",
    "name": "JSON5",
    "import": (() => import("./json5.js"))
  },
  {
    "id": "jsonc",
    "name": "JSON with Comments",
    "import": (() => import("./jsonc.js"))
  },
  {
    "id": "jsonl",
    "name": "JSON Lines",
    "import": (() => import("./jsonl.js"))
  },
  {
    "id": "jsonnet",
    "name": "Jsonnet",
    "import": (() => import("./jsonnet.js"))
  },
  {
    "id": "jssm",
    "name": "JSSM",
    "aliases": [
      "fsl"
    ],
    "import": (() => import("./jssm.js"))
  },
  {
    "id": "jsx",
    "name": "JSX",
    "import": (() => import("./jsx.js"))
  },
  {
    "id": "julia",
    "name": "Julia",
    "aliases": [
      "jl"
    ],
    "import": (() => import("./julia.js"))
  },
  {
    "id": "kdl",
    "name": "KDL",
    "import": (() => import("./kdl.js"))
  },
  {
    "id": "kotlin",
    "name": "Kotlin",
    "aliases": [
      "kt",
      "kts"
    ],
    "import": (() => import("./kotlin.js"))
  },
  {
    "id": "kusto",
    "name": "Kusto",
    "aliases": [
      "kql"
    ],
    "import": (() => import("./kusto.js"))
  },
  {
    "id": "latex",
    "name": "LaTeX",
    "import": (() => import("./latex.js"))
  },
  {
    "id": "lean",
    "name": "Lean 4",
    "aliases": [
      "lean4"
    ],
    "import": (() => import("./lean.js"))
  },
  {
    "id": "less",
    "name": "Less",
    "import": (() => import("./less.js"))
  },
  {
    "id": "liquid",
    "name": "Liquid",
    "import": (() => import("./liquid.js"))
  },
  {
    "id": "llvm",
    "name": "LLVM IR",
    "import": (() => import("./llvm.js"))
  },
  {
    "id": "log",
    "name": "Log file",
    "import": (() => import("./log.js"))
  },
  {
    "id": "logo",
    "name": "Logo",
    "import": (() => import("./logo.js"))
  },
  {
    "id": "lua",
    "name": "Lua",
    "import": (() => import("./lua.js"))
  },
  {
    "id": "luau",
    "name": "Luau",
    "import": (() => import("./luau.js"))
  },
  {
    "id": "make",
    "name": "Makefile",
    "aliases": [
      "makefile"
    ],
    "import": (() => import("./make.js"))
  },
  {
    "id": "markdown",
    "name": "Markdown",
    "aliases": [
      "md"
    ],
    "import": (() => import("./markdown.js"))
  },
  {
    "id": "marko",
    "name": "Marko",
    "import": (() => import("./marko.js"))
  },
  {
    "id": "matlab",
    "name": "MATLAB",
    "import": (() => import("./matlab.js"))
  },
  {
    "id": "mdc",
    "name": "MDC",
    "import": (() => import("./mdc.js"))
  },
  {
    "id": "mdx",
    "name": "MDX",
    "import": (() => import("./mdx.js"))
  },
  {
    "id": "mermaid",
    "name": "Mermaid",
    "aliases": [
      "mmd"
    ],
    "import": (() => import("./mermaid.js"))
  },
  {
    "id": "mipsasm",
    "name": "MIPS Assembly",
    "aliases": [
      "mips"
    ],
    "import": (() => import("./mipsasm.js"))
  },
  {
    "id": "mojo",
    "name": "Mojo",
    "import": (() => import("./mojo.js"))
  },
  {
    "id": "moonbit",
    "name": "MoonBit",
    "aliases": [
      "mbt",
      "mbti"
    ],
    "import": (() => import("./moonbit.js"))
  },
  {
    "id": "move",
    "name": "Move",
    "import": (() => import("./move.js"))
  },
  {
    "id": "narrat",
    "name": "Narrat Language",
    "aliases": [
      "nar"
    ],
    "import": (() => import("./narrat.js"))
  },
  {
    "id": "nextflow",
    "name": "Nextflow",
    "aliases": [
      "nf"
    ],
    "import": (() => import("./nextflow.js"))
  },
  {
    "id": "nginx",
    "name": "Nginx",
    "import": (() => import("./nginx.js"))
  },
  {
    "id": "nim",
    "name": "Nim",
    "import": (() => import("./nim.js"))
  },
  {
    "id": "nix",
    "name": "Nix",
    "import": (() => import("./nix.js"))
  },
  {
    "id": "nushell",
    "name": "nushell",
    "aliases": [
      "nu"
    ],
    "import": (() => import("./nushell.js"))
  },
  {
    "id": "objective-c",
    "name": "Objective-C",
    "aliases": [
      "objc"
    ],
    "import": (() => import("./objective-c.js"))
  },
  {
    "id": "objective-cpp",
    "name": "Objective-C++",
    "import": (() => import("./objective-cpp.js"))
  },
  {
    "id": "ocaml",
    "name": "OCaml",
    "import": (() => import("./ocaml.js"))
  },
  {
    "id": "odin",
    "name": "Odin",
    "import": (() => import("./odin.js"))
  },
  {
    "id": "openscad",
    "name": "OpenSCAD",
    "aliases": [
      "scad"
    ],
    "import": (() => import("./openscad.js"))
  },
  {
    "id": "pascal",
    "name": "Pascal",
    "import": (() => import("./pascal.js"))
  },
  {
    "id": "perl",
    "name": "Perl",
    "import": (() => import("./perl.js"))
  },
  {
    "id": "php",
    "name": "PHP",
    "import": (() => import("./php.js"))
  },
  {
    "id": "pkl",
    "name": "Pkl",
    "import": (() => import("./pkl.js"))
  },
  {
    "id": "plsql",
    "name": "PL/SQL",
    "import": (() => import("./plsql.js"))
  },
  {
    "id": "po",
    "name": "Gettext PO",
    "aliases": [
      "pot",
      "potx"
    ],
    "import": (() => import("./po.js"))
  },
  {
    "id": "polar",
    "name": "Polar",
    "import": (() => import("./polar.js"))
  },
  {
    "id": "postcss",
    "name": "PostCSS",
    "import": (() => import("./postcss.js"))
  },
  {
    "id": "powerquery",
    "name": "PowerQuery",
    "import": (() => import("./powerquery.js"))
  },
  {
    "id": "powershell",
    "name": "PowerShell",
    "aliases": [
      "ps",
      "ps1"
    ],
    "import": (() => import("./powershell.js"))
  },
  {
    "id": "prisma",
    "name": "Prisma",
    "import": (() => import("./prisma.js"))
  },
  {
    "id": "prolog",
    "name": "Prolog",
    "import": (() => import("./prolog.js"))
  },
  {
    "id": "proto",
    "name": "Protocol Buffer 3",
    "aliases": [
      "protobuf"
    ],
    "import": (() => import("./proto.js"))
  },
  {
    "id": "pug",
    "name": "Pug",
    "aliases": [
      "jade"
    ],
    "import": (() => import("./pug.js"))
  },
  {
    "id": "puppet",
    "name": "Puppet",
    "import": (() => import("./puppet.js"))
  },
  {
    "id": "purescript",
    "name": "PureScript",
    "import": (() => import("./purescript.js"))
  },
  {
    "id": "python",
    "name": "Python",
    "aliases": [
      "py"
    ],
    "import": (() => import("./python.js"))
  },
  {
    "id": "qml",
    "name": "QML",
    "import": (() => import("./qml.js"))
  },
  {
    "id": "qmldir",
    "name": "QML Directory",
    "import": (() => import("./qmldir.js"))
  },
  {
    "id": "qss",
    "name": "Qt Style Sheets",
    "import": (() => import("./qss.js"))
  },
  {
    "id": "r",
    "name": "R",
    "import": (() => import("./r.js"))
  },
  {
    "id": "racket",
    "name": "Racket",
    "import": (() => import("./racket.js"))
  },
  {
    "id": "raku",
    "name": "Raku",
    "aliases": [
      "perl6"
    ],
    "import": (() => import("./raku.js"))
  },
  {
    "id": "razor",
    "name": "ASP.NET Razor",
    "import": (() => import("./razor.js"))
  },
  {
    "id": "reg",
    "name": "Windows Registry Script",
    "import": (() => import("./reg.js"))
  },
  {
    "id": "regexp",
    "name": "RegExp",
    "aliases": [
      "regex"
    ],
    "import": (() => import("./regexp.js"))
  },
  {
    "id": "rel",
    "name": "Rel",
    "import": (() => import("./rel.js"))
  },
  {
    "id": "riscv",
    "name": "RISC-V",
    "import": (() => import("./riscv.js"))
  },
  {
    "id": "ron",
    "name": "RON",
    "import": (() => import("./ron.js"))
  },
  {
    "id": "rosmsg",
    "name": "ROS Interface",
    "import": (() => import("./rosmsg.js"))
  },
  {
    "id": "rst",
    "name": "reStructuredText",
    "import": (() => import("./rst.js"))
  },
  {
    "id": "ruby",
    "name": "Ruby",
    "aliases": [
      "rb"
    ],
    "import": (() => import("./ruby.js"))
  },
  {
    "id": "rust",
    "name": "Rust",
    "aliases": [
      "rs"
    ],
    "import": (() => import("./rust.js"))
  },
  {
    "id": "sas",
    "name": "SAS",
    "import": (() => import("./sas.js"))
  },
  {
    "id": "sass",
    "name": "Sass",
    "import": (() => import("./sass.js"))
  },
  {
    "id": "scala",
    "name": "Scala",
    "import": (() => import("./scala.js"))
  },
  {
    "id": "scheme",
    "name": "Scheme",
    "import": (() => import("./scheme.js"))
  },
  {
    "id": "scss",
    "name": "SCSS",
    "import": (() => import("./scss.js"))
  },
  {
    "id": "sdbl",
    "name": "1C (Query)",
    "aliases": [
      "1c-query"
    ],
    "import": (() => import("./sdbl.js"))
  },
  {
    "id": "shaderlab",
    "name": "ShaderLab",
    "aliases": [
      "shader"
    ],
    "import": (() => import("./shaderlab.js"))
  },
  {
    "id": "shellscript",
    "name": "Shell",
    "aliases": [
      "bash",
      "sh",
      "shell",
      "zsh"
    ],
    "import": (() => import("./shellscript.js"))
  },
  {
    "id": "shellsession",
    "name": "Shell Session",
    "aliases": [
      "console"
    ],
    "import": (() => import("./shellsession.js"))
  },
  {
    "id": "smalltalk",
    "name": "Smalltalk",
    "import": (() => import("./smalltalk.js"))
  },
  {
    "id": "solidity",
    "name": "Solidity",
    "import": (() => import("./solidity.js"))
  },
  {
    "id": "soy",
    "name": "Closure Templates",
    "aliases": [
      "closure-templates"
    ],
    "import": (() => import("./soy.js"))
  },
  {
    "id": "sparql",
    "name": "SPARQL",
    "import": (() => import("./sparql.js"))
  },
  {
    "id": "splunk",
    "name": "Splunk Query Language",
    "aliases": [
      "spl"
    ],
    "import": (() => import("./splunk.js"))
  },
  {
    "id": "sql",
    "name": "SQL",
    "import": (() => import("./sql.js"))
  },
  {
    "id": "ssh-config",
    "name": "SSH Config",
    "import": (() => import("./ssh-config.js"))
  },
  {
    "id": "stata",
    "name": "Stata",
    "import": (() => import("./stata.js"))
  },
  {
    "id": "stylus",
    "name": "Stylus",
    "aliases": [
      "styl"
    ],
    "import": (() => import("./stylus.js"))
  },
  {
    "id": "surrealql",
    "name": "SurrealQL",
    "aliases": [
      "surql"
    ],
    "import": (() => import("./surrealql.js"))
  },
  {
    "id": "svelte",
    "name": "Svelte",
    "import": (() => import("./svelte.js"))
  },
  {
    "id": "swift",
    "name": "Swift",
    "import": (() => import("./swift.js"))
  },
  {
    "id": "system-verilog",
    "name": "SystemVerilog",
    "import": (() => import("./system-verilog.js"))
  },
  {
    "id": "systemd",
    "name": "Systemd Units",
    "import": (() => import("./systemd.js"))
  },
  {
    "id": "talonscript",
    "name": "TalonScript",
    "aliases": [
      "talon"
    ],
    "import": (() => import("./talonscript.js"))
  },
  {
    "id": "tasl",
    "name": "Tasl",
    "import": (() => import("./tasl.js"))
  },
  {
    "id": "tcl",
    "name": "Tcl",
    "import": (() => import("./tcl.js"))
  },
  {
    "id": "templ",
    "name": "Templ",
    "import": (() => import("./templ.js"))
  },
  {
    "id": "terraform",
    "name": "Terraform",
    "aliases": [
      "tf",
      "tfvars"
    ],
    "import": (() => import("./terraform.js"))
  },
  {
    "id": "tex",
    "name": "TeX",
    "import": (() => import("./tex.js"))
  },
  {
    "id": "toml",
    "name": "TOML",
    "import": (() => import("./toml.js"))
  },
  {
    "id": "ts-tags",
    "name": "TypeScript with Tags",
    "aliases": [
      "lit"
    ],
    "import": (() => import("./ts-tags.js"))
  },
  {
    "id": "tsv",
    "name": "TSV",
    "import": (() => import("./tsv.js"))
  },
  {
    "id": "tsx",
    "name": "TSX",
    "import": (() => import("./tsx.js"))
  },
  {
    "id": "turtle",
    "name": "Turtle",
    "import": (() => import("./turtle.js"))
  },
  {
    "id": "twig",
    "name": "Twig",
    "import": (() => import("./twig.js"))
  },
  {
    "id": "typescript",
    "name": "TypeScript",
    "aliases": [
      "ts",
      "cts",
      "mts"
    ],
    "import": (() => import("./typescript.js"))
  },
  {
    "id": "typespec",
    "name": "TypeSpec",
    "aliases": [
      "tsp"
    ],
    "import": (() => import("./typespec.js"))
  },
  {
    "id": "typst",
    "name": "Typst",
    "aliases": [
      "typ"
    ],
    "import": (() => import("./typst.js"))
  },
  {
    "id": "v",
    "name": "V",
    "import": (() => import("./v.js"))
  },
  {
    "id": "vala",
    "name": "Vala",
    "import": (() => import("./vala.js"))
  },
  {
    "id": "vb",
    "name": "Visual Basic",
    "aliases": [
      "cmd"
    ],
    "import": (() => import("./vb.js"))
  },
  {
    "id": "verilog",
    "name": "Verilog",
    "import": (() => import("./verilog.js"))
  },
  {
    "id": "vhdl",
    "name": "VHDL",
    "import": (() => import("./vhdl.js"))
  },
  {
    "id": "viml",
    "name": "Vim Script",
    "aliases": [
      "vim",
      "vimscript"
    ],
    "import": (() => import("./viml.js"))
  },
  {
    "id": "vue",
    "name": "Vue",
    "import": (() => import("./vue.js"))
  },
  {
    "id": "vue-html",
    "name": "Vue HTML",
    "import": (() => import("./vue-html.js"))
  },
  {
    "id": "vue-vine",
    "name": "Vue Vine",
    "import": (() => import("./vue-vine.js"))
  },
  {
    "id": "vyper",
    "name": "Vyper",
    "aliases": [
      "vy"
    ],
    "import": (() => import("./vyper.js"))
  },
  {
    "id": "wasm",
    "name": "WebAssembly",
    "import": (() => import("./wasm2.js"))
  },
  {
    "id": "wenyan",
    "name": "Wenyan",
    "aliases": [
      "文言"
    ],
    "import": (() => import("./wenyan.js"))
  },
  {
    "id": "wgsl",
    "name": "WGSL",
    "import": (() => import("./wgsl.js"))
  },
  {
    "id": "wikitext",
    "name": "Wikitext",
    "aliases": [
      "mediawiki",
      "wiki"
    ],
    "import": (() => import("./wikitext.js"))
  },
  {
    "id": "wit",
    "name": "WebAssembly Interface Types",
    "import": (() => import("./wit.js"))
  },
  {
    "id": "wolfram",
    "name": "Wolfram",
    "aliases": [
      "wl"
    ],
    "import": (() => import("./wolfram.js"))
  },
  {
    "id": "xml",
    "name": "XML",
    "import": (() => import("./xml.js"))
  },
  {
    "id": "xsl",
    "name": "XSL",
    "import": (() => import("./xsl.js"))
  },
  {
    "id": "yaml",
    "name": "YAML",
    "aliases": [
      "yml"
    ],
    "import": (() => import("./yaml.js"))
  },
  {
    "id": "zenscript",
    "name": "ZenScript",
    "import": (() => import("./zenscript.js"))
  },
  {
    "id": "zig",
    "name": "Zig",
    "import": (() => import("./zig.js"))
  }
];
const bundledLanguagesBase = Object.fromEntries(bundledLanguagesInfo.map((i) => [i.id, i.import]));
const bundledLanguagesAlias = Object.fromEntries(bundledLanguagesInfo.flatMap((i) => i.aliases?.map((a) => [a, i.import]) || []));
const bundledLanguages = {
  ...bundledLanguagesBase,
  ...bundledLanguagesAlias
};
const bundledThemesInfo = [
  {
    "id": "andromeeda",
    "displayName": "Andromeeda",
    "type": "dark",
    "import": (() => import("./andromeeda.js"))
  },
  {
    "id": "aurora-x",
    "displayName": "Aurora X",
    "type": "dark",
    "import": (() => import("./aurora-x.js"))
  },
  {
    "id": "ayu-dark",
    "displayName": "Ayu Dark",
    "type": "dark",
    "import": (() => import("./ayu-dark.js"))
  },
  {
    "id": "ayu-light",
    "displayName": "Ayu Light",
    "type": "light",
    "import": (() => import("./ayu-light.js"))
  },
  {
    "id": "ayu-mirage",
    "displayName": "Ayu Mirage",
    "type": "dark",
    "import": (() => import("./ayu-mirage.js"))
  },
  {
    "id": "catppuccin-frappe",
    "displayName": "Catppuccin Frappé",
    "type": "dark",
    "import": (() => import("./catppuccin-frappe.js"))
  },
  {
    "id": "catppuccin-latte",
    "displayName": "Catppuccin Latte",
    "type": "light",
    "import": (() => import("./catppuccin-latte.js"))
  },
  {
    "id": "catppuccin-macchiato",
    "displayName": "Catppuccin Macchiato",
    "type": "dark",
    "import": (() => import("./catppuccin-macchiato.js"))
  },
  {
    "id": "catppuccin-mocha",
    "displayName": "Catppuccin Mocha",
    "type": "dark",
    "import": (() => import("./catppuccin-mocha.js"))
  },
  {
    "id": "dark-plus",
    "displayName": "Dark Plus",
    "type": "dark",
    "import": (() => import("./dark-plus.js"))
  },
  {
    "id": "dracula",
    "displayName": "Dracula Theme",
    "type": "dark",
    "import": (() => import("./dracula.js"))
  },
  {
    "id": "dracula-soft",
    "displayName": "Dracula Theme Soft",
    "type": "dark",
    "import": (() => import("./dracula-soft.js"))
  },
  {
    "id": "everforest-dark",
    "displayName": "Everforest Dark",
    "type": "dark",
    "import": (() => import("./everforest-dark.js"))
  },
  {
    "id": "everforest-light",
    "displayName": "Everforest Light",
    "type": "light",
    "import": (() => import("./everforest-light.js"))
  },
  {
    "id": "github-dark",
    "displayName": "GitHub Dark",
    "type": "dark",
    "import": (() => import("./github-dark.js"))
  },
  {
    "id": "github-dark-default",
    "displayName": "GitHub Dark Default",
    "type": "dark",
    "import": (() => import("./github-dark-default.js"))
  },
  {
    "id": "github-dark-dimmed",
    "displayName": "GitHub Dark Dimmed",
    "type": "dark",
    "import": (() => import("./github-dark-dimmed.js"))
  },
  {
    "id": "github-dark-high-contrast",
    "displayName": "GitHub Dark High Contrast",
    "type": "dark",
    "import": (() => import("./github-dark-high-contrast.js"))
  },
  {
    "id": "github-light",
    "displayName": "GitHub Light",
    "type": "light",
    "import": (() => import("./github-light.js"))
  },
  {
    "id": "github-light-default",
    "displayName": "GitHub Light Default",
    "type": "light",
    "import": (() => import("./github-light-default.js"))
  },
  {
    "id": "github-light-high-contrast",
    "displayName": "GitHub Light High Contrast",
    "type": "light",
    "import": (() => import("./github-light-high-contrast.js"))
  },
  {
    "id": "gruvbox-dark-hard",
    "displayName": "Gruvbox Dark Hard",
    "type": "dark",
    "import": (() => import("./gruvbox-dark-hard.js"))
  },
  {
    "id": "gruvbox-dark-medium",
    "displayName": "Gruvbox Dark Medium",
    "type": "dark",
    "import": (() => import("./gruvbox-dark-medium.js"))
  },
  {
    "id": "gruvbox-dark-soft",
    "displayName": "Gruvbox Dark Soft",
    "type": "dark",
    "import": (() => import("./gruvbox-dark-soft.js"))
  },
  {
    "id": "gruvbox-light-hard",
    "displayName": "Gruvbox Light Hard",
    "type": "light",
    "import": (() => import("./gruvbox-light-hard.js"))
  },
  {
    "id": "gruvbox-light-medium",
    "displayName": "Gruvbox Light Medium",
    "type": "light",
    "import": (() => import("./gruvbox-light-medium.js"))
  },
  {
    "id": "gruvbox-light-soft",
    "displayName": "Gruvbox Light Soft",
    "type": "light",
    "import": (() => import("./gruvbox-light-soft.js"))
  },
  {
    "id": "horizon",
    "displayName": "Horizon",
    "type": "dark",
    "import": (() => import("./horizon.js"))
  },
  {
    "id": "houston",
    "displayName": "Houston",
    "type": "dark",
    "import": (() => import("./houston.js"))
  },
  {
    "id": "kanagawa-dragon",
    "displayName": "Kanagawa Dragon",
    "type": "dark",
    "import": (() => import("./kanagawa-dragon.js"))
  },
  {
    "id": "kanagawa-lotus",
    "displayName": "Kanagawa Lotus",
    "type": "light",
    "import": (() => import("./kanagawa-lotus.js"))
  },
  {
    "id": "kanagawa-wave",
    "displayName": "Kanagawa Wave",
    "type": "dark",
    "import": (() => import("./kanagawa-wave.js"))
  },
  {
    "id": "laserwave",
    "displayName": "LaserWave",
    "type": "dark",
    "import": (() => import("./laserwave.js"))
  },
  {
    "id": "light-plus",
    "displayName": "Light Plus",
    "type": "light",
    "import": (() => import("./light-plus.js"))
  },
  {
    "id": "material-theme",
    "displayName": "Material Theme",
    "type": "dark",
    "import": (() => import("./material-theme.js"))
  },
  {
    "id": "material-theme-darker",
    "displayName": "Material Theme Darker",
    "type": "dark",
    "import": (() => import("./material-theme-darker.js"))
  },
  {
    "id": "material-theme-lighter",
    "displayName": "Material Theme Lighter",
    "type": "light",
    "import": (() => import("./material-theme-lighter.js"))
  },
  {
    "id": "material-theme-ocean",
    "displayName": "Material Theme Ocean",
    "type": "dark",
    "import": (() => import("./material-theme-ocean.js"))
  },
  {
    "id": "material-theme-palenight",
    "displayName": "Material Theme Palenight",
    "type": "dark",
    "import": (() => import("./material-theme-palenight.js"))
  },
  {
    "id": "min-dark",
    "displayName": "Min Dark",
    "type": "dark",
    "import": (() => import("./min-dark.js"))
  },
  {
    "id": "min-light",
    "displayName": "Min Light",
    "type": "light",
    "import": (() => import("./min-light.js"))
  },
  {
    "id": "monokai",
    "displayName": "Monokai",
    "type": "dark",
    "import": (() => import("./monokai.js"))
  },
  {
    "id": "night-owl",
    "displayName": "Night Owl",
    "type": "dark",
    "import": (() => import("./night-owl.js"))
  },
  {
    "id": "night-owl-light",
    "displayName": "Night Owl Light",
    "type": "light",
    "import": (() => import("./night-owl-light.js"))
  },
  {
    "id": "nord",
    "displayName": "Nord",
    "type": "dark",
    "import": (() => import("./nord.js"))
  },
  {
    "id": "one-dark-pro",
    "displayName": "One Dark Pro",
    "type": "dark",
    "import": (() => import("./one-dark-pro.js"))
  },
  {
    "id": "one-light",
    "displayName": "One Light",
    "type": "light",
    "import": (() => import("./one-light.js"))
  },
  {
    "id": "plastic",
    "displayName": "Plastic",
    "type": "dark",
    "import": (() => import("./plastic.js"))
  },
  {
    "id": "poimandres",
    "displayName": "Poimandres",
    "type": "dark",
    "import": (() => import("./poimandres.js"))
  },
  {
    "id": "red",
    "displayName": "Red",
    "type": "dark",
    "import": (() => import("./red.js"))
  },
  {
    "id": "rose-pine",
    "displayName": "Rosé Pine",
    "type": "dark",
    "import": (() => import("./rose-pine.js"))
  },
  {
    "id": "rose-pine-dawn",
    "displayName": "Rosé Pine Dawn",
    "type": "light",
    "import": (() => import("./rose-pine-dawn.js"))
  },
  {
    "id": "rose-pine-moon",
    "displayName": "Rosé Pine Moon",
    "type": "dark",
    "import": (() => import("./rose-pine-moon.js"))
  },
  {
    "id": "slack-dark",
    "displayName": "Slack Dark",
    "type": "dark",
    "import": (() => import("./slack-dark.js"))
  },
  {
    "id": "slack-ochin",
    "displayName": "Slack Ochin",
    "type": "light",
    "import": (() => import("./slack-ochin.js"))
  },
  {
    "id": "snazzy-light",
    "displayName": "Snazzy Light",
    "type": "light",
    "import": (() => import("./snazzy-light.js"))
  },
  {
    "id": "solarized-dark",
    "displayName": "Solarized Dark",
    "type": "dark",
    "import": (() => import("./solarized-dark.js"))
  },
  {
    "id": "solarized-light",
    "displayName": "Solarized Light",
    "type": "light",
    "import": (() => import("./solarized-light.js"))
  },
  {
    "id": "synthwave-84",
    "displayName": "Synthwave '84",
    "type": "dark",
    "import": (() => import("./synthwave-84.js"))
  },
  {
    "id": "tokyo-night",
    "displayName": "Tokyo Night",
    "type": "dark",
    "import": (() => import("./tokyo-night.js"))
  },
  {
    "id": "vesper",
    "displayName": "Vesper",
    "type": "dark",
    "import": (() => import("./vesper.js"))
  },
  {
    "id": "vitesse-black",
    "displayName": "Vitesse Black",
    "type": "dark",
    "import": (() => import("./vitesse-black.js"))
  },
  {
    "id": "vitesse-dark",
    "displayName": "Vitesse Dark",
    "type": "dark",
    "import": (() => import("./vitesse-dark.js"))
  },
  {
    "id": "vitesse-light",
    "displayName": "Vitesse Light",
    "type": "light",
    "import": (() => import("./vitesse-light.js"))
  }
];
const bundledThemes = Object.fromEntries(bundledThemesInfo.map((i) => [i.id, i.import]));
class ShikiError extends Error {
  constructor(message) {
    super(message);
    this.name = "ShikiError";
  }
}
function getHeapMax() {
  return 2147483648;
}
function _emscripten_get_now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
const alignUp = (x, multiple) => x + (multiple - x % multiple) % multiple;
async function main(init) {
  let wasmMemory;
  let buffer;
  const binding = {};
  function updateGlobalBufferAndViews(buf) {
    buffer = buf;
    binding.HEAPU8 = new Uint8Array(buf);
    binding.HEAPU32 = new Uint32Array(buf);
  }
  function _emscripten_memcpy_big(dest, src, num) {
    binding.HEAPU8.copyWithin(dest, src, src + num);
  }
  function emscripten_realloc_buffer(size) {
    try {
      wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
      updateGlobalBufferAndViews(wasmMemory.buffer);
      return 1;
    } catch {
    }
  }
  function _emscripten_resize_heap(requestedSize) {
    const oldSize = binding.HEAPU8.length;
    requestedSize = requestedSize >>> 0;
    const maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize)
      return false;
    for (let cutDown = 1; cutDown <= 4; cutDown *= 2) {
      let overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
      overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
      const newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
      const replacement = emscripten_realloc_buffer(newSize);
      if (replacement)
        return true;
    }
    return false;
  }
  const UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : void 0;
  function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead = 1024) {
    const endIdx = idx + maxBytesToRead;
    let endPtr = idx;
    while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
      return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
    }
    let str2 = "";
    while (idx < endPtr) {
      let u0 = heapOrArray[idx++];
      if (!(u0 & 128)) {
        str2 += String.fromCharCode(u0);
        continue;
      }
      const u1 = heapOrArray[idx++] & 63;
      if ((u0 & 224) === 192) {
        str2 += String.fromCharCode((u0 & 31) << 6 | u1);
        continue;
      }
      const u2 = heapOrArray[idx++] & 63;
      if ((u0 & 240) === 224) {
        u0 = (u0 & 15) << 12 | u1 << 6 | u2;
      } else {
        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
      }
      if (u0 < 65536) {
        str2 += String.fromCharCode(u0);
      } else {
        const ch = u0 - 65536;
        str2 += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      }
    }
    return str2;
  }
  function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(binding.HEAPU8, ptr, maxBytesToRead) : "";
  }
  const asmLibraryArg = {
    emscripten_get_now: _emscripten_get_now,
    emscripten_memcpy_big: _emscripten_memcpy_big,
    emscripten_resize_heap: _emscripten_resize_heap,
    fd_write: () => 0
  };
  async function createWasm() {
    const info = {
      env: asmLibraryArg,
      wasi_snapshot_preview1: asmLibraryArg
    };
    const exports$12 = await init(info);
    wasmMemory = exports$12.memory;
    updateGlobalBufferAndViews(wasmMemory.buffer);
    Object.assign(binding, exports$12);
    binding.UTF8ToString = UTF8ToString;
  }
  await createWasm();
  return binding;
}
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
var __publicField = (obj, key2, value) => __defNormalProp(obj, typeof key2 !== "symbol" ? key2 + "" : key2, value);
let onigBinding = null;
function throwLastOnigError(onigBinding2) {
  throw new ShikiError(onigBinding2.UTF8ToString(onigBinding2.getLastOnigError()));
}
class UtfString {
  constructor(str2) {
    __publicField(this, "utf16Length");
    __publicField(this, "utf8Length");
    __publicField(this, "utf16Value");
    __publicField(this, "utf8Value");
    __publicField(this, "utf16OffsetToUtf8");
    __publicField(this, "utf8OffsetToUtf16");
    const utf16Length = str2.length;
    const utf8Length = UtfString._utf8ByteLength(str2);
    const computeIndicesMapping = utf8Length !== utf16Length;
    const utf16OffsetToUtf8 = computeIndicesMapping ? new Uint32Array(utf16Length + 1) : null;
    if (computeIndicesMapping)
      utf16OffsetToUtf8[utf16Length] = utf8Length;
    const utf8OffsetToUtf16 = computeIndicesMapping ? new Uint32Array(utf8Length + 1) : null;
    if (computeIndicesMapping)
      utf8OffsetToUtf16[utf8Length] = utf16Length;
    const utf8Value = new Uint8Array(utf8Length);
    let i8 = 0;
    for (let i16 = 0; i16 < utf16Length; i16++) {
      const charCode = str2.charCodeAt(i16);
      let codePoint = charCode;
      let wasSurrogatePair = false;
      if (charCode >= 55296 && charCode <= 56319) {
        if (i16 + 1 < utf16Length) {
          const nextCharCode = str2.charCodeAt(i16 + 1);
          if (nextCharCode >= 56320 && nextCharCode <= 57343) {
            codePoint = (charCode - 55296 << 10) + 65536 | nextCharCode - 56320;
            wasSurrogatePair = true;
          }
        }
      }
      if (computeIndicesMapping) {
        utf16OffsetToUtf8[i16] = i8;
        if (wasSurrogatePair)
          utf16OffsetToUtf8[i16 + 1] = i8;
        if (codePoint <= 127) {
          utf8OffsetToUtf16[i8 + 0] = i16;
        } else if (codePoint <= 2047) {
          utf8OffsetToUtf16[i8 + 0] = i16;
          utf8OffsetToUtf16[i8 + 1] = i16;
        } else if (codePoint <= 65535) {
          utf8OffsetToUtf16[i8 + 0] = i16;
          utf8OffsetToUtf16[i8 + 1] = i16;
          utf8OffsetToUtf16[i8 + 2] = i16;
        } else {
          utf8OffsetToUtf16[i8 + 0] = i16;
          utf8OffsetToUtf16[i8 + 1] = i16;
          utf8OffsetToUtf16[i8 + 2] = i16;
          utf8OffsetToUtf16[i8 + 3] = i16;
        }
      }
      if (codePoint <= 127) {
        utf8Value[i8++] = codePoint;
      } else if (codePoint <= 2047) {
        utf8Value[i8++] = 192 | (codePoint & 1984) >>> 6;
        utf8Value[i8++] = 128 | (codePoint & 63) >>> 0;
      } else if (codePoint <= 65535) {
        utf8Value[i8++] = 224 | (codePoint & 61440) >>> 12;
        utf8Value[i8++] = 128 | (codePoint & 4032) >>> 6;
        utf8Value[i8++] = 128 | (codePoint & 63) >>> 0;
      } else {
        utf8Value[i8++] = 240 | (codePoint & 1835008) >>> 18;
        utf8Value[i8++] = 128 | (codePoint & 258048) >>> 12;
        utf8Value[i8++] = 128 | (codePoint & 4032) >>> 6;
        utf8Value[i8++] = 128 | (codePoint & 63) >>> 0;
      }
      if (wasSurrogatePair)
        i16++;
    }
    this.utf16Length = utf16Length;
    this.utf8Length = utf8Length;
    this.utf16Value = str2;
    this.utf8Value = utf8Value;
    this.utf16OffsetToUtf8 = utf16OffsetToUtf8;
    this.utf8OffsetToUtf16 = utf8OffsetToUtf16;
  }
  static _utf8ByteLength(str2) {
    let result = 0;
    for (let i = 0, len = str2.length; i < len; i++) {
      const charCode = str2.charCodeAt(i);
      let codepoint = charCode;
      let wasSurrogatePair = false;
      if (charCode >= 55296 && charCode <= 56319) {
        if (i + 1 < len) {
          const nextCharCode = str2.charCodeAt(i + 1);
          if (nextCharCode >= 56320 && nextCharCode <= 57343) {
            codepoint = (charCode - 55296 << 10) + 65536 | nextCharCode - 56320;
            wasSurrogatePair = true;
          }
        }
      }
      if (codepoint <= 127)
        result += 1;
      else if (codepoint <= 2047)
        result += 2;
      else if (codepoint <= 65535)
        result += 3;
      else
        result += 4;
      if (wasSurrogatePair)
        i++;
    }
    return result;
  }
  createString(onigBinding2) {
    const result = onigBinding2.omalloc(this.utf8Length);
    onigBinding2.HEAPU8.set(this.utf8Value, result);
    return result;
  }
}
const _OnigString = class _OnigString2 {
  constructor(str2) {
    __publicField(this, "id", ++_OnigString2.LAST_ID);
    __publicField(this, "_onigBinding");
    __publicField(this, "content");
    __publicField(this, "utf16Length");
    __publicField(this, "utf8Length");
    __publicField(this, "utf16OffsetToUtf8");
    __publicField(this, "utf8OffsetToUtf16");
    __publicField(this, "ptr");
    if (!onigBinding)
      throw new ShikiError("Must invoke loadWasm first.");
    this._onigBinding = onigBinding;
    this.content = str2;
    const utfString = new UtfString(str2);
    this.utf16Length = utfString.utf16Length;
    this.utf8Length = utfString.utf8Length;
    this.utf16OffsetToUtf8 = utfString.utf16OffsetToUtf8;
    this.utf8OffsetToUtf16 = utfString.utf8OffsetToUtf16;
    if (this.utf8Length < 1e4 && !_OnigString2._sharedPtrInUse) {
      if (!_OnigString2._sharedPtr)
        _OnigString2._sharedPtr = onigBinding.omalloc(1e4);
      _OnigString2._sharedPtrInUse = true;
      onigBinding.HEAPU8.set(utfString.utf8Value, _OnigString2._sharedPtr);
      this.ptr = _OnigString2._sharedPtr;
    } else {
      this.ptr = utfString.createString(onigBinding);
    }
  }
  convertUtf8OffsetToUtf16(utf8Offset) {
    if (this.utf8OffsetToUtf16) {
      if (utf8Offset < 0)
        return 0;
      if (utf8Offset > this.utf8Length)
        return this.utf16Length;
      return this.utf8OffsetToUtf16[utf8Offset];
    }
    return utf8Offset;
  }
  convertUtf16OffsetToUtf8(utf16Offset) {
    if (this.utf16OffsetToUtf8) {
      if (utf16Offset < 0)
        return 0;
      if (utf16Offset > this.utf16Length)
        return this.utf8Length;
      return this.utf16OffsetToUtf8[utf16Offset];
    }
    return utf16Offset;
  }
  dispose() {
    if (this.ptr === _OnigString2._sharedPtr)
      _OnigString2._sharedPtrInUse = false;
    else
      this._onigBinding.ofree(this.ptr);
  }
};
__publicField(_OnigString, "LAST_ID", 0);
__publicField(_OnigString, "_sharedPtr", 0);
__publicField(_OnigString, "_sharedPtrInUse", false);
let OnigString = _OnigString;
class OnigScanner {
  constructor(patterns) {
    __publicField(this, "_onigBinding");
    __publicField(this, "_ptr");
    if (!onigBinding)
      throw new ShikiError("Must invoke loadWasm first.");
    const strPtrsArr = [];
    const strLenArr = [];
    for (let i = 0, len = patterns.length; i < len; i++) {
      const utfString = new UtfString(patterns[i]);
      strPtrsArr[i] = utfString.createString(onigBinding);
      strLenArr[i] = utfString.utf8Length;
    }
    const strPtrsPtr = onigBinding.omalloc(4 * patterns.length);
    onigBinding.HEAPU32.set(strPtrsArr, strPtrsPtr / 4);
    const strLenPtr = onigBinding.omalloc(4 * patterns.length);
    onigBinding.HEAPU32.set(strLenArr, strLenPtr / 4);
    const scannerPtr = onigBinding.createOnigScanner(strPtrsPtr, strLenPtr, patterns.length);
    for (let i = 0, len = patterns.length; i < len; i++)
      onigBinding.ofree(strPtrsArr[i]);
    onigBinding.ofree(strLenPtr);
    onigBinding.ofree(strPtrsPtr);
    if (scannerPtr === 0)
      throwLastOnigError(onigBinding);
    this._onigBinding = onigBinding;
    this._ptr = scannerPtr;
  }
  dispose() {
    this._onigBinding.freeOnigScanner(this._ptr);
  }
  findNextMatchSync(string, startPosition, arg) {
    let options2 = 0;
    if (typeof arg === "number") {
      options2 = arg;
    }
    if (typeof string === "string") {
      string = new OnigString(string);
      const result = this._findNextMatchSync(string, startPosition, false, options2);
      string.dispose();
      return result;
    }
    return this._findNextMatchSync(string, startPosition, false, options2);
  }
  _findNextMatchSync(string, startPosition, debugCall, options2) {
    const onigBinding2 = this._onigBinding;
    const resultPtr = onigBinding2.findNextOnigScannerMatch(this._ptr, string.id, string.ptr, string.utf8Length, string.convertUtf16OffsetToUtf8(startPosition), options2);
    if (resultPtr === 0) {
      return null;
    }
    const HEAPU32 = onigBinding2.HEAPU32;
    let offset = resultPtr / 4;
    const index = HEAPU32[offset++];
    const count = HEAPU32[offset++];
    const captureIndices = [];
    for (let i = 0; i < count; i++) {
      const beg = string.convertUtf8OffsetToUtf16(HEAPU32[offset++]);
      const end = string.convertUtf8OffsetToUtf16(HEAPU32[offset++]);
      captureIndices[i] = {
        start: beg,
        end,
        length: end - beg
      };
    }
    return {
      index,
      captureIndices
    };
  }
}
function isInstantiatorOptionsObject(dataOrOptions) {
  return typeof dataOrOptions.instantiator === "function";
}
function isInstantiatorModule(dataOrOptions) {
  return typeof dataOrOptions.default === "function";
}
function isDataOptionsObject(dataOrOptions) {
  return typeof dataOrOptions.data !== "undefined";
}
function isResponse(dataOrOptions) {
  return typeof Response !== "undefined" && dataOrOptions instanceof Response;
}
function isArrayBuffer(data) {
  return typeof ArrayBuffer !== "undefined" && (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) || typeof Buffer !== "undefined" && Buffer.isBuffer?.(data) || typeof SharedArrayBuffer !== "undefined" && data instanceof SharedArrayBuffer || typeof Uint32Array !== "undefined" && data instanceof Uint32Array;
}
let initPromise;
function loadWasm(options2) {
  if (initPromise)
    return initPromise;
  async function _load() {
    onigBinding = await main(async (info) => {
      let instance = options2;
      instance = await instance;
      if (typeof instance === "function")
        instance = await instance(info);
      if (typeof instance === "function")
        instance = await instance(info);
      if (isInstantiatorOptionsObject(instance)) {
        instance = await instance.instantiator(info);
      } else if (isInstantiatorModule(instance)) {
        instance = await instance.default(info);
      } else {
        if (isDataOptionsObject(instance))
          instance = instance.data;
        if (isResponse(instance)) {
          if (typeof WebAssembly.instantiateStreaming === "function")
            instance = await _makeResponseStreamingLoader(instance)(info);
          else
            instance = await _makeResponseNonStreamingLoader(instance)(info);
        } else if (isArrayBuffer(instance)) {
          instance = await _makeArrayBufferLoader(instance)(info);
        } else if (instance instanceof WebAssembly.Module) {
          instance = await _makeArrayBufferLoader(instance)(info);
        } else if ("default" in instance && instance.default instanceof WebAssembly.Module) {
          instance = await _makeArrayBufferLoader(instance.default)(info);
        }
      }
      if ("instance" in instance)
        instance = instance.instance;
      if ("exports" in instance)
        instance = instance.exports;
      return instance;
    });
  }
  initPromise = _load();
  return initPromise;
}
function _makeArrayBufferLoader(data) {
  return (importObject) => WebAssembly.instantiate(data, importObject);
}
function _makeResponseStreamingLoader(data) {
  return (importObject) => WebAssembly.instantiateStreaming(data, importObject);
}
function _makeResponseNonStreamingLoader(data) {
  return async (importObject) => {
    const arrayBuffer = await data.arrayBuffer();
    return WebAssembly.instantiate(arrayBuffer, importObject);
  };
}
async function createOnigurumaEngine(options2) {
  if (options2)
    await loadWasm(options2);
  return {
    createScanner(patterns) {
      return new OnigScanner(patterns.map((p2) => typeof p2 === "string" ? p2 : p2.source));
    },
    createString(s) {
      return new OnigString(s);
    }
  };
}
const createHighlighter = /* @__PURE__ */ createBundledHighlighter({
  langs: bundledLanguages,
  themes: bundledThemes,
  engine: () => createOnigurumaEngine(import("./wasm.js"))
});
let highlighterPromise;
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript",
        "typescript",
        "jsx",
        "tsx",
        "json",
        "bash",
        "shellscript",
        "html",
        "css",
        "markdown",
        "yaml",
        "sql",
        "python",
        "dotenv"
      ]
    });
  }
  return highlighterPromise;
}
function slugify(text2) {
  return text2.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}
const calloutIcons = {
  note: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  tip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14"/></svg>',
  important: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  caution: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
};
function renderCallout(type2, content) {
  const icon = calloutIcons[type2] || calloutIcons.note;
  const label = type2.charAt(0).toUpperCase() + type2.slice(1);
  return `<div class="fd-callout fd-callout-${type2}" role="note"><div class="fd-callout-indicator" role="none"></div><div class="fd-callout-icon">${icon}</div><div class="fd-callout-content"><p class="fd-callout-title">${label}</p><p>${content}</p></div></div>`;
}
function highlightCode(hl, code, lang) {
  if (lang === "sh" || lang === "shell")
    lang = "bash";
  if (lang === "env")
    lang = "dotenv";
  const supported = hl.getLoadedLanguages();
  if (!supported.includes(lang))
    lang = "text";
  const trimmedCode = code.replace(/\n$/, "");
  try {
    return {
      html: hl.codeToHtml(trimmedCode, {
        lang,
        themes: { light: "github-light", dark: "github-dark" }
      }),
      raw: trimmedCode
    };
  } catch {
    const escaped = trimmedCode.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return {
      html: `<pre class="shiki"><code>${escaped}</code></pre>`,
      raw: trimmedCode
    };
  }
}
function parseMeta(meta) {
  const lang = (meta.split(/\s/)[0] || "text").toLowerCase();
  const titleMatch = meta.match(/title=["']([^"']+)["']/);
  return { lang, title: titleMatch ? titleMatch[1] : null };
}
function wrapCodeWithCopy(html2, rawCode, title) {
  const escapedRaw = rawCode.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const copyBtn = `<button class="fd-copy-btn" data-code="${escapedRaw}" title="Copy code"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>`;
  if (title) {
    return `<div class="fd-codeblock fd-codeblock--titled"><div class="fd-codeblock-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg><span class="fd-codeblock-title-text">${title}</span>${copyBtn}</div><div class="fd-codeblock-content">${html2}</div></div>`;
  }
  return `<div class="fd-codeblock">${copyBtn}<div class="fd-codeblock-content">${html2}</div></div>`;
}
function dedentCode(raw2) {
  const lines = raw2.replace(/\n$/, "").split("\n");
  const indent = lines.reduce((min, l) => {
    if (!l.trim())
      return min;
    const spaces = l.match(/^(\s*)/)?.[1].length ?? 0;
    return Math.min(min, spaces);
  }, Infinity);
  if (indent > 0 && indent < Infinity) {
    return lines.map((l) => l.slice(indent)).join("\n");
  }
  return raw2;
}
async function renderMarkdown(content) {
  if (!content)
    return "";
  const hl = await getHighlighter();
  let result = content;
  const tabsBlocks = [];
  result = result.replace(/<Tabs\s+items=\{?\[([^\]]+)\]\}?>([\s\S]*?)<\/Tabs>/g, (_, itemsStr, body2) => {
    const items = itemsStr.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    const panels = [];
    const tabRegex = /<Tab\s+value=["']([^"']+)["']>([\s\S]*?)<\/Tab>/g;
    let tabMatch;
    while ((tabMatch = tabRegex.exec(body2)) !== null) {
      const tabValue = tabMatch[1];
      const tabContent = tabMatch[2].trim();
      const codeMatch = tabContent.match(/```([^\n]*)\n([\s\S]*?)```/);
      if (codeMatch) {
        const { lang, title } = parseMeta(codeMatch[1]);
        const dedented = dedentCode(codeMatch[2]);
        const { html: html2, raw: raw2 } = highlightCode(hl, dedented, lang);
        panels.push({ value: tabValue, html: wrapCodeWithCopy(html2, raw2, title) });
      } else {
        panels.push({ value: tabValue, html: `<p>${tabContent}</p>` });
      }
    }
    let tabsHtml = `<div class="fd-tabs" data-tabs>`;
    tabsHtml += `<div class="fd-tabs-list" role="tablist">`;
    for (let i = 0; i < items.length; i++) {
      tabsHtml += `<button role="tab" class="fd-tab-trigger${i === 0 ? " fd-tab-active" : ""}" data-tab-value="${items[i]}" aria-selected="${i === 0}">${items[i]}</button>`;
    }
    tabsHtml += `</div>`;
    for (let i = 0; i < panels.length; i++) {
      tabsHtml += `<div class="fd-tab-panel${i === 0 ? " fd-tab-panel-active" : ""}" data-tab-panel="${panels[i].value}" role="tabpanel">${panels[i].html}</div>`;
    }
    tabsHtml += `</div>`;
    const placeholder = `%%TABS_${tabsBlocks.length}%%`;
    tabsBlocks.push(tabsHtml);
    return placeholder;
  });
  const codeBlocks = [];
  result = result.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, meta, code) => {
    const { lang, title } = parseMeta(meta);
    const { html: html2, raw: raw2 } = highlightCode(hl, code, lang);
    const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`;
    codeBlocks.push(wrapCodeWithCopy(html2, raw2, title));
    return placeholder;
  });
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/^#### (.+)$/gm, (_, text2) => {
    return `<h4 id="${slugify(text2)}">${text2}</h4>`;
  });
  result = result.replace(/^### (.+)$/gm, (_, text2) => {
    return `<h3 id="${slugify(text2)}">${text2}</h3>`;
  });
  result = result.replace(/^## (.+)$/gm, (_, text2) => {
    return `<h2 id="${slugify(text2)}">${text2}</h2>`;
  });
  result = result.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  const calloutBlocks = [];
  result = result.replace(/(?:^>\s*.+\n?)+/gm, (block) => {
    const lines = block.split("\n").filter(Boolean);
    const inner = lines.map((l) => l.replace(/^>\s?/, "")).join("\n");
    const ghMatch = inner.match(/^\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\]\s*\n?([\s\S]*)/i);
    if (ghMatch) {
      const type2 = ghMatch[1].toLowerCase();
      const calloutContent = ghMatch[2].trim();
      const placeholder = `%%CALLOUT_${calloutBlocks.length}%%`;
      calloutBlocks.push(renderCallout(type2, calloutContent));
      return placeholder;
    }
    const boldMatch = inner.match(/^\*\*(Note|Warning|Tip|Important|Caution):\*\*\s*([\s\S]*)/i);
    if (boldMatch) {
      const type2 = boldMatch[1].toLowerCase();
      const calloutContent = boldMatch[2].trim();
      const placeholder = `%%CALLOUT_${calloutBlocks.length}%%`;
      calloutBlocks.push(renderCallout(type2, calloutContent));
      return placeholder;
    }
    return `<blockquote><p>${inner}</p></blockquote>`;
  });
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  result = result.replace(/^---$/gm, "<hr />");
  result = result.replace(/^\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/gm, (_, headerRow, bodyRows) => {
    const headers = headerRow.split("|").map((h) => h.trim()).filter(Boolean);
    const rows = bodyRows.trim().split("\n").map((row) => row.split("|").map((c) => c.trim()).filter(Boolean));
    const headerHtml = headers.map((h) => `<th>${h}</th>`).join("");
    const rowsHtml = rows.map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
    return `<div class="fd-table-wrapper"><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  });
  result = result.replace(/(?:^- .+\n?)+/gm, (block) => {
    const items = block.split("\n").filter((l) => l.startsWith("- ")).map((l) => `<li>${l.slice(2)}</li>`).join("");
    return `<ul>${items}</ul>`;
  });
  result = result.replace(/(?:^\d+\. .+\n?)+/gm, (block) => {
    const items = block.split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
    return `<ol>${items}</ol>`;
  });
  result = result.split("\n\n").map((block) => {
    block = block.trim();
    if (!block)
      return "";
    if (/^<(h[1-6]|pre|ul|ol|blockquote|hr|table|div)/.test(block))
      return block;
    if (/^%%(CODEBLOCK|CALLOUT|TABS)_\d+%%$/.test(block))
      return block;
    return `<p>${block}</p>`;
  }).join("\n");
  for (let i = 0; i < codeBlocks.length; i++) {
    result = result.replace(`%%CODEBLOCK_${i}%%`, codeBlocks[i]);
  }
  for (let i = 0; i < calloutBlocks.length; i++) {
    result = result.replace(`%%CALLOUT_${i}%%`, calloutBlocks[i]);
  }
  for (let i = 0; i < tabsBlocks.length; i++) {
    result = result.replace(`%%TABS_${i}%%`, tabsBlocks[i]);
  }
  return result;
}
const __vite_import_meta_env__ = {};
function resolveAIModelAndProvider(aiConfig, requestedModelId) {
  const raw2 = aiConfig.model;
  const modelList = typeof raw2 === "object" && raw2?.models || [];
  let modelId = requestedModelId;
  if (!modelId) {
    if (typeof raw2 === "string")
      modelId = raw2;
    else if (typeof raw2 === "object")
      modelId = raw2.defaultModel ?? raw2.models?.[0]?.id;
    if (!modelId)
      modelId = "gpt-4o-mini";
  }
  const entry = modelList.find((m) => m.id === modelId);
  const providerKey = entry?.provider;
  const providerConfig = providerKey && aiConfig.providers?.[providerKey];
  const baseUrl = (providerConfig && providerConfig.baseUrl || aiConfig.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = providerConfig && providerConfig.apiKey || aiConfig.apiKey || (typeof import.meta !== "undefined" ? __vite_import_meta_env__?.OPENAI_API_KEY : void 0) || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : void 0);
  return { model: modelId, baseUrl, apiKey };
}
function stripMarkdownText(content) {
  return content.replace(/^(import|export)\s.*$/gm, "").replace(/<[^>]+\/>/g, "").replace(/<\/?[A-Z][^>]*>/g, "").replace(/<\/?[a-z][^>]*>/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2").replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1").replace(/^>\s+/gm, "").replace(/^[-*_]{3,}\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
function navTreeFromMap(contentMap, dirPrefix, entry, ordering) {
  const dirs = [];
  for (const key2 of Object.keys(contentMap)) {
    if (!key2.startsWith(dirPrefix))
      continue;
    const rel = key2.slice(dirPrefix.length);
    const segments = rel.split("/");
    const fileName = segments.pop();
    const base = fileName.replace(/\.(md|mdx|svx)$/, "");
    if (base !== "page" && base !== "index" && base !== "+page")
      continue;
    const { data } = matter(contentMap[key2]);
    const dirParts = segments;
    const slug = dirParts.join("/");
    const url = slug ? `/${entry}/${slug}` : `/${entry}`;
    const fallbackTitle = dirParts.length > 0 ? dirParts[dirParts.length - 1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Documentation";
    dirs.push({
      parts: dirParts,
      title: data.title ?? fallbackTitle,
      url,
      icon: data.icon,
      order: typeof data.order === "number" ? data.order : Infinity
    });
  }
  dirs.sort((a, b) => {
    if (a.parts.length !== b.parts.length)
      return a.parts.length - b.parts.length;
    return a.parts.join("/").localeCompare(b.parts.join("/"));
  });
  const children = [];
  const rootInfo = dirs.find((d) => d.parts.length === 0);
  if (rootInfo) {
    children.push({
      type: "page",
      name: rootInfo.title,
      url: rootInfo.url,
      icon: rootInfo.icon
    });
  }
  function findSlugOrder(parentParts) {
    if (!Array.isArray(ordering))
      return void 0;
    let items = ordering;
    for (const part of parentParts) {
      const found = items.find((i) => i.slug === part);
      if (!found?.children)
        return void 0;
      items = found.children;
    }
    return items;
  }
  function buildLevel(parentParts) {
    const depth = parentParts.length;
    const directChildren = dirs.filter((d) => {
      if (d.parts.length !== depth + 1)
        return false;
      for (let i = 0; i < depth; i++) {
        if (d.parts[i] !== parentParts[i])
          return false;
      }
      return true;
    });
    const slugOrder = findSlugOrder(parentParts);
    if (slugOrder) {
      const slugMap = new Set(slugOrder.map((i) => i.slug));
      const ordered = [];
      for (const item of slugOrder) {
        const match = directChildren.find((d) => d.parts[depth] === item.slug);
        if (match)
          ordered.push(match);
      }
      for (const child of directChildren) {
        if (!slugMap.has(child.parts[depth]))
          ordered.push(child);
      }
      const nodes2 = [];
      for (const child of ordered) {
        const hasGrandChildren = dirs.some((d) => {
          if (d.parts.length <= child.parts.length)
            return false;
          return child.parts.every((p2, i) => d.parts[i] === p2);
        });
        if (hasGrandChildren) {
          nodes2.push({
            type: "folder",
            name: child.title,
            icon: child.icon,
            index: { type: "page", name: child.title, url: child.url, icon: child.icon },
            children: buildLevel(child.parts)
          });
        } else {
          nodes2.push({ type: "page", name: child.title, url: child.url, icon: child.icon });
        }
      }
      return nodes2;
    }
    if (ordering === "numeric") {
      directChildren.sort((a, b) => {
        if (a.order === b.order)
          return 0;
        return a.order - b.order;
      });
    }
    const nodes = [];
    for (const child of directChildren) {
      const hasGrandChildren = dirs.some((d) => {
        if (d.parts.length <= child.parts.length)
          return false;
        return child.parts.every((p2, i) => d.parts[i] === p2);
      });
      if (hasGrandChildren) {
        nodes.push({
          type: "folder",
          name: child.title,
          icon: child.icon,
          index: {
            type: "page",
            name: child.title,
            url: child.url,
            icon: child.icon
          },
          children: buildLevel(child.parts)
        });
      } else {
        nodes.push({
          type: "page",
          name: child.title,
          url: child.url,
          icon: child.icon
        });
      }
    }
    return nodes;
  }
  children.push(...buildLevel([]));
  return { name: "Docs", children };
}
function searchIndexFromMap(contentMap, dirPrefix, entry) {
  const pages = [];
  for (const [key2, raw2] of Object.entries(contentMap)) {
    if (!key2.startsWith(dirPrefix))
      continue;
    const rel = key2.slice(dirPrefix.length);
    const segments = rel.split("/");
    const fileName = segments.pop();
    const base = fileName.replace(/\.(md|mdx|svx)$/, "");
    const isIdx = base === "page" || base === "index" || base === "+page";
    const slug = isIdx ? segments.join("/") : [...segments, base].join("/");
    const url = slug ? `/${entry}/${slug}` : `/${entry}`;
    const { data, content } = matter(raw2);
    const title = data.title ?? base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    pages.push({
      slug,
      url,
      title,
      description: data.description,
      icon: data.icon,
      content: stripMarkdownText(content),
      rawContent: content
    });
  }
  return pages;
}
function findPageInMap(contentMap, dirPrefix, slug) {
  const isIndex = slug === "";
  const candidates = isIndex ? ["page.md", "page.mdx", "index.md"] : [
    `${slug}/page.md`,
    `${slug}/page.mdx`,
    `${slug}/index.md`,
    `${slug}/index.svx`,
    `${slug}.md`,
    `${slug}.svx`
  ];
  for (const candidate of candidates) {
    const key2 = `${dirPrefix}${candidate}`;
    if (key2 in contentMap) {
      return { raw: contentMap[key2], relPath: candidate };
    }
  }
  return null;
}
function createDocsServer(config2 = {}) {
  const entry = config2.entry ?? "docs";
  const githubRaw = config2.github;
  const github = typeof githubRaw === "string" ? { url: githubRaw } : githubRaw ?? null;
  const githubRepo = github?.url;
  const githubBranch = github?.branch ?? "main";
  const githubContentPath = github?.directory;
  const contentDir = path.resolve(config2.contentDir ?? entry);
  const preloaded = config2._preloadedContent;
  const contentDirRel = config2.contentDir ?? entry;
  const dirPrefix = `/${contentDirRel}/`;
  const ordering = config2.ordering;
  const aiConfig = config2.ai ?? {};
  if (config2.apiKey && !aiConfig.apiKey) {
    aiConfig.apiKey = config2.apiKey;
  }
  async function load2(event) {
    const tree = preloaded ? navTreeFromMap(preloaded, dirPrefix, entry, ordering) : loadDocsNavTree(contentDir, entry, ordering);
    const flatPages = flattenNavTree(tree);
    const urlPrefix = new RegExp(`^/${entry}/?`);
    const slug = event.url.pathname.replace(urlPrefix, "");
    const isIndex = slug === "";
    let raw2;
    let relPath;
    let lastModified;
    if (preloaded) {
      const result = findPageInMap(preloaded, dirPrefix, slug);
      if (!result) {
        const err = new Error(`Page not found: /${entry}/${slug}`);
        err.status = 404;
        throw err;
      }
      raw2 = result.raw;
      relPath = result.relPath;
      lastModified = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    } else {
      let filePath = null;
      relPath = "";
      if (isIndex) {
        for (const name of ["page.md", "page.mdx", "index.md"]) {
          const candidate = path.join(contentDir, name);
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            relPath = name;
            break;
          }
        }
      } else {
        const candidates = [
          path.join(contentDir, slug, "page.md"),
          path.join(contentDir, slug, "page.mdx"),
          path.join(contentDir, slug, "index.md"),
          path.join(contentDir, slug, "index.svx"),
          path.join(contentDir, `${slug}.md`),
          path.join(contentDir, `${slug}.svx`)
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            filePath = candidate;
            relPath = path.relative(contentDir, candidate);
            break;
          }
        }
      }
      if (!filePath) {
        const err = new Error(`Page not found: /${entry}/${slug}`);
        err.status = 404;
        throw err;
      }
      raw2 = fs.readFileSync(filePath, "utf-8");
      const stat = fs.statSync(filePath);
      lastModified = stat.mtime.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
    }
    const { data, content } = matter(raw2);
    const html2 = await renderMarkdown(content);
    const currentUrl = isIndex ? `/${entry}` : `/${entry}/${slug}`;
    const currentIndex = flatPages.findIndex((p2) => p2.url === currentUrl);
    const previousPage = currentIndex > 0 ? flatPages[currentIndex - 1] : null;
    const nextPage = currentIndex < flatPages.length - 1 ? flatPages[currentIndex + 1] : null;
    let editOnGithub;
    if (githubRepo && githubContentPath) {
      editOnGithub = `${githubRepo}/blob/${githubBranch}/${githubContentPath}/${relPath}`;
    }
    const fallbackTitle = isIndex ? "Documentation" : slug.split("/").pop()?.replace(/-/g, " ") ?? "Documentation";
    return {
      tree,
      flatPages,
      title: data.title ?? fallbackTitle,
      description: data.description,
      html: html2,
      ...isIndex ? {} : { slug },
      previousPage,
      nextPage,
      editOnGithub,
      lastModified
    };
  }
  let searchIndex = null;
  function getSearchIndex() {
    if (!searchIndex) {
      searchIndex = preloaded ? searchIndexFromMap(preloaded, dirPrefix, entry) : loadDocsContent(contentDir, entry);
    }
    return searchIndex;
  }
  function searchByQuery(query) {
    const index = getSearchIndex();
    return index.map((page) => {
      const titleMatch = page.title.toLowerCase().includes(query) ? 10 : 0;
      const words = query.split(/\s+/);
      const contentMatch = words.reduce((score, word) => {
        return score + (page.content.toLowerCase().includes(word) ? 1 : 0);
      }, 0);
      return { ...page, score: titleMatch + contentMatch };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  }
  const llmsSiteTitle = typeof config2.nav === "object" && typeof config2.nav?.title === "string" ? config2.nav.title : "Documentation";
  const llmsTxtConfig = config2.llmsTxt;
  const llmsBaseUrl = typeof llmsTxtConfig === "object" ? llmsTxtConfig.baseUrl ?? "" : "";
  const llmsTitle = typeof llmsTxtConfig === "object" ? llmsTxtConfig.siteTitle ?? llmsSiteTitle : llmsSiteTitle;
  const llmsDesc = typeof llmsTxtConfig === "object" ? llmsTxtConfig.siteDescription : void 0;
  function buildLlmsTxt(full) {
    const pages = getSearchIndex();
    let out = `# ${llmsTitle}

`;
    if (llmsDesc)
      out += `> ${llmsDesc}

`;
    if (full) {
      for (const page of pages) {
        out += `## ${page.title}

`;
        out += `URL: ${llmsBaseUrl}${page.url}

`;
        if (page.description)
          out += `${page.description}

`;
        out += `${page.content}

---

`;
      }
    } else {
      out += `## Pages

`;
      for (const page of pages) {
        out += `- [${page.title}](${llmsBaseUrl}${page.url})`;
        if (page.description)
          out += `: ${page.description}`;
        out += `
`;
      }
    }
    return out;
  }
  function GET2(event) {
    const format = event.url.searchParams.get("format");
    if (format === "llms" || format === "llms-full") {
      return new Response(buildLlmsTxt(format === "llms-full"), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }
    const query = event.url.searchParams.get("query")?.toLowerCase().trim();
    if (!query) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" }
      });
    }
    const results = searchByQuery(query).slice(0, 10).map(({ title, url, description }) => ({
      content: title,
      url,
      description
    }));
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const projectName = typeof config2.nav?.title === "string" ? config2.nav.title : null;
  const packageName = aiConfig.packageName;
  const docsUrl = aiConfig.docsUrl;
  function buildDefaultSystemPrompt() {
    const lines = [
      `You are a helpful documentation assistant${projectName ? ` for ${projectName}` : ""}.`,
      "Answer questions based on the provided documentation context.",
      "Be concise and accurate. If the answer is not in the context, say so honestly.",
      "Use markdown formatting for code examples and links."
    ];
    if (packageName) {
      lines.push(`When showing import examples, always use "${packageName}" as the package name.`);
    }
    if (docsUrl) {
      lines.push(`When linking to documentation pages, use "${docsUrl}" as the base URL (e.g. ${docsUrl}/docs/get-started).`);
    }
    return lines.join(" ");
  }
  const DEFAULT_SYSTEM_PROMPT = buildDefaultSystemPrompt();
  async function POST2(event) {
    if (!aiConfig.enabled) {
      return new Response(JSON.stringify({
        error: "AI is not enabled. Set `ai: { enabled: true }` in your docs config to enable it."
      }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    const resolvedKey = aiConfig.apiKey ?? (typeof import.meta !== "undefined" ? __vite_import_meta_env__?.OPENAI_API_KEY : void 0) ?? (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : void 0);
    if (!resolvedKey) {
      return new Response(JSON.stringify({
        error: "AI is enabled but no API key was found. Set `apiKey` in your docs config `ai` section or add OPENAI_API_KEY to your environment."
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    let body2;
    try {
      body2 = await event.request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body. Expected { messages: [...] }" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const messages = body2.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required and must not be empty." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      return new Response(JSON.stringify({ error: "At least one user message is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const maxResults = aiConfig.maxResults ?? 5;
    const scored = searchByQuery(lastUserMessage.content.toLowerCase()).slice(0, maxResults);
    const contextParts = scored.map((doc) => `## ${doc.title}
URL: ${doc.url}
${doc.description ? `Description: ${doc.description}
` : ""}
${doc.content}`);
    const context = contextParts.join("\n\n---\n\n");
    const systemPrompt = aiConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    const systemMessage = {
      role: "system",
      content: context ? `${systemPrompt}

---

Documentation context:

${context}` : systemPrompt
    };
    const llmMessages = [
      systemMessage,
      ...messages.filter((m) => m.role !== "system")
    ];
    const requestedModel = typeof body2.model === "string" && body2.model.trim().length > 0 ? body2.model.trim() : void 0;
    const resolved = resolveAIModelAndProvider(aiConfig, requestedModel);
    const finalKey = resolved.apiKey ?? resolvedKey;
    const llmResponse = await fetch(`${resolved.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${finalKey}`
      },
      body: JSON.stringify({ model: resolved.model, stream: true, messages: llmMessages })
    });
    if (!llmResponse.ok) {
      const errText = await llmResponse.text().catch(() => "Unknown error");
      return new Response(JSON.stringify({ error: `LLM API error (${llmResponse.status}): ${errText}` }), { status: 502, headers: { "Content-Type": "application/json" } });
    }
    return new Response(llmResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  }
  return { load: load2, GET: GET2, POST: POST2 };
}
const contentFiles = /* @__PURE__ */ Object.assign({
  "/docs/authentication/email-verification/page.md": __vite_glob_0_0,
  "/docs/authentication/page.md": __vite_glob_0_1,
  "/docs/authentication/social-sign-on/page.md": __vite_glob_0_2,
  "/docs/basic-usage/page.md": __vite_glob_0_3,
  "/docs/concepts/database/page.md": __vite_glob_0_4,
  "/docs/concepts/page.md": __vite_glob_0_5,
  "/docs/concepts/session-management/page.md": __vite_glob_0_6,
  "/docs/get-started/page.md": __vite_glob_0_7,
  "/docs/installation/page.md": __vite_glob_0_8,
  "/docs/integrations/page.md": __vite_glob_0_9,
  "/docs/page.md": __vite_glob_0_10,
  "/docs/plugins/organizations/page.md": __vite_glob_0_11,
  "/docs/plugins/page.md": __vite_glob_0_12,
  "/docs/plugins/two-factor/page.md": __vite_glob_0_13,
  "/docs/reference/page.md": __vite_glob_0_14
});
const { load, GET, POST } = createDocsServer({
  ...config,
  ai: { apiKey: private_env.OPENAI_API_KEY, ...config.ai },
  _preloadedContent: contentFiles
});
export {
  GET as G,
  POST as P,
  load as l
};
