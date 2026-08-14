import { Prisma, type EnterpriseSupportEmailNotification } from "@prisma/client";
import {
  sendEnterpriseSupportEmail,
  type EnterpriseSupportEmailPayload,
} from "@/lib/enterprise-support-email";
import { prisma } from "@/lib/prisma";

export const ENTERPRISE_SUPPORT_EMAIL_DEFAULT_LIMIT = 10;
export const ENTERPRISE_SUPPORT_EMAIL_MAX_LIMIT = 25;

export type EnterpriseSupportEmailProcessResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

export function getEnterpriseSupportEmailWorkerSecret() {
  return (
    process.env.ENTERPRISE_SUPPORT_EMAIL_WORKER_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  );
}

export function readEnterpriseSupportEmailLimit(request: Request) {
  const url = new URL(request.url);
  const parsed = Number(url.searchParams.get("limit"));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ENTERPRISE_SUPPORT_EMAIL_DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), ENTERPRISE_SUPPORT_EMAIL_MAX_LIMIT);
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

function emptyResult(skipped = 0): EnterpriseSupportEmailProcessResult {
  return {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped,
  };
}

async function processNotification(
  notification: EnterpriseSupportEmailNotification,
  now: Date,
): Promise<EnterpriseSupportEmailProcessResult> {
  if (
    notification.attempts >= notification.maxAttempts ||
    notification.nextAttemptAt > now ||
    !["PENDING", "FAILED"].includes(notification.status)
  ) {
    return emptyResult(1);
  }

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
    return emptyResult(1);
  }

  const payload = readPayload(notification.payload);

  if (!payload) {
    await prisma.enterpriseSupportEmailNotification.update({
      where: { id: notification.id },
      data: {
        status: "EXHAUSTED",
        lastError: "Notification payload is invalid.",
        nextAttemptAt: reservedUntil,
      },
    });
    return {
      processed: 1,
      sent: 0,
      failed: 0,
      skipped: 1,
    };
  }

  const result = await sendEnterpriseSupportEmail(payload, notification.recipient).catch(
    (error: unknown) => ({
      sent: false,
      error: error instanceof Error ? error.message : "Unknown email transport error",
    }),
  );

  if (result.sent) {
    await prisma.enterpriseSupportEmailNotification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: null,
      },
    });
    return {
      processed: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
    };
  }

  await prisma.enterpriseSupportEmailNotification.update({
    where: { id: notification.id },
    data: {
      status: attempts >= notification.maxAttempts ? "EXHAUSTED" : "FAILED",
      lastError: truncateError(result.error),
      nextAttemptAt: reservedUntil,
    },
  });

  return {
    processed: 1,
    sent: 0,
    failed: 1,
    skipped: 0,
  };
}

export async function processEnterpriseSupportEmailNotification(
  notificationId: string,
): Promise<EnterpriseSupportEmailProcessResult> {
  const notification = await prisma.enterpriseSupportEmailNotification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    return emptyResult(1);
  }

  return processNotification(notification, new Date());
}

export async function processEnterpriseSupportEmailQueue(
  limit = ENTERPRISE_SUPPORT_EMAIL_DEFAULT_LIMIT,
): Promise<EnterpriseSupportEmailProcessResult> {
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
  const result: EnterpriseSupportEmailProcessResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: candidates.length - notifications.length,
  };

  for (const notification of notifications) {
    const current = await processNotification(notification, now);

    result.processed += current.processed;
    result.sent += current.sent;
    result.failed += current.failed;
    result.skipped += current.skipped;
  }

  return result;
}
