import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { cpus, release, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url)),
  here = fileURLToPath(import.meta.url);
const options = { rootDir: root, contentDir: "website/src/app/docs" };
const digest = (data) => createHash("sha256").update(JSON.stringify(data)).digest("hex");

if (process.argv[2] === "worker") {
  const [, , , variant, dist, group, fixture] = process.argv;
  if (variant === "reuse") {
    const target = pathToFileURL(join(dist, "audience.mjs")).href;
    registerHooks({
      load(url, context, next) {
        const loaded = next(url, context);
        if (url !== target) return loaded;
        const original = Buffer.from(loaded.source).toString();
        const marker = "function resolveDocsAudienceMdxContent(content, audience) {";
        const [before, after, ...extra] = original.split(marker);
        assert.ok(after && !extra.length);
        const call = "for (const tag of findDocsAudienceMdxTags(content))";
        assert.equal(after.split(call).length, 2);
        const cache = `let cachedProjection;
        function projectionTags(source) {
          if (cachedProjection?.source === source) return cachedProjection.tags;
          const tags = findDocsAudienceMdxTags(source);
          cachedProjection = source.length <= 1000000 ? { source, tags } : undefined;
          return tags;
        }\n`;
        return {
          ...loaded,
          source:
            before +
            cache +
            marker +
            after.replace(call, "for (const tag of projectionTags(content))"),
        };
      },
    });
  }
  let run;
  if (group === "scan") {
    const { createFilesystemDocsMcpSource } = await import(pathToFileURL(join(dist, "mcp.mjs")));
    const source = createFilesystemDocsMcpSource(options);
    run = () => source.getPages();
  } else {
    const data = JSON.parse(readFileSync(fixture));
    const audience = await import(pathToFileURL(join(dist, "audience.mjs")));
    run =
      group === "tags"
        ? () => data.map((s) => audience.findDocsAudienceMdxTags(s))
        : () =>
            data.map((s) =>
              ["human", "agent"].map((a) => audience.resolveDocsAudienceMdxContent(s, a)),
            );
  }
  const start = performance.now(),
    result = await run(),
    ms = performance.now() - start;
  console.log(JSON.stringify({ ms, hash: digest(result), pages: result.length }));
} else {
  if (process.argv.length !== 5)
    throw Error("Pass baseline docs dist, candidate docs dist and an output JSON path.");
  const [baseline, candidate, output] = process.argv.slice(2).map((p) => resolve(p));
  const temp = mkdtempSync(join(tmpdir(), "inkspan-audience-")),
    fixture = join(temp, "inputs.json");
  try {
    const { createFilesystemDocsMcpSource } = await import(
      pathToFileURL(join(baseline, "mcp.mjs"))
    );
    const pages = await createFilesystemDocsMcpSource(options).getPages();
    const matter = createRequire(join(root, "packages/docs/package.json"))("gray-matter");
    writeFileSync(
      fixture,
      JSON.stringify(
        pages.map((p) => matter(readFileSync(join(root, p.sourcePath), "utf8")).content),
      ),
    );
    const samples = [],
      summaries = [];
    for (const group of ["tags", "projection", "scan"]) {
      const variants =
        group === "tags"
          ? ["baseline", "candidate", "control"]
          : ["baseline", "candidate", "control", "reuse"];
      let expected;
      for (let round = -1; round < 9; round++) {
        const shift = (round + 1) % variants.length,
          order = [...variants.slice(shift), ...variants.slice(0, shift)];
        if (round % 2 === 0) order.reverse();
        for (const variant of order) {
          const dist = variant === "candidate" ? candidate : baseline;
          const sample = JSON.parse(
            execFileSync(process.execPath, [here, "worker", variant, dist, group, fixture]),
          );
          expected ??= sample.hash;
          assert.equal(sample.hash, expected, group + " output differs for " + variant);
          samples.push({ group, variant, round, ...sample });
        }
      }
      const stats = Object.fromEntries(
        variants.map((variant) => {
          const t = samples
            .filter((s) => s.round >= 0 && s.variant === variant && s.group === group)
            .map((s) => s.ms)
            .sort((a, b) => a - b);
          return [variant, { median: t[4], p95: t[8] }];
        }),
      );
      console.log(group, stats);
      summaries.push({ group, ...stats });
    }
    writeFileSync(
      output,
      JSON.stringify(
        {
          node: process.version,
          cpu: cpus()[0].model,
          os: release(),
          rounds: 9,
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
