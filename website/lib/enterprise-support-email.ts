const ENTERPRISE_SUPPORT_TO_EMAIL =
  process.env.ENTERPRISE_SUPPORT_TO_EMAIL?.trim() || "kinfetare83@gmail.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EnterpriseSupportEmailInput = {
  email: string;
  name?: string;
  company: string;
  role?: string;
  teamSize?: string;
  websiteUrl?: string;
  supportNeeds: string[];
  message?: string;
};

export type EnterpriseSupportEmailPayload = EnterpriseSupportEmailInput & {
  submittedAt: string;
  origin: string;
  userAgent: string;
};

export function getEnterpriseSupportRecipient() {
  return ENTERPRISE_SUPPORT_TO_EMAIL;
}

export function createEnterpriseSupportEmailPayload(
  data: EnterpriseSupportEmailInput,
  request: Request,
): EnterpriseSupportEmailPayload {
  return {
    ...data,
    submittedAt: new Date().toISOString(),
    origin: request.headers.get("origin") ?? "https://docs.farming-labs.dev",
    userAgent: request.headers.get("user-agent") ?? "Unknown",
  };
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
  return value ? escapeHtml(value) : '<span style="color:#7a7a7a">Not provided</span>';
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

function detailsRows(data: EnterpriseSupportEmailPayload) {
  const rows: Array<[string, string]> = [
    ["Name", formatValue(data.name)],
    ["Company", escapeHtml(data.company)],
    [
      "Email",
      `<a href="mailto:${escapeHtml(data.email)}" style="color:#000;text-decoration:underline">${escapeHtml(data.email)}</a>`,
    ],
    ["Role", formatValue(data.role)],
    ["Team size", formatValue(data.teamSize)],
    [
      "Website",
      data.websiteUrl
        ? `<a href="${escapeHtml(data.websiteUrl)}" style="color:#000;text-decoration:underline">${escapeHtml(data.websiteUrl)}</a>`
        : '<span style="color:#7a7a7a">Not provided</span>',
    ],
    [
      "Support needs",
      data.supportNeeds.length > 0
        ? escapeHtml(data.supportNeeds.map(formatLabel).join(", "))
        : '<span style="color:#7a7a7a">Not provided</span>',
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

export function buildEnterpriseSupportEmail(data: EnterpriseSupportEmailPayload) {
  const subject = `Enterprise support request: ${data.company}`;
  const messageHtml = data.message
    ? escapeHtml(data.message).replace(/\n/g, "<br />")
    : '<span style="color:#7a7a7a">No message provided.</span>';
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
    `Submitted at: ${data.submittedAt}`,
    `Origin: ${data.origin}`,
    `User agent: ${data.userAgent}`,
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
          Submitted ${escapeHtml(data.submittedAt)} from ${escapeHtml(data.origin)}<br />
          ${escapeHtml(data.userAgent)}
        </div>
      </div>
    </div>
  `;

  return { subject, html, text };
}

export async function sendEnterpriseSupportEmail(
  data: EnterpriseSupportEmailPayload,
  recipient = ENTERPRISE_SUPPORT_TO_EMAIL,
) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return { sent: false, error: "Resend is not configured." };
  }

  const email = buildEnterpriseSupportEmail(data);
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipient,
      reply_to: data.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");

    return {
      sent: false,
      error: `Resend delivery failed with ${response.status}: ${details.slice(0, 500)}`,
    };
  }

  return { sent: true };
}
