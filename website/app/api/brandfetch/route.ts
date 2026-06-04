import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type BrandfetchBody = {
  url?: string;
};

function readBodyRecord(value: unknown): BrandfetchBody {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readDomain(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function readBrandfetchPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readBrandfetchError(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;

  for (const key of ["message", "error", "detail"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

export async function POST(request: Request) {
  const apiKey = process.env.BRANDFETCH_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Brandfetch API key is not configured." }, { status: 500 });
  }

  let body: BrandfetchBody;

  try {
    body = readBodyRecord(await request.json());
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const rawUrl = typeof body.url === "string" ? body.url : "";
  const domain = readDomain(rawUrl);

  if (!domain) {
    return NextResponse.json({ error: "Please provide a valid website URL." }, { status: 400 });
  }

  const response = await fetch(
    `https://api.brandfetch.io/v2/brands/domain/${encodeURIComponent(domain)}`,
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${apiKey}`,
      },
    },
  );
  const payload = await readBrandfetchPayload(response);

  if (!response.ok) {
    return NextResponse.json(
      {
        error: readBrandfetchError(payload) ?? "Brandfetch lookup failed.",
        status: response.status,
      },
      { status: response.status === 404 ? 404 : 502 },
    );
  }

  return NextResponse.json({
    source: "brandfetch",
    domain,
    brand: payload,
  });
}
