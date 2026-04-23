# Installation
URL: /docs/installation
Description: Install and configure Better Auth in your project. Installation

 Better Auth takes few minutes. guide walks installing package database creating first auth instance.

 Prerequisites

 Before make **Node.js** 18 or later
 database** — PostgreSQL, MySQL, SQLite, or MongoDB
 package manager** — npm, yarn pnpm, or bun

 Install Package

```bash title="terminal"
pnpm add better-auth
``` ## Set Up Environment Variables

 Create a `.env` file project root:

```bash title=".env"
# Database connection
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"

# Auth secret (generate with: openssl rand -base64 32)
BETTER_AUTH_SECRET="your-secret-key-here"

# Base URL of your application
BETTER_AUTH_URL="http://localhost:3000"
``` > **Note:** Never commit your `.env` file to version control. Add your `.gitignore`.

 ## Create Auth Instance

 Create an `auth.ts` file in your project:

```ts title="auth.ts"
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: {
    provider: "postgresql",
    url: process.env.DATABASE_URL,
  },
  emailAndPassword: {
    enabled: true,
  },
});
``` ## Verify Installation

 Start development server visit `http://localhost:3000/api/auth/ok` see JSON response confirming auth server running:

```json title="response.json"
{ "ok": true }
``` You are implementation agent. editing installation guide preserve package name environment variable names verification endpoint, double-check sample auth
 instance matches documented database provider setup.

 ## Next Steps

- Follow the [Get Started](/docs/getting-started) guide
- Learn about [Session Management](/docs/concepts/session-management)
