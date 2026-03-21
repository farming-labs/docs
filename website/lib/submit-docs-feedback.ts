import type { DocsFeedbackData } from "@farming-labs/docs";

export const DOCS_FEEDBACK_ENDPOINT = "/api/feedback";

export async function submitDocsFeedback(data: DocsFeedbackData) {
  const response = await fetch(DOCS_FEEDBACK_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
    cache: "no-store",
    keepalive: true,
  });

  if (!response.ok) {
    let details = "";

    try {
      const body = (await response.json()) as { error?: string };
      details = body.error ? `: ${body.error}` : "";
    } catch {
      // ignore body parsing issues
    }

    throw new Error(`Failed to submit docs feedback (${response.status})${details}`);
  }
}
