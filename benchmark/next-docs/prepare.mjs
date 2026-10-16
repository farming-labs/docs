import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  symlinkSync,
  realpathSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const benchmarkRoot = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(benchmarkRoot, "../..");
const nextModules = join(repoRoot, "packages/next/node_modules");
const themeModules = join(repoRoot, "packages/fumadocs/node_modules");
const rootModules = join(repoRoot, "node_modules");
const depsModules = join(benchmarkRoot, "deps/node_modules");
const candidates = [
  nextModules,
  themeModules,
  rootModules,
  join(rootModules, ".pnpm/node_modules"),
  depsModules,
];
function dependency(name) {
  const target = candidates.map((base) => join(base, name)).find(existsSync);
  if (!target)
    throw new Error(
      `Missing workspace dependency: ${name}. Install the Next adapter workspace dependencies first.`,
    );
  return realpathSync(target);
}
function link(base, name, target) {
  const file = join(base, name);
  mkdirSync(dirname(file), { recursive: true });
  if (base === rootModules && existsSync(file) && realpathSync(file) !== realpathSync(target)) {
    throw new Error(`Conflicting root loader ${name}; use a clean checkout for this benchmark.`);
  }
  if (!existsSync(file)) symlinkSync(relative(dirname(file), target), file, "dir");
}
export function corpusPage(index) {
  const name = index === 0 ? "index" : `page-${String(index).padStart(4, "0")}`;
  const title = `Benchmark page ${String(index).padStart(4, "0")}`;
  const blocks = [
    `---\ntitle: ${title}\ndescription: Reference documentation for benchmark topic ${index}.\norder: ${index}\n---\n\n# ${title}\n`,
  ];
  for (let section = 0; section < 6; section++) {
    blocks.push(
      `## Section ${section + 1}\n\n` +
        `This reference explains how to configure topic ${index} safely. Each request validates the input, preserves existing behavior, and returns a predictable result. The examples use the same source content in both documentation frameworks. `.repeat(
          4,
        ),
    );
    blocks.push(
      `\n\n| Setting | Default | Description |\n| --- | --- | --- |\n| retries | 3 | Maximum attempts |\n| timeout | 5000 | Milliseconds |\n\n`,
    );
    blocks.push(
      "```" +
        (section % 2 ? "bash" : "ts") +
        "\n" +
        (section % 2
          ? `npm install example-sdk\nexport TOPIC=${index}\nexample-sdk validate --strict\n`
          : `interface Options { retries: number; timeout: number; }\nexport async function loadTopic(options: Options) {\n  const response = await fetch("/api/topics/${index}");\n  if (!response.ok) throw new Error("Request failed");\n  return response.json();\n}\n`) +
        "```\n\n",
    );
  }
  blocks.push("[Return to the first page](/docs)\n");
  return { name, title, source: blocks.join("\n") };
}
export function prepare(provider, pages, appDir) {
  if (!["fumadocs", "farming", "fumadocs-file-routes"].includes(provider))
    throw new Error(`Unknown provider: ${provider}`);
  const farming = provider === "farming";
  mkdirSync(appDir, { recursive: true });
  const write = (file, source) => {
    const path = join(appDir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  };
  const common = [
    "next",
    "react",
    "react-dom",
    "typescript",
    "@types/node",
    "@types/react",
    "@types/react-dom",
    "@types/mdx",
    "@mdx-js/react",
    "@next/mdx",
    "@mdx-js/loader",
    "@mdx-js/mdx",
    "fumadocs-core",
    "fumadocs-ui",
    "remark-gfm",
    "remark-frontmatter",
    "remark-mdx-frontmatter",
    "@tailwindcss/postcss",
    "tailwindcss",
  ];
  for (const name of common) link(join(appDir, "node_modules"), name, dependency(name));
  for (const [name, target] of Object.entries({
    "@farming-labs/docs": "packages/docs",
    "@farming-labs/next": "packages/next",
    "@farming-labs/theme": "packages/fumadocs",
  }))
    link(join(appDir, "node_modules"), name, join(repoRoot, target));
  for (const name of [
    "fumadocs-core",
    "next",
    "react",
    "@types/mdx",
    "@types/react",
    "@types/mdast",
    "mdast-util-directive",
  ])
    link(depsModules, name, dependency(name));
  const fumadocsMdx = join(depsModules, "fumadocs-mdx");
  if (!existsSync(fumadocsMdx))
    throw new Error(
      "Run npm ci --prefix benchmark/next-docs/deps --legacy-peer-deps --ignore-scripts",
    );
  link(join(appDir, "node_modules"), "fumadocs-mdx", fumadocsMdx);
  // Next's loader also resolves plugins from the Turbopack workspace root.
  for (const name of ["remark-gfm", "remark-frontmatter", "remark-mdx-frontmatter"])
    link(rootModules, name, dependency(name));
  link(rootModules, "fumadocs-mdx", fumadocsMdx);
  const versions = Object.fromEntries(
    common.map((name) => [
      name,
      JSON.parse(readFileSync(join(dependency(name), "package.json"), "utf8")).version,
    ]),
  );
  versions["fumadocs-mdx"] = JSON.parse(
    readFileSync(join(fumadocsMdx, "package.json"), "utf8"),
  ).version;
  for (const name of ["@farming-labs/docs", "@farming-labs/next", "@farming-labs/theme"])
    versions[name] = JSON.parse(
      readFileSync(join(appDir, "node_modules", name, "package.json"), "utf8"),
    ).version;
  write(
    "package.json",
    JSON.stringify(
      { name: `benchmark-${provider}`, private: true, type: "module", dependencies: versions },
      null,
      2,
    ),
  );
  write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "react-jsx",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: { "@/*": ["./*"] },
        },
        include: [
          "next-env.d.ts",
          "**/*.ts",
          "**/*.tsx",
          ".next/types/**/*.ts",
          ".next/dev/types/**/*.ts",
        ],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );
  const nextConfig = `{experimental: {cpus: 2}, turbopack: {root: ${JSON.stringify(repoRoot)}}}`;
  write(
    "next.config.mjs",
    farming
      ? `import {withDocs} from '@farming-labs/next/config';\nexport default withDocs(${nextConfig});\n`
      : `import {createMDX} from 'fumadocs-mdx/next';\nexport default createMDX()(${nextConfig});\n`,
  );
  write("postcss.config.mjs", `export default {plugins: {'@tailwindcss/postcss': {}}};\n`);
  write(
    "app/global.css",
    `@import 'tailwindcss' source(none);\n@source '../app';\n@source '../content';\n@source '../mdx-components.tsx';\n` +
      (farming
        ? `@import '@farming-labs/theme/default/css';\n`
        : `@import 'fumadocs-ui/css/neutral.css';\n@import 'fumadocs-ui/css/preset.css';\n`),
  );
  write(
    "app/layout.tsx",
    `import {RootProvider} from ${JSON.stringify(farming ? "@farming-labs/theme" : "fumadocs-ui/provider/next")};\nimport './global.css';\nexport default function Layout({children}: {children: React.ReactNode}) {return <html lang="en" suppressHydrationWarning><body><RootProvider>{children}</RootProvider></body></html>}\n`,
  );
  if (farming) {
    write(
      "docs.config.ts",
      `import {defineDocs} from '@farming-labs/docs';\nimport {fumadocs} from '@farming-labs/theme/default';\nexport default defineDocs({entry:'docs',theme:fumadocs(),telemetry:false,review:false,ai:{enabled:false}});\n`,
    );
  } else {
    write(
      "source.config.ts",
      `import {defineDocs,defineConfig} from 'fumadocs-mdx/config';\nexport const docs=defineDocs({dir:'content/docs'});\nexport default defineConfig({mdxOptions:{rehypeCodeOptions:{themes:{light:'github-light',dark:'github-dark'}}}});\n`,
    );
    write(
      "lib/source.ts",
      `import {docs} from '../.source/server';\nimport {loader} from 'fumadocs-core/source';\nexport const source=loader({baseUrl:'/docs',source:docs.toFumadocsSource()});\n`,
    );
    write(
      "app/docs/layout.tsx",
      `import {DocsLayout} from 'fumadocs-ui/layouts/docs';\nimport {source} from '@/lib/source';\nexport default function Layout({children}:{children:React.ReactNode}) {return <DocsLayout tree={source.pageTree} nav={{title:'Docs',url:'/docs'}}>{children}</DocsLayout>}\n`,
    );
    write(
      "app/api/search/route.ts",
      `import {createFromSource} from 'fumadocs-core/search/server';\nimport {source} from '@/lib/source';\nexport const {GET}=createFromSource(source);\n`,
    );
    write(
      "lib/docs-page.tsx",
      `import {DocsPage,DocsBody} from 'fumadocs-ui/layouts/docs/page';\nimport defaultMdxComponents from 'fumadocs-ui/mdx';\nimport {source} from './source';\nimport {notFound} from 'next/navigation';\nexport function renderPage(slug?:string[]) {const page=source.getPage(slug);if(!page)notFound();const Content=page.data.body;return <DocsPage toc={page.data.toc}><DocsBody><Content components={defaultMdxComponents}/></DocsBody></DocsPage>;}\nexport function metadata(slug?:string[]) {const page=source.getPage(slug);if(!page)notFound();return {title:page.data.title,description:page.data.description};}\n`,
    );
    if (provider === "fumadocs")
      write(
        "app/docs/[[...slug]]/page.tsx",
        `import {renderPage,metadata} from '@/lib/docs-page';\nimport {source} from '@/lib/source';\nexport default async function Page({params}:{params:Promise<{slug?:string[]}>}) {return renderPage((await params).slug);}\nexport async function generateMetadata({params}:{params:Promise<{slug?:string[]}>}) {return metadata((await params).slug);}\nexport function generateStaticParams(){return source.generateParams();}\n`,
      );
  }
  for (let i = 0; i < pages; i++) {
    const { name, source } = corpusPage(i);
    write(farming ? `app/docs/${i ? name + "/" : ""}page.mdx` : `content/docs/${name}.mdx`, source);
    if (provider === "fumadocs-file-routes")
      write(
        `app/docs/${i ? name + "/" : ""}page.tsx`,
        `import {renderPage,metadata as getMetadata} from '@/lib/docs-page';\nconst slug:string[]=${JSON.stringify(i ? [name] : [])};\nexport const metadata=getMetadata(slug);\nexport default function Page(){return renderPage(slug);}\n`,
      );
  }
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
