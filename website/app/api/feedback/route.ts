import type { DocsFeedbackData } from "@farming-labs/docs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type FeedbackBody = Partial<DocsFeedbackData> & { path?: string };

function readString(
  value: unknown,
  { max, required = false }: { max: number; required?: boolean },
) {
  if (typeof value !== "string") {
    return required ? null : undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return required ? null : undefined;
  }

  return trimmed.slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackBody;
    const value = body.value;
    const url = readString(body.url, { max: 2048, required: true });
    const pathname = readString(body.pathname ?? body.path, { max: 512, required: true });
    const entry = readString(body.entry, { max: 128, required: true });
    const slug = readString(body.slug, { max: 512 });
    const title = readString(body.title, { max: 300 });
    const description = readString(body.description, { max: 2000 });
    const locale = readString(body.locale, { max: 32 });

    if (value !== "positive" && value !== "negative") {
      return NextResponse.json({ error: "Invalid feedback value" }, { status: 400 });
    }

    if (!url || !pathname || !entry) {
      return NextResponse.json(
        { error: "Feedback payload must include url, pathname, and entry" },
        { status: 400 },
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Feedback url must be a valid URL" }, { status: 400 });
    }

    const userAgent = readString(request.headers.get("user-agent"), { max: 512 });
    const referer = readString(request.headers.get("referer"), { max: 2048 });

    await prisma.docsFeedback.create({
      data: {
        value: value === "positive" ? "POSITIVE" : "NEGATIVE",
        url,
        pathname,
        entry,
        slug,
        title,
        description,
        locale,
        userAgent,
        referer,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[feedback POST]", error);

    const message = process.env.DATABASE_URL
      ? "Failed to store docs feedback"
      : "Feedback database not configured";

    return NextResponse.json({ error: message }, { status: process.env.DATABASE_URL ? 500 : 503 });
  }
}
