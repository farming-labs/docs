import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EnterpriseSupportBody = {
  email?: string;
  name?: string;
  company?: string;
  role?: string;
  teamSize?: string;
  docsUrl?: string;
  supportNeeds?: string | string[];
  message?: string;
};

function readString(
  value: unknown,
  { max, required = false }: { max: number; required?: boolean },
) {
  if (typeof value !== "string") return required ? null : undefined;

  const trimmed = value.trim();
  if (!trimmed) return required ? null : undefined;

  return trimmed.slice(0, max);
}

function readStringList(
  value: unknown,
  { maxItems, maxItem }: { maxItems: number; maxItem: number },
) {
  const items = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const cleaned = items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxItem))
    .filter(Boolean)
    .slice(0, maxItems);

  return Array.from(new Set(cleaned));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatSupportMessage({
  role,
  teamSize,
  docsUrl,
  supportNeeds,
  message,
}: {
  role?: string;
  teamSize?: string;
  docsUrl?: string;
  supportNeeds: string[];
  message?: string;
}) {
  return [
    "Enterprise support request",
    role ? `Role: ${role}` : undefined,
    teamSize ? `Team size: ${teamSize}` : undefined,
    docsUrl ? `Website: ${docsUrl}` : undefined,
    supportNeeds.length ? `Support needed: ${supportNeeds.join(", ")}` : undefined,
    message ? `Notes: ${message}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    let body: EnterpriseSupportBody;

    try {
      body = (await request.json()) as EnterpriseSupportBody;
    } catch {
      return NextResponse.json(
        { error: "Support request body must be valid JSON" },
        { status: 400 },
      );
    }

    const emailInput = readString(body.email, { max: 320, required: true });
    const companyInput = readString(body.company, { max: 160, required: true });
    const email = emailInput?.toLowerCase();
    const name = readString(body.name, { max: 120 }) ?? undefined;
    const company = companyInput ?? undefined;
    const role = readString(body.role, { max: 120 }) ?? undefined;
    const teamSize = readString(body.teamSize, { max: 80 }) ?? undefined;
    const docsUrl = readString(body.docsUrl, { max: 2048 }) ?? undefined;
    const supportNeeds = readStringList(body.supportNeeds, { maxItems: 12, maxItem: 80 });
    const message = readString(body.message, { max: 4000 }) ?? undefined;

    if (!email) {
      return NextResponse.json({ error: "Work email is required" }, { status: 400 });
    }

    if (!company) {
      return NextResponse.json({ error: "Company is required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid work email" }, { status: 400 });
    }

    if (docsUrl) {
      try {
        new URL(docsUrl);
      } catch {
        return NextResponse.json({ error: "Website URL must be a valid URL" }, { status: 400 });
      }
    }

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          ok: true,
          stored: false,
          warning:
            "Support request validated, but the enterprise support database is not configured yet.",
        },
        { status: 202 },
      );
    }

    const interest = ["enterprise-support", ...supportNeeds]
      .filter(Boolean)
      .join(", ")
      .slice(0, 320);
    const supportMessage = formatSupportMessage({
      role,
      teamSize,
      docsUrl,
      supportNeeds,
      message,
    }).slice(0, 4000);

    try {
      const entry = await prisma.cloudWaitlistEntry.upsert({
        where: { email },
        update: {
          name,
          company,
          projectUrl: docsUrl,
          interest,
          message: supportMessage,
        },
        create: {
          email,
          name,
          company,
          projectUrl: docsUrl,
          interest,
          message: supportMessage,
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
          "[enterprise support POST] CloudWaitlistEntry schema or Prisma client is out of date.",
        );

        return NextResponse.json(
          {
            ok: true,
            stored: false,
            warning: "Enterprise support schema or Prisma client is out of date.",
          },
          { status: 202 },
        );
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        console.warn("[enterprise support POST] Support database is currently unreachable.");

        return NextResponse.json(
          {
            ok: true,
            stored: false,
            warning: "Enterprise support database is currently unreachable.",
          },
          { status: 202 },
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("[enterprise support POST]", error);
    return NextResponse.json(
      { error: "Failed to submit enterprise support request" },
      { status: 500 },
    );
  }
}
