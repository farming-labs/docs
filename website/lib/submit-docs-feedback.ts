import type { DocsFeedbackData } from "@farming-labs/docs";

export const DOCS_FEEDBACK_ENDPOINT = "/api/feedback";

export async function submitDocsFeedback(data: DocsFeedbackData) {
  try {
    const response = await fetch(DOCS_FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
      cache: "no-store",
      keepalive: true,
    });

    if (!response.ok && process.env.NODE_ENV !== "production") {
      console.error("[docs feedback]", "Failed to submit feedback", response.status);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[docs feedback]", error);
    }
  }
}
