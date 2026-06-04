import { NextResponse } from "next/server";
import {
  getEnterpriseSupportEmailWorkerSecret,
  processEnterpriseSupportEmailQueue,
  readEnterpriseSupportEmailLimit,
} from "@/lib/enterprise-support-email-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = getEnterpriseSupportEmailWorkerSecret();

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
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

  const limit = readEnterpriseSupportEmailLimit(request);
  const result = await processEnterpriseSupportEmailQueue(limit);

  return NextResponse.json({
    ok: true,
    ...result,
  });
}

export async function GET(request: Request) {
  return processQueuedEmails(request);
}

export async function POST(request: Request) {
  return processQueuedEmails(request);
}
