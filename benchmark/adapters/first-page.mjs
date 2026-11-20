import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import { cpus, release } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const site = fileURLToPath(new URL("../../website/src/app/docs/", import.meta.url));

if (process.argv[2] === "--worker") {
  const [, , , adapter, root] = process.argv;
  const resolve = createRequire(path.resolve(root, "package.json")).resolve;
  const bundled = adapter === "farmjs";
  const config = { entry: "docs", ordering: "numeric", contentDir: bundled ? "docs" : site };
  if (bundled) {
    const files = fs
      .readdirSync(site, { recursive: true })
      .filter((name) => /(?:^|[/\\])(?:page\.mdx|agent\.md)$/.test(name))
      .sort();
    config._preloadedContent = Object.fromEntries(
      files.map((name) => [
        "/docs/" + name.replaceAll("\\", "/"),
        fs.readFileSync(path.join(site, name), "utf8"),
      ]),
    );
  }
  const start = performance.now();
  const { createDocsServer } = await import(
    pathToFileURL(
      resolve(`@farming-labs/${adapter === "farmjs-filesystem" ? "farmjs" : adapter}/server`),
    )
  );
  const imported = performance.now();
  const server = createDocsServer(config);
  const beforeRequest = performance.now();
  const page = await server.load(adapter === "nuxt" ? "/docs" : { pathname: "/docs" });
  const ready = performance.now();
  const digest = createHash("sha256").update(JSON.stringify(page)).digest("hex");
  console.log(
    JSON.stringify({
      digest,
      importMs: imported - start,
      createMs: beforeRequest - imported,
      firstPageMs: ready - imported,
      importThroughPageMs: ready - start,
    }),
  );
} else {
  const farm = process.argv.includes("--farm-filesystem");
  const measured = process.argv.includes("--extended") ? 90 : 30;
  const roots = process.argv
    .slice(2)
    .filter((arg) => !["--farm-filesystem", "--extended"].includes(arg));
  if (roots.length !== 3)
    throw new Error("Pass installed baseline, identical control and candidate roots.");
  const order = [
    [0, 1, 2],
    [2, 1, 0],
    [1, 2, 0],
    [0, 2, 1],
    [2, 0, 1],
    [1, 0, 2],
  ];
  const results = {};
  for (const adapter of farm ? ["farmjs-filesystem"] : ["farmjs", "nuxt"]) {
    const samples = [[], [], []];
    let expected;
    for (let round = -6; round < measured; round++) {
      for (const i of order[(round + 6) % order.length]) {
        const worker = spawnSync(
          process.execPath,
          [fileURLToPath(import.meta.url), "--worker", adapter, roots[i]],
          { encoding: "utf8" },
        );
        assert.equal(worker.status, 0, worker.stderr);
        const { digest, ...timing } = JSON.parse(worker.stdout);
        expected ??= digest;
        assert.equal(digest, expected);
        if (round >= 0) samples[i].push(timing);
      }
    }
    results[adapter] = {
      digest: expected,
      baseline: samples[0],
      control: samples[1],
      candidate: samples[2],
    };
  }
  console.log(
    JSON.stringify(
      {
        node: process.version,
        cpu: cpus()[0].model,
        os: release(),
        warmups: 6,
        measured,
        results,
      },
      null,
      2,
    ),
  );
}
