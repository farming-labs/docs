import { NextResponse } from "next/server";
import { inspectHostedAgentReadiness } from "@/lib/agent-score";

export const dynamic = "force-dynamic";
// Public scoring performs bounded network probes and should return JSON before
// the platform timeout can replace the response with plain text.
export const maxDuration = 30;

type AgentScoreBody = {
  url?: string;
};

function readBodyRecord(value: unknown): AgentScoreBody {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function POST(request: Request) {
  let body: AgentScoreBody;

  try {
    body = readBodyRecord(await request.json());
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json({ error: "URL is required." }, { status: 400 });
  }

  try {
    const report = await inspectHostedAgentReadiness(rawUrl);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to score the URL.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
