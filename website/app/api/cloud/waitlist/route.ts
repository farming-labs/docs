import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WaitlistBody = {
  email?: string;
  name?: string;
  company?: string;
  projectUrl?: string;
  interest?: string | string[];
  message?: string;
};

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

function readInterest(value: unknown, { max }: { max: number }) {
  if (Array.isArray(value)) {
    const cleaned = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (!cleaned.length) {
      return undefined;
    }

    return cleaned.join(", ").slice(0, max);
  }

  return readString(value, { max });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          ok: true,
          stored: false,
          warning: "Waitlist received, but the cloud waitlist database is not configured yet.",
        },
        { status: 202 },
      );
    }

    let body: WaitlistBody;

    try {
      body = (await request.json()) as WaitlistBody;
    } catch {
      return NextResponse.json({ error: "Waitlist body must be valid JSON" }, { status: 400 });
    }

    const email = readString(body.email, { max: 320, required: true })?.toLowerCase();
    const name = readString(body.name, { max: 120 });
    const company = readString(body.company, { max: 160 });
    const projectUrl = readString(body.projectUrl, { max: 2048 });
    const interest = readInterest(body.interest, { max: 320 });
    const message = readString(body.message, { max: 4000 });

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid email address" }, { status: 400 });
    }

    if (projectUrl) {
      try {
        new URL(projectUrl);
      } catch {
        return NextResponse.json(
          { error: "Current docs URL must be a valid URL" },
          { status: 400 },
        );
      }
    }

    try {
      const entry = await prisma.cloudWaitlistEntry.upsert({
        where: { email },
        update: {
          name,
          company,
          projectUrl,
          interest,
          message,
        },
        create: {
          email,
          name,
          company,
          projectUrl,
          interest,
          message,
        },
      });

      return NextResponse.json({ ok: true, stored: true, id: entry.id }, { status: 201 });
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2021" || error.code === "P2022")) ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        console.warn(
          "[cloud waitlist POST] CloudWaitlistEntry schema or Prisma client is out of date. Run `pnpm --dir website exec prisma generate` and `pnpm --dir website exec prisma db push` to sync it.",
        );

        return NextResponse.json(
          {
            ok: true,
            stored: false,
            warning: "Cloud waitlist schema or Prisma client is out of date",
          },
          { status: 202 },
        );
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        console.warn(
          "[cloud waitlist POST] Waitlist database is currently unreachable. Returning a non-blocking response.",
        );

        return NextResponse.json(
          {
            ok: true,
            stored: false,
            warning: "Cloud waitlist database unreachable",
          },
          { status: 202 },
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[cloud waitlist POST]", error);

    return NextResponse.json({ error: "Failed to join the cloud waitlist" }, { status: 500 });
  }
}
