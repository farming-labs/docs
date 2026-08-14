<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:a1b9c8598c9c6647
settingsHash=fnv1a64:1b5212557ba75927
outputHash=fnv1a64:7df800a8c45ebe93
generatedAt=2026-08-14T12:45:38.615Z
-->
# OG Images

## OG Images task

Task: Configure and verify static or dynamic Open Graph images for docs pages.

Expected result: Every tested docs page resolves an absolute OG image URL whose response is a valid social preview image.

Exact implementation:

```tsx title="api/og/route.ts"
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "@farming-labs/docs";
  const description = searchParams.get("description") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#000000",
          padding: "50px 80px",
          // ... fonts, branding, borders
        }}
      >
        {/* Branding strip */}
        <span style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>
          @farming-labs/docs
        </span>

        {/* Page context: title and description from frontmatter */}
        <div>
          <h1 style={{ fontSize: 68, fontWeight: 700, color: "#fff" }}>
            {title}
          </h1>
          {description && (
            <p style={{ fontSize: 22, color: "rgba(255,255,255,0.4)" }}>
              {description}
            </p>
          )}
        </div>

        {/* Footer: site label + CTA */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>documentation · docs.farming-labs.com</span>
          <span>get started →</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```
## OG Images prerequisites

- The docs site has an absolute public base URL available to metadata generation.
- Choose dynamic generation for page-aware images or commit a static image for a fixed preview.
- Applies to framework nextjs; version >=0.2.60; package @farming-labs/docs, @farming-labs/next.

## OG Images verification

- Fetch the generated metadata and its og:image URL for a representative docs page. Expected: The URL is absolute and the image request returns HTTP 200 with an image content type.
- Failure: Social previews use a relative or unreachable image URL.
- Recovery: Configure an absolute sitemap, llms.txt, robots, AI docs, or site base URL and retest generated metadata.
- Rollback: Restore the previous og configuration and remove the dynamic route or static image introduced by the change.

## OG Images agent guidance

For Next.js dynamic previews, set `og.enabled`, `og.type: "dynamic"`, and `og.endpoint` in
`docs.config.ts`, then implement `GET` in `app/api/og/route.tsx` when the response contains JSX.
Read the `title` and `description` query parameters and return a 1200x630 image. For a reliable
per-page override, set explicit `openGraph` and `twitter` frontmatter.

Fetch a representative page's absolute `og:image` URL and require HTTP 200 with an image content
type. If a dynamic image is stale, hard-refresh or add a cache-busting query. If rendering throws,
limit the route to fonts, layout, and CSS supported by `ImageResponse`; restore the previous `og`
config and remove the new route or static image to roll back.
