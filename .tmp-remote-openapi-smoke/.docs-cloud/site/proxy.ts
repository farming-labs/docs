import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOG_PREFIX = "[docs-page]";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const purpose = request.headers.get("purpose");
  const prefetch = request.headers.get("next-router-prefetch");

  if (purpose !== "prefetch" && prefetch === null) {
    console.log(`${LOG_PREFIX} ${pathname}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/docs/:path*", "/api-reference/:path*"],
};
