import type { Metadata } from "@farm.js/core";

// Unmatched URLs keep the 404 page the site had on Next.js, which used its framework's built-in
// page; Farm's default looks different.

// Next.js kept the root layout's title on its 404 page.
export const metadata: Metadata = { title: { absolute: "@farming-labs/docs" } };

const colorScheme =
  "body{color:#000;background:#fff;margin:0}.not-found-code{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.not-found-code{border-right:1px solid rgba(255,255,255,.3)}}";

export default function NotFound() {
  return (
    <div
      style={{
        fontFamily:
          'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
        height: "100vh",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div>
        <style dangerouslySetInnerHTML={{ __html: colorScheme }} />
        <h1
          className="not-found-code"
          style={{
            display: "inline-block",
            margin: "0 20px 0 0",
            padding: "0 23px 0 0",
            fontSize: 24,
            fontWeight: 500,
            verticalAlign: "top",
            lineHeight: "49px",
          }}
        >
          404
        </h1>
        <div style={{ display: "inline-block" }}>
          <h2 style={{ fontSize: 14, fontWeight: 400, lineHeight: "49px", margin: 0 }}>
            This page could not be found.
          </h2>
        </div>
      </div>
    </div>
  );
}
