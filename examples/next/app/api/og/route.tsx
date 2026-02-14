/**
 * Dynamic OG image endpoint (placeholder).
 * Replace with @vercel/og or similar for actual image generation.
 */
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Docs";

  return new Response(
    `<!DOCTYPE html><html><body><h1>${title}</h1></body></html>`,
    {
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}
