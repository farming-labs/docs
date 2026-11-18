import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir, cpus, release } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const [mode, ...args] = process.argv.slice(2);
const here = fileURLToPath(import.meta.url);
if (mode === "worker") {
  const [fixture, entry, api, audience] = args;
  const pages = JSON.parse(readFileSync(fixture, "utf8"));
  const importStart = performance.now();
  const mod = await import(pathToFileURL(entry));
  const importMs = performance.now() - importStart;
  const parse = api === "package" ? mod.parseMarkdownSections : mod.parseDocsMarkdownSections;
  const field = audience === "agent" ? "agentRawContent" : "rawContent";
  let sources = pages.map((page) => page[field]);
  if (audience === "one-heading") sources = ["# Install"];
  if (audience === "reference-page")
    sources = [pages.find((page) => page.slug === "reference").rawContent];
  if (audience === "jsx-expression")
    sources = ["# Example\n\n<Widget items={rows.map(row => row.id)} />"];
  const start = performance.now();
  const sections = sources.map((source) =>
    parse(source, { format: "mdx", ignoreElements: ["Prompt"] }),
  );
  const ms = performance.now() - start;
  const hash = createHash("sha256").update(JSON.stringify(sections)).digest("hex");
  console.log(
    JSON.stringify({
      ms,
      importMs,
      importAndParseMs: importMs + ms,
      hash,
      sections: sections.flat().length,
      pages: sources.length,
      bytes: sources.reduce((sum, source) => sum + Buffer.byteLength(source), 0),
    }),
  );
} else {
  if (process.argv.length < 6 || process.argv.length > 7)
    throw Error(
      "Pass the baseline docs dist, candidate docs dist, clean package consumer, and output JSON path. Optionally pass a consumer containing the previous packed prototype.",
    );
  const [baseline, candidate, consumer, output, previousConsumer] = process.argv
    .slice(2)
    .map((p) => resolve(p));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const mcp = await import(pathToFileURL(join(baseline, "mcp.mjs")));
  const pages = await mcp
    .createFilesystemDocsMcpSource({ rootDir: root, contentDir: "website/src/app/docs" })
    .getPages();
  const packageEntry = createRequire(join(consumer, "package.json")).resolve(
    "@farming-labs/inkspan",
  );
  const prior = previousConsumer && createRequire(join(previousConsumer, "package.json"));
  const previousEntries = prior && {
    package: prior.resolve("@farming-labs/markdown-sections"),
    docs: join(dirname(prior.resolve("@farming-labs/docs")), "markdown-sections.mjs"),
  };
  const temp = mkdtempSync(join(tmpdir(), "markdown-section-bench-"));
  const fixture = join(temp, "pages.json");
  const samples = [];
  const summaries = [];
  const rounds = 9;
  try {
    writeFileSync(fixture, JSON.stringify(pages));
    for (const api of ["package", "docs"]) {
      const audiences =
        api === "package"
          ? ["human", "agent", "reference-page", "one-heading", "jsx-expression"]
          : ["human", "agent"];
      for (const audience of audiences) {
        let digest;
        for (let round = -1; round < rounds; round++) {
          const variants = previousEntries
            ? ["baseline", "candidate", "control", "previous"]
            : ["baseline", "candidate", "control"];
          if ((round + 1) % 2) variants.reverse();
          const offset = (round + 1) % variants.length;
          for (const variant of [...variants.slice(offset), ...variants.slice(0, offset)]) {
            const useReference = variant === "baseline" || variant === "control";
            const entry =
              variant === "previous"
                ? previousEntries[api]
                : api === "package"
                  ? packageEntry
                  : join(useReference ? baseline : candidate, "markdown-sections.mjs");
            const switches = api === "package" && useReference ? ["--conditions=workerd"] : [];
            const result = JSON.parse(
              execFileSync(
                process.execPath,
                [...switches, here, "worker", fixture, entry, api, audience],
                { encoding: "utf8" },
              ),
            );
            digest ??= result.hash;
            assert.equal(result.hash, digest, `${api} ${audience} ${variant} output changed`);
            samples.push({ api, audience, round, variant, ...result });
          }
        }
        const stats = (variant, metric) => {
          const times = samples
            .filter(
              (s) =>
                s.api === api && s.audience === audience && s.variant === variant && s.round >= 0,
            )
            .map((s) => s[metric])
            .sort((a, b) => a - b);
          return {
            median: times[Math.floor(times.length / 2)],
            p95: times[Math.ceil(times.length * 0.95) - 1],
          };
        };
        const row = { api, audience };
        for (const variant of [
          "baseline",
          "candidate",
          "control",
          ...(previousEntries ? ["previous"] : []),
        ]) {
          row[variant] = {
            ...stats(variant, "ms"),
            import: stats(variant, "importMs"),
            importAndParse: stats(variant, "importAndParseMs"),
          };
        }
        row.speedup = row.baseline.median / row.candidate.median;
        summaries.push(row);
        console.log(row);
      }
    }
    writeFileSync(
      output,
      JSON.stringify(
        {
          node: process.version,
          arch: process.arch,
          os: release(),
          cpu: cpus()[0].model,
          rounds,
          warmups: 1,
          summaries,
          samples,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
