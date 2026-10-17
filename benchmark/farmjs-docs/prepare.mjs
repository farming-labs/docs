import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { corpusPage, prepare as prepareNext, repoRoot } from "../next-docs/prepare.mjs";

export const benchmarkRoot = dirname(fileURLToPath(import.meta.url));
export function prepare(provider, pages, appDir) {
  if (!provider.startsWith("farmjs")) return prepareNext(provider, pages, appDir);
  const staticPages = provider === "farmjs-ssg";
  const source = process.env.FARM_BENCH_SOURCE;
  const candidates = [
    "packages/farmjs/node_modules",
    "packages/next/node_modules",
    "packages/fumadocs/node_modules",
    "node_modules",
    "node_modules/.pnpm/node_modules",
  ].map((p) => join(repoRoot, p));
  const dependency = (name) => {
    const file = candidates.map((p) => join(p, name)).find(existsSync);
    if (!file) throw new Error(`Missing ${name}`);
    return realpathSync(file);
  };
  const link = (name, target) => {
    const file = join(appDir, "node_modules", name);
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) symlinkSync(relative(dirname(file), target), file, "dir");
  };
  const write = (name, value) => {
    const file = join(appDir, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, value);
  };
  const packages = {
    "@farming-labs/docs": join(repoRoot, "packages/docs"),
    "@farming-labs/theme": join(repoRoot, "packages/fumadocs"),
    "@farming-labs/farmjs": join(repoRoot, "packages/farmjs"),
    "@farm.js/core": source ? join(source, "packages/farm") : dependency("@farm.js/core"),
  };
  if (source) packages["@farm.js/cli"] = join(source, "packages/farm-cli");
  for (const name of [
    "react",
    "react-dom",
    "typescript",
    "@types/node",
    "@types/react",
    "@types/react-dom",
    "tailwindcss",
  ])
    packages[name] = dependency(name);
  for (const [name, target] of Object.entries(packages)) link(name, target);
  const versions = Object.fromEntries(
    Object.entries(packages).map(([name, target]) => [
      name,
      JSON.parse(readFileSync(join(target, "package.json"), "utf8")).version,
    ]),
  );
  write(
    "package.json",
    JSON.stringify(
      { name: "benchmark-farmjs", private: true, type: "module", dependencies: versions },
      null,
      2,
    ),
  );
  const deployment =
    provider === "farmjs-vercel"
      ? "{target:'vercel'}"
      : "{preset:'node-server',outputDir:'.output'}";
  write(
    "farm.config.ts",
    `import {defineConfig} from '@farm.js/core';\nimport {withDocs} from '@farming-labs/farmjs/config';\nexport default withDocs(defineConfig({deploy:${deployment},routeRules:{'/docs':{prerender:true},'/docs/**':{prerender:true}}}));\n`,
  );
  write(
    "docs.config.ts",
    `import {defineDocs} from '@farming-labs/docs';\nimport {fumadocs} from '@farming-labs/theme/default';\nexport default defineDocs({entry:'docs',contentDir:'${staticPages ? "content/docs" : "src/app/docs"}',nav:{title:'Docs',url:'/docs'},theme:fumadocs(),telemetry:false,review:false,ai:{enabled:false}});\n`,
  );
  write(
    "src/app/layout.tsx",
    `import './globals.css';\nexport default function Layout({children}:{children:React.ReactNode}){return <>{children}</>;}\n`,
  );
  write(
    "src/app/globals.css",
    `@import 'tailwindcss' source(none);\n@source './';\n@import '@farming-labs/theme/default/css';\n`,
  );
  write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          types: ["node", "react"],
          incremental: true,
        },
        include: ["src/**/*.tsx", "*.config.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );
  for (let i = 0; i < pages; i++) {
    const { name, source: content } = corpusPage(i);
    write(
      `${staticPages ? "content/docs" : "src/app/docs"}/${i ? name + "/" : ""}page.mdx`,
      content,
    );
    if (staticPages)
      write(
        `src/app/docs/${i ? name + "/" : ""}page.tsx`,
        `export const ssg=true;\nexport default function Page(){return null;}\n`,
      );
  }
  // Local compatibility probe only. Timed comparisons use the actual Farm CLI.
  write(
    "probe-build.mjs",
    `import {loadConfig,resolveConfig,build} from '@farm.js/core/internal/build-runtime';\nawait build(await resolveConfig(await loadConfig(process.cwd(),undefined,'production'),'production'),{root:process.cwd()});\n`,
  );
  return {
    provider,
    pages,
    versions,
    sourceBytes: Array.from({ length: pages }, (_, i) =>
      Buffer.byteLength(corpusPage(i).source),
    ).reduce((a, b) => a + b, 0),
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  console.log(
    JSON.stringify(prepare(process.argv[2], Number(process.argv[3]), resolve(process.argv[4]))),
  );
