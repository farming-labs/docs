"use client";

import { useState } from "react";
import CodeBlock from "./code-block";

const routeFiles = [
  {
    label: "index.astro",
    filename: "src/pages/docs/index.astro",
    code: `---
import DocsLayout from "@farming-labs/astro-theme/src/components/DocsLayout.astro";
import DocsContent from "@farming-labs/astro-theme/src/components/DocsContent.astro";
import config from "../../lib/docs.config";
import { load } from "../../lib/docs.server";
import "@farming-labs/astro-theme/css";

const data = await load(Astro.url.pathname);
---

<html lang="en">
  <head><title>{data.title} – Docs</title></head>
  <body>
    <DocsLayout tree={data.tree} config={config}>
      <DocsContent data={data} config={config} />
    </DocsLayout>
  </body>
</html>`,
  },
  {
    label: "[...slug].astro",
    filename: "src/pages/docs/[...slug].astro",
    code: `---
import DocsLayout from "@farming-labs/astro-theme/src/components/DocsLayout.astro";
import DocsContent from "@farming-labs/astro-theme/src/components/DocsContent.astro";
import config from "../../lib/docs.config";
import { load } from "../../lib/docs.server";
import "@farming-labs/astro-theme/css";

const data = await load(Astro.url.pathname);
---

<html lang="en">
  <head><title>{data.title} – Docs</title></head>
  <body>
    <DocsLayout tree={data.tree} config={config}>
      <DocsContent data={data} config={config} />
    </DocsLayout>
  </body>
</html>`,
  },
  {
    label: "api/docs.ts",
    filename: "src/pages/api/docs.ts",
    code: `import type { APIRoute } from "astro";
import { GET as docsGET, POST as docsPOST } from "../../lib/docs.server";

export const GET: APIRoute = async ({ request }) => {
  return docsGET({ request });
};

export const POST: APIRoute = async ({ request }) => {
  return docsPOST({ request });
};`,
  },
];

export default function AstroRouteTabs() {
  const [active, setActive] = useState(0);
  const file = routeFiles[active];
  return (
    <div>
      <div className="flex border-b border-white/10 mb-0">
        {routeFiles.map((f, i) => (
          <button
            key={f.label}
            onClick={() => setActive(i)}
            className={`px-3 py-1.5 text-[11px] font-mono transition-colors relative ${
              i === active
                ? "text-white"
                : "text-white/35 hover:text-white/60"
            }`}
          >
            {f.label}
            {i === active && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
            )}
          </button>
        ))}
      </div>
      <CodeBlock title="" filename={file.filename} code={file.code} />
    </div>
  );
}
