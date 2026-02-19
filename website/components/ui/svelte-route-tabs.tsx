"use client";

import { useState } from "react";
import CodeBlock from "./code-block";

const routeFiles = [
  {
    label: "+layout.svelte",
    filename: "src/routes/docs/+layout.svelte",
    code: `<script>
  import { DocsLayout } from "@farming-labs/svelte-theme";
  import config from "../../lib/docs.config";
  let { data, children } = $props();
</script>

<DocsLayout tree={data.tree} {config}>
  {@render children()}
</DocsLayout>`,
  },
  {
    label: "+layout.server.js",
    filename: "src/routes/docs/+layout.server.js",
    code: `export { load } from "../../lib/docs.server";`,
  },
  {
    label: "[...slug]/+page.svelte",
    filename: "src/routes/docs/[...slug]/+page.svelte",
    code: `<script>
  import { DocsContent } from "@farming-labs/svelte-theme";
  import config from "../../../lib/docs.config";
  let { data } = $props();
</script>

<DocsContent {data} {config} />`,
  },
];

export default function SvelteRouteTabs() {
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
