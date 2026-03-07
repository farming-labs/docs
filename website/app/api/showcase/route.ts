import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/showcase — list approved showcase entries only (newest first) */
export async function GET() {
  try {
    const entries = await prisma.showcaseEntry.findMany({
      where: { approvalStatus: "APPROVED" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(entries);
  } catch (e) {
    console.error("[showcase GET]", e);
    const message = process.env.DATABASE_URL
      ? "Failed to fetch showcase entries"
      : "Showcase database not configured";
    return NextResponse.json({ error: message }, { status: process.env.DATABASE_URL ? 500 : 503 });
  }
}

/** POST /api/showcase — submit a new showcase entry */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, url, description, screenshot } = body as {
      name?: string;
      url?: string;
      description?: string;
      screenshot?: string;
    };

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedUrl = typeof url === "string" ? url.trim() : "";
    const trimmedDesc = typeof description === "string" ? description.trim() : null;
    const trimmedScreenshot = typeof screenshot === "string" ? screenshot.trim() : null;

    if (!trimmedName || !trimmedUrl) {
      return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
    }

    // Basic URL format check
    try {
      new URL(trimmedUrl);
    } catch {
      return NextResponse.json({ error: "Please provide a valid URL" }, { status: 400 });
    }

    const MAX_SCREENSHOT_LENGTH = 3_000_000; // ~2MB base64
    if (trimmedScreenshot) {
      if (!trimmedScreenshot.startsWith("data:image/") || !trimmedScreenshot.includes(";base64,")) {
        return NextResponse.json(
          { error: "Screenshot must be a base64 image (data:image/...;base64,...)" },
          { status: 400 },
        );
      }
      if (trimmedScreenshot.length > MAX_SCREENSHOT_LENGTH) {
        return NextResponse.json(
          { error: "Screenshot image is too large. Use a smaller image (under 2MB)." },
          { status: 400 },
        );
      }
    }

    const entry = await prisma.showcaseEntry.create({
      data: {
        name: trimmedName,
        url: trimmedUrl,
        description: trimmedDesc || undefined,
        screenshot: trimmedScreenshot || undefined,
        approvalStatus: "IDLE",
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    console.error("[showcase POST]", e);
    const message = process.env.DATABASE_URL
      ? "Failed to create showcase entry"
      : "Showcase database not configured";
    return NextResponse.json({ error: message }, { status: process.env.DATABASE_URL ? 500 : 503 });
  }
}
