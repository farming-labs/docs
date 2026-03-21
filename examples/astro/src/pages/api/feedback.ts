import type { APIRoute } from "astro";

const FEEDBACK_ENDPOINT = "https://docs.farming-labs.dev/api/feedback";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.text();
    const response = await fetch(FEEDBACK_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
      },
      body,
      cache: "no-store",
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to forward feedback request" }), {
      status: 502,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }
};
