---
order: 6
title: Concepts
description: Core concepts and architecture of Better Auth.
icon: terminal 
---

# Concepts

Understanding the core concepts behind Better Auth will help you make the most of the framework.

## Architecture

Better Auth follows a modular architecture with these key components:

- **Auth Instance** — The core server-side object that handles all auth operations
- **Auth Client** — A client-side helper for interacting with the auth API
- **Database Adapter** — Connects to your database for storing users, sessions, and accounts
- **Plugins** — Extend functionality without modifying the core

## Request Flow

1. Client sends a request (sign-in, sign-up, etc.)
2. Auth instance validates the request
3. Database adapter reads/writes data
4. Session is created and returned
5. Client stores the session token

---

## Deep Dives

- [Session Management](/docs/concepts/session-management) — How sessions work
- [Database](/docs/concepts/database) — Database adapters and schema
