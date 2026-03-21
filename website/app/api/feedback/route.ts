import type { DocsFeedbackData } from "@farming-labs/docs";
import { Prisma } from "@prisma/client";
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
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          ok: true,
          stored: false,
          warning: "Feedback database not configured",
        },
        { status: 202 },
      );
    }

    const body = (await request.json()) as FeedbackBody;
    const value = body.value;
    const url = readString(body.url, { max: 2048, required: true });
    const pathname = readString(body.pathname ?? body.path, { max: 512, required: true });
    const entry = readString(body.entry, { max: 128, required: true });
    const slug = readString(body.slug, { max: 512 });
    const comment = readString(body.comment, { max: 4000 });
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

    try {
      const createData = {
        value: value === "positive" ? "POSITIVE" : "NEGATIVE",
        comment,
        url,
        pathname,
        entry,
        slug,
        title,
        description,
        locale,
        userAgent,
        referer,
      } as Prisma.DocsFeedbackCreateInput;

      await prisma.docsFeedback.create({
        data: createData,
      });

      return NextResponse.json({ ok: true, stored: true }, { status: 201 });
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2021" || error.code === "P2022")) ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        console.warn(
          "[feedback POST] DocsFeedback schema or Prisma client is out of date. Run `pnpm --dir website exec prisma generate` and `pnpm --dir website exec prisma db push` to sync it.",
        );

        return NextResponse.json(
          {
            ok: true,
            stored: false,
            warning: "DocsFeedback schema or Prisma client is out of date",
          },
          { status: 202 },
        );
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        console.warn(
          "[feedback POST] Feedback database is currently unreachable. Returning a non-blocking response.",
        );

        return NextResponse.json(
          {
            ok: true,
            stored: false,
            warning: "Feedback database unreachable",
          },
          { status: 202 },
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[feedback POST]", error);

    return NextResponse.json({ error: "Failed to store docs feedback" }, { status: 500 });
  }
}
