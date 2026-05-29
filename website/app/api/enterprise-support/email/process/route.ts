import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  sendEnterpriseSupportEmail,
  type EnterpriseSupportEmailPayload,
} from "@/lib/enterprise-support-email";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

function getWorkerSecret() {
  return (
    process.env.ENTERPRISE_SUPPORT_EMAIL_WORKER_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim()
  );
}

function isAuthorized(request: Request) {
  const secret = getWorkerSecret();

  if (!secret) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function readLimit(request: Request) {
  const url = new URL(request.url);
  const parsed = Number(url.searchParams.get("limit"));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function nextAttemptDate(attempts: number) {
  const minutes = Math.min(60, 2 ** Math.max(attempts - 1, 0) * 5);

  return new Date(Date.now() + minutes * 60_000);
}

function truncateError(value?: string) {
  return value ? value.slice(0, 1000) : "Unknown delivery error";
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readPayload(value: Prisma.JsonValue): EnterpriseSupportEmailPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;
  const supportNeeds = Array.isArray(data.supportNeeds)
    ? data.supportNeeds.filter((item): item is string => typeof item === "string")
    : [];

  if (
    typeof data.email !== "string" ||
    typeof data.company !== "string" ||
    typeof data.submittedAt !== "string" ||
    typeof data.origin !== "string" ||
    typeof data.userAgent !== "string"
  ) {
    return null;
  }

  return {
    email: data.email,
    company: data.company,
    name: optionalString(data.name),
    role: optionalString(data.role),
    teamSize: optionalString(data.teamSize),
    websiteUrl: optionalString(data.websiteUrl),
    supportNeeds,
    message: optionalString(data.message),
    submittedAt: data.submittedAt,
    origin: data.origin,
    userAgent: data.userAgent,
  };
}

async function processQueuedEmails(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Enterprise support database is not configured" },
      { status: 503 },
    );
  }

  const limit = readLimit(request);
  const now = new Date();
  const candidates = await prisma.enterpriseSupportEmailNotification.findMany({
    where: {
      nextAttemptAt: { lte: now },
      status: { in: ["PENDING", "FAILED"] },
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit * 3,
  });
  const notifications = candidates
    .filter((notification) => notification.attempts < notification.maxAttempts)
    .slice(0, limit);
  let sent = 0;
  let failed = 0;
  let skipped = candidates.length - notifications.length;

  for (const notification of notifications) {
    const attempts = notification.attempts + 1;
    const reservedUntil = nextAttemptDate(attempts);
    const claim = await prisma.enterpriseSupportEmailNotification.updateMany({
      where: {
        id: notification.id,
        attempts: notification.attempts,
        nextAttemptAt: { lte: now },
        status: { in: ["PENDING", "FAILED"] },
      },
      data: {
        attempts,
        nextAttemptAt: reservedUntil,
      },
    });

    if (claim.count === 0) {
      skipped += 1;
      continue;
    }

    const payload = readPayload(notification.payload);

    if (!payload) {
      skipped += 1;
      await prisma.enterpriseSupportEmailNotification.update({
        where: { id: notification.id },
        data: {
          status: "EXHAUSTED",
          lastError: "Notification payload is invalid.",
          nextAttemptAt: reservedUntil,
        },
      });
      continue;
    }

    const result = await sendEnterpriseSupportEmail(payload, notification.recipient);

    if (result.sent) {
      sent += 1;
      await prisma.enterpriseSupportEmailNotification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });
      continue;
    }

    failed += 1;
    await prisma.enterpriseSupportEmailNotification.update({
      where: { id: notification.id },
      data: {
        status: attempts >= notification.maxAttempts ? "EXHAUSTED" : "FAILED",
        lastError: truncateError(result.error),
        nextAttemptAt: reservedUntil,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    processed: notifications.length,
    sent,
    failed,
    skipped,
  });
}

export async function GET(request: Request) {
  return processQueuedEmails(request);
}

export async function POST(request: Request) {
  return processQueuedEmails(request);
}
