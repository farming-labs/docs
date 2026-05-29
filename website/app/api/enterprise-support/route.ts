import { Prisma } from "@prisma/client";
import { after, NextResponse } from "next/server";
import {
  buildEnterpriseSupportEmail,
  createEnterpriseSupportEmailPayload,
  getEnterpriseSupportRecipient,
} from "@/lib/enterprise-support-email";
import { processEnterpriseSupportEmailNotification } from "@/lib/enterprise-support-email-queue";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EnterpriseSupportBody = {
  email?: string;
  name?: string;
  company?: string;
  role?: string;
  teamSize?: string;
  websiteUrl?: string;
  docsUrl?: string;
  supportNeeds?: string | string[];
  message?: string;
};

type EnterpriseSupportRequest = {
  email: string;
  name?: string;
  company: string;
  role?: string;
  teamSize?: string;
  websiteUrl?: string;
  supportNeeds: string[];
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
    const websiteUrl = readString(body.websiteUrl ?? body.docsUrl, { max: 2048 }) ?? undefined;
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

    if (websiteUrl) {
      try {
        const parsedWebsiteUrl = new URL(websiteUrl);

        if (!["http:", "https:"].includes(parsedWebsiteUrl.protocol)) {
          return NextResponse.json(
            { error: "Website URL must start with http:// or https://" },
            { status: 400 },
          );
        }
      } catch {
        return NextResponse.json({ error: "Website URL must be a valid URL" }, { status: 400 });
      }
    }

    const supportRequest: EnterpriseSupportRequest = {
      email,
      name,
      company,
      role,
      teamSize,
      websiteUrl,
      supportNeeds,
      message,
    };

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "Enterprise support database is not configured" },
        { status: 503 },
      );
    }

    try {
      const entry = await prisma.enterpriseSupportRequest.create({
        data: {
          email,
          name,
          company,
          role,
          teamSize,
          websiteUrl,
          supportNeeds,
          message,
        },
      });
      let queuedEmail = false;

      try {
        const payload = createEnterpriseSupportEmailPayload(supportRequest, request);
        const email = buildEnterpriseSupportEmail(payload);
        const recipient = getEnterpriseSupportRecipient();

        if (!recipient) {
          console.warn(
            "[enterprise support POST] Saved request but ENTERPRISE_SUPPORT_TO_EMAIL is not configured.",
          );
        } else {
          const notification = await prisma.enterpriseSupportEmailNotification.create({
            data: {
              requestId: entry.id,
              recipient,
              subject: email.subject,
              payload: payload as unknown as Prisma.InputJsonValue,
            },
          });
          queuedEmail = true;
          after(async () => {
            try {
              const result = await processEnterpriseSupportEmailNotification(notification.id);

              if (result.failed > 0) {
                console.warn(
                  "[enterprise support POST] Queued email was processed but not delivered.",
                );
              }
            } catch (deliveryError) {
              console.warn(
                "[enterprise support POST] Queued email could not be processed after save.",
                deliveryError,
              );
            }
          });
        }
      } catch (queueError) {
        console.warn(
          "[enterprise support POST] Saved request but could not queue email.",
          queueError,
        );
      }

      return NextResponse.json(
        { ok: true, stored: true, queuedEmail, id: entry.id },
        { status: 201 },
      );
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2021" || error.code === "P2022")) ||
        error instanceof Prisma.PrismaClientValidationError
      ) {
        console.warn(
          "[enterprise support POST] EnterpriseSupportRequest schema or Prisma client is out of date.",
        );

        return NextResponse.json(
          { error: "Enterprise support database schema is not synced yet" },
          { status: 503 },
        );
      }

      if (error instanceof Prisma.PrismaClientInitializationError) {
        console.warn("[enterprise support POST] Support database is currently unreachable.");

        return NextResponse.json(
          { error: "Enterprise support database is currently unreachable" },
          { status: 503 },
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
