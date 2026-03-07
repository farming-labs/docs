import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const APPROVAL_STATUSES = ["IDLE", "APPROVED", "REJECTED"] as const;

/**
 * PATCH /api/showcase/[id] — update approval status (admin only).
 * Header: x-showcase-admin-secret: <SHOWCASE_ADMIN_SECRET>
 * Body: { approvalStatus: "IDLE" | "APPROVED" | "REJECTED" }
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const secret = request.headers.get("x-showcase-admin-secret");
  const expected = process.env.SHOWCASE_ADMIN_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing entry id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { approvalStatus } = body as { approvalStatus?: string };

    if (
      !approvalStatus ||
      !APPROVAL_STATUSES.includes(approvalStatus as (typeof APPROVAL_STATUSES)[number])
    ) {
      return NextResponse.json(
        { error: "approvalStatus must be one of: IDLE, APPROVED, REJECTED" },
        { status: 400 },
      );
    }

    const entry = await prisma.showcaseEntry.update({
      where: { id },
      data: { approvalStatus: approvalStatus as "IDLE" | "APPROVED" | "REJECTED" },
    });
    return NextResponse.json(entry);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    console.error("[showcase PATCH]", e);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }
}
