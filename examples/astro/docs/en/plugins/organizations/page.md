---
title: "Organizations"
description: "Multi-tenant organization management with roles and invitations."
---

# Organizations

The organizations plugin adds multi-tenant support to your app. Users can create organizations, invite members, assign roles, and manage teams.

## Setup

```ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      maximumOrganizations: 5, // Per user
      roles: {
        owner: {
          permissions: ["*"], // All permissions
        },
        admin: {
          permissions: ["member:read", "member:invite", "member:remove", "organization:update"],
        },
        member: {
          permissions: ["member:read"],
        },
      },
    }),
  ],
});
```

## Client Setup

```ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [organizationClient()],
});
```

## Creating an Organization

```tsx
const { data: org, error } = await authClient.organization.create({
  name: "Acme Inc",
  slug: "acme",
  metadata: {
    plan: "pro",
    industry: "saas",
  },
});

console.log("Created:", org.name); // "Acme Inc"
```

## Inviting Members

```tsx
// Invite by email
const { data: invitation } = await authClient.organization.inviteMember({
  organizationId: org.id,
  email: "colleague@example.com",
  role: "member",
});

// The invited user receives an email with an accept link
```

### Accept an Invitation

```tsx
const { data } = await authClient.organization.acceptInvitation({
  invitationId: "invitation-id",
});
```

## Managing Members

### List Members

```tsx
const { data: members } = await authClient.organization.listMembers({
  organizationId: org.id,
});

members.forEach((member) => {
  console.log(`${member.user.name} — ${member.role}`);
});
```

### Update Member Role

```tsx
await authClient.organization.updateMemberRole({
  organizationId: org.id,
  memberId: "member-id",
  role: "admin",
});
```

### Remove a Member

```tsx
await authClient.organization.removeMember({
  organizationId: org.id,
  memberId: "member-id",
});
```

## Active Organization

Users can be part of multiple organizations. Set the active one:

```tsx
// Set active organization
await authClient.organization.setActive({
  organizationId: org.id,
});

// Get active organization
const { data: activeOrg } = await authClient.useActiveOrganization();
```

## Server-Side Usage

### Check Organization Membership

```ts
const session = await auth.api.getSession({ headers });
const membership = await auth.api.getOrganizationMember({
  organizationId: "org-id",
  userId: session.user.id,
});

if (!membership) {
  throw new Error("Access denied");
}

if (membership.role !== "admin" && membership.role !== "owner") {
  throw new Error("Insufficient permissions");
}
```

## Database Schema

The plugin adds these tables:

| Table          | Description                                 |
| -------------- | ------------------------------------------- |
| `organization` | Organization details (name, slug, metadata) |
| `member`       | User-organization relationship with roles   |
| `invitation`   | Pending invitations                         |

## Permissions

Define custom permissions per role:

```ts
organization({
  roles: {
    owner: { permissions: ["*"] },
    admin: {
      permissions: [
        "member:read",
        "member:invite",
        "member:remove",
        "project:create",
        "project:read",
        "project:update",
        "project:delete",
        "billing:read",
        "billing:update",
      ],
    },
    viewer: {
      permissions: ["member:read", "project:read"],
    },
  },
});
```

Check permissions:

```ts
const hasPermission = await auth.api.hasPermission({
  organizationId: "org-id",
  userId: session.user.id,
  permission: "project:delete",
});
```
