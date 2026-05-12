import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveAgentScoreSiteName, inspectHostedAgentReadiness } from "@/lib/agent-score";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LEADERBOARD_PAGE_SIZE = 100;

function readQueryNumber(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function isPrismaSchemaMissing(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2021 = table missing, P2022 = column missing.
    return error.code === "P2021" || error.code === "P2022";
  }
  return error instanceof Prisma.PrismaClientValidationError;
}

function isPrismaUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P1001/P1002/P1008 = connection failures/timeouts, P2024 = pool timeout.
    return ["P1001", "P1002", "P1008", "P2024"].includes(error.code);
  }
  return false;
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ entries: [], notConfigured: true }, { status: 200 });
  }

  const url = new URL(request.url);
  const limit = readQueryNumber(url.searchParams.get("limit"), 25, LEADERBOARD_PAGE_SIZE);

  try {
    const entries = await prisma.agentScoreEntry.findMany({
      where: { approvalStatus: "APPROVED" },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      take: limit,
      select: {
        id: true,
        url: true,
        name: true,
        score: true,
        grade: true,
        framework: true,
        checks: true,
        recommendations: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ entries });
  } catch (error) {
    if (isPrismaSchemaMissing(error) || isPrismaUnavailable(error)) {
      // Surface as "not configured" so the page can show a friendly empty state
      // instead of breaking the leaderboard render in dev / pre-migrated deploys.
      return NextResponse.json({ entries: [], notConfigured: true }, { status: 200 });
    }
    console.error("[agent-score leaderboard GET]", error);
    return NextResponse.json({ error: "Failed to load the leaderboard." }, { status: 500 });
  }
}

type SubmitBody = {
  url?: string;
  name?: string;
  submitterName?: string;
  submitterUrl?: string;
};

function readText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function readOptionalUrl(value: unknown): string | undefined {
  const text = readText(value, 2048);
  if (!text) return undefined;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: true,
        stored: false,
        warning: "Leaderboard database is not configured yet.",
      },
      { status: 202 },
    );
  }

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const rawUrl = readText(body.url, 2048);
  if (!rawUrl) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  let report;
  try {
    // Re-run the probes server-side so submitters can't fake a score
    // by passing pre-computed numbers from the client.
    report = await inspectHostedAgentReadiness(rawUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to score the URL." },
      { status: 400 },
    );
  }

  const customName = readText(body.name, 120);
  const submitterName = readText(body.submitterName, 120);
  const submitterUrl = readOptionalUrl(body.submitterUrl);
  const name = customName ?? deriveAgentScoreSiteName(report.baseUrl);

  try {
    const existingEntry = await prisma.agentScoreEntry.findUnique({
      where: { url: report.baseUrl },
      select: { id: true, score: true },
    });

    const entry = await prisma.agentScoreEntry.upsert({
      where: { url: report.baseUrl },
      update: {
        name,
        score: report.score,
        grade: report.grade,
        framework: report.framework,
        checks: report.checks as unknown as Prisma.InputJsonValue,
        recommendations: report.recommendations as unknown as Prisma.InputJsonValue,
        submitterName,
        submitterUrl,
        approvalStatus: "APPROVED",
      },
      create: {
        url: report.baseUrl,
        name,
        score: report.score,
        grade: report.grade,
        framework: report.framework,
        checks: report.checks as unknown as Prisma.InputJsonValue,
        recommendations: report.recommendations as unknown as Prisma.InputJsonValue,
        submitterName,
        submitterUrl,
      },
    });
    const action = existingEntry ? "updated" : "created";

    return NextResponse.json(
      {
        ok: true,
        stored: true,
        action,
        id: entry.id,
        previousScore: existingEntry?.score,
        report,
      },
      { status: existingEntry ? 200 : 201 },
    );
  } catch (error) {
    if (isPrismaSchemaMissing(error)) {
      return NextResponse.json(
        {
          ok: true,
          stored: false,
          report,
          warning:
            "Leaderboard schema is out of date. Run `pnpm --dir website exec prisma generate && pnpm --dir website exec prisma db push`.",
        },
        { status: 202 },
      );
    }

    if (isPrismaUnavailable(error)) {
      return NextResponse.json(
        {
          ok: true,
          stored: false,
          report,
          warning: "Leaderboard database is currently unreachable.",
        },
        { status: 202 },
      );
    }

    console.error("[agent-score leaderboard POST]", error);
    return NextResponse.json({ error: "Failed to submit to the leaderboard." }, { status: 500 });
  }
}
