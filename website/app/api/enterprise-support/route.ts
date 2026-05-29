import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENTERPRISE_SUPPORT_TO_EMAIL =
  process.env.ENTERPRISE_SUPPORT_TO_EMAIL?.trim() || "kinfetare83@gmail.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatValue(value?: string) {
  return value ? escapeHtml(value) : "<span style=\"color:#7a7a7a\">Not provided</span>";
}

function formatTextValue(value?: string) {
  return value || "Not provided";
}

function formatLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function detailsRows(data: EnterpriseSupportRequest) {
  const rows: Array<[string, string]> = [
    ["Name", formatValue(data.name)],
    ["Company", escapeHtml(data.company)],
    ["Email", `<a href="mailto:${escapeHtml(data.email)}" style="color:#000;text-decoration:underline">${escapeHtml(data.email)}</a>`],
    ["Role", formatValue(data.role)],
    ["Team size", formatValue(data.teamSize)],
    [
      "Website",
      data.websiteUrl
        ? `<a href="${escapeHtml(data.websiteUrl)}" style="color:#000;text-decoration:underline">${escapeHtml(data.websiteUrl)}</a>`
        : "<span style=\"color:#7a7a7a\">Not provided</span>",
    ],
    [
      "Support needs",
      data.supportNeeds.length > 0
        ? escapeHtml(data.supportNeeds.map(formatLabel).join(", "))
        : "<span style=\"color:#7a7a7a\">Not provided</span>",
    ],
  ];

  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="width:150px;padding:10px 0;border-bottom:1px solid #ededed;color:#737373;font:12px Geist,Arial,sans-serif">${label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #ededed;color:#111;font:14px Geist,Arial,sans-serif">${value}</td>
        </tr>
      `,
    )
    .join("");
}

function buildEnterpriseSupportEmail(data: EnterpriseSupportRequest, request: Request) {
  const submittedAt = new Date().toISOString();
  const origin = request.headers.get("origin") ?? "https://docs.farming-labs.dev";
  const userAgent = request.headers.get("user-agent") ?? "Unknown";
  const subject = `Enterprise support request: ${data.company}`;
  const messageHtml = data.message
    ? escapeHtml(data.message).replace(/\n/g, "<br />")
    : "<span style=\"color:#7a7a7a\">No message provided.</span>";
  const text = [
    `Enterprise support request: ${data.company}`,
    "",
    `Name: ${formatTextValue(data.name)}`,
    `Company: ${data.company}`,
    `Email: ${data.email}`,
    `Role: ${formatTextValue(data.role)}`,
    `Team size: ${formatTextValue(data.teamSize)}`,
    `Website: ${formatTextValue(data.websiteUrl)}`,
    `Support needs: ${data.supportNeeds.map(formatLabel).join(", ") || "Not provided"}`,
    "",
    "Message:",
    formatTextValue(data.message),
    "",
    `Submitted at: ${submittedAt}`,
    `Origin: ${origin}`,
    `User agent: ${userAgent}`,
  ].join("\n");

  const html = `
    <div style="margin:0;background:#f7f7f7;padding:32px 18px;font-family:Geist,Arial,sans-serif;color:#111">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e5e5">
        <div style="border-bottom:1px solid #e5e5e5;padding:22px 24px">
          <p style="margin:0 0 8px;color:#737373;font:11px Geist Mono,ui-monospace,monospace;text-transform:uppercase;letter-spacing:.16em">Enterprise support</p>
          <h1 style="margin:0;color:#111;font:600 22px Geist,Arial,sans-serif;letter-spacing:-.01em">New request from ${escapeHtml(data.company)}</h1>
        </div>
        <div style="padding:8px 24px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            ${detailsRows(data)}
          </table>
        </div>
        <div style="padding:20px 24px">
          <p style="margin:0 0 8px;color:#737373;font:11px Geist Mono,ui-monospace,monospace;text-transform:uppercase;letter-spacing:.16em">Message</p>
          <div style="border:1px solid #ededed;background:#fafafa;padding:14px 16px;color:#222;font:14px/1.7 Geist,Arial,sans-serif">${messageHtml}</div>
        </div>
        <div style="border-top:1px solid #e5e5e5;padding:16px 24px;color:#737373;font:12px/1.6 Geist,Arial,sans-serif">
          Submitted ${escapeHtml(submittedAt)} from ${escapeHtml(origin)}<br />
          ${escapeHtml(userAgent)}
        </div>
      </div>
    </div>
  `;

  return { subject, html, text };
}

async function sendEnterpriseSupportEmail(data: EnterpriseSupportRequest, request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    console.warn("[enterprise support POST] Resend is not configured.");
    return { sent: false };
  }

  const email = buildEnterpriseSupportEmail(data, request);
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: ENTERPRISE_SUPPORT_TO_EMAIL,
      reply_to: data.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.warn("[enterprise support POST] Resend delivery failed.", {
      status: response.status,
      details: details.slice(0, 500),
    });
    return { sent: false };
  }

  return { sent: true };
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
        new URL(websiteUrl);
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
    const emailResult = await sendEnterpriseSupportEmail(supportRequest, request);

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        {
          ok: true,
          stored: false,
          emailed: emailResult.sent,
          warning:
            "Support request validated, but the enterprise support database is not configured yet.",
        },
        { status: 202 },
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

      return NextResponse.json(
        { ok: true, stored: true, emailed: emailResult.sent, id: entry.id },
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
          {
            ok: true,
            stored: false,
            emailed: emailResult.sent,
            warning:
              "Enterprise support request received, but the dedicated support schema is not synced yet.",
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
            emailed: emailResult.sent,
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
