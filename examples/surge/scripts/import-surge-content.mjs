import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const sourceRoot =
  process.env.SURGE_SOURCE_DIR || path.resolve(appRoot, "../../../surge-docs");
const defaultOpenApiUrl = "https://app.stainless.com/api/spec/documented/surge/openapi.documented.yml";

const titleByDir = new Map([
  ["api-reference", "API Reference"],
  ["api-reference/endpoint", "Endpoints"],
  ["api-reference/endpoint/accounts", "Accounts"],
  ["api-reference/endpoint/audiences", "Audiences"],
  ["api-reference/endpoint/blasts", "Blasts"],
  ["api-reference/endpoint/campaigns", "Campaigns"],
  ["api-reference/endpoint/contacts", "Contacts"],
  ["api-reference/endpoint/messages", "Messages"],
  ["api-reference/endpoint/phone-numbers", "Phone Numbers"],
  ["api-reference/endpoint/recordings", "Recordings"],
  ["api-reference/endpoint/users", "Users"],
  ["api-reference/endpoint/verifications", "Verifications"],
  ["api-reference/webhooks", "Webhooks"],
  ["guides", "Guides"],
  ["guides/carrier-registration", "Carrier Registration"],
  ["ui", "UI Components"],
  ["ui/components", "Components"],
]);

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/");
}

function humanize(value) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bUi\b/g, "UI");
}

function parseMatter(source) {
  if (!source.startsWith("---\n")) {
    return { data: {}, content: source };
  }

  const end = source.indexOf("\n---\n", 4);
  if (end === -1) {
    return { data: {}, content: source };
  }

  const rawFrontmatter = source.slice(4, end).trim();
  const content = source.slice(end + 5).trimStart();
  const data = {};

  for (const line of rawFrontmatter.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    data[key] = value;
  }

  return { data, content };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyRecursive(source, destination) {
  await ensureDir(destination);
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyRecursive(sourcePath, destinationPath);
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
  }
}

async function resolveOpenApiSpecText() {
  const docsConfigPath = path.join(sourceRoot, "docs.json");
  let specReference = defaultOpenApiUrl;

  if (await exists(docsConfigPath)) {
    const docsConfig = JSON.parse(await fs.readFile(docsConfigPath, "utf8"));
    if (typeof docsConfig.openapi === "string" && docsConfig.openapi.trim()) {
      specReference = docsConfig.openapi.trim();
    }
  }

  if (/^https?:\/\//i.test(specReference)) {
    return fetch(specReference).then((response) => response.text());
  }

  const localSpecPath = path.isAbsolute(specReference)
    ? specReference
    : path.join(sourceRoot, specReference);

  return fs.readFile(localSpecPath, "utf8");
}

function buildPageMdx({ title, description, body, icon }) {
  const frontmatter = ["---", `title: ${JSON.stringify(title)}`];
  if (description) frontmatter.push(`description: ${JSON.stringify(description)}`);
  if (icon) frontmatter.push(`icon: ${JSON.stringify(icon)}`);
  frontmatter.push("---", "");
  return `${frontmatter.join("\n")}${body.trim()}\n`;
}

function normalizeSourceMdx(content) {
  return content.replace(/<Link\s+href="([^"]+)"\s*>([\s\S]*?)<\/Link>/g, (_, href, label) => {
    const text = label.replace(/\s+/g, " ").trim();
    return `[${text}](${href})`;
  });
}

async function main() {
  const sourceExists = await exists(sourceRoot);
  if (!sourceExists) {
    throw new Error(`Surge docs source not found at ${sourceRoot}`);
  }

  await copyRecursive(path.join(sourceRoot, "images"), path.join(appRoot, "public", "images"));
  await copyRecursive(path.join(sourceRoot, "logo"), path.join(appRoot, "public", "logo"));
  await fs.copyFile(path.join(sourceRoot, "logo.svg"), path.join(appRoot, "public", "logo.svg"));
  await fs.copyFile(
    path.join(sourceRoot, "favicon.png"),
    path.join(appRoot, "public", "favicon.png"),
  );
  await fs.copyFile(
    path.join(sourceRoot, "favicon.svg"),
    path.join(appRoot, "public", "favicon.svg"),
  );

  const specText = await resolveOpenApiSpecText();
  await fs.writeFile(path.join(appRoot, "openapi", "surge.yml"), specText, "utf8");

  const pages = [];
  const allDirs = new Set();
  const sectionPagePaths = [
    "api-reference/page.mdx",
    "guides/page.mdx",
    "ui/page.mdx",
  ].map((value) => path.join(appRoot, "app", value));

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith(".mdx")) continue;
      pages.push(fullPath);
    }
  }

  await walk(sourceRoot);

  const dirChildren = new Map();

  for (const sourceFile of pages) {
    const relativePath = normalizeSlashes(path.relative(sourceRoot, sourceFile));
    const targetDir = path.join(appRoot, "app", relativePath.replace(/\.mdx$/, ""));
    const targetFile = path.join(targetDir, "page.mdx");
    const raw = await fs.readFile(sourceFile, "utf8");
    const { data, content } = parseMatter(raw);
    const relativeDir = normalizeSlashes(path.relative(path.join(appRoot, "app"), targetDir));
    const parentDir = normalizeSlashes(path.dirname(relativeDir));

    await ensureDir(targetDir);
    allDirs.add(relativeDir);

    if (parentDir && parentDir !== ".") {
      const siblings = dirChildren.get(parentDir) ?? [];
      siblings.push({
        path: `/${relativeDir}`,
        title: data.title || humanize(path.basename(relativeDir)),
      });
      dirChildren.set(parentDir, siblings);
      allDirs.add(parentDir);
    }

    let body = normalizeSourceMdx(content.trim());
    if (data.openapi) {
      body = `<ApiOperation operation=${JSON.stringify(data.openapi)} />`;
    }

    await fs.writeFile(
      targetFile,
      buildPageMdx({
        title: data.title || humanize(path.basename(relativeDir)),
        description: data.description,
        body,
      }),
      "utf8",
    );
  }

  for (const dir of Array.from(allDirs).sort((left, right) => left.length - right.length)) {
    const targetFile = path.join(appRoot, "app", dir, "page.mdx");
    if (await exists(targetFile)) continue;

    if (sectionPagePaths.includes(targetFile)) continue;

    const children = (dirChildren.get(dir) ?? []).sort((left, right) =>
      left.title.localeCompare(right.title),
    );
    const title = titleByDir.get(dir) || humanize(path.basename(dir));

    const body =
      children.length > 0
        ? [
            `# ${title}`,
            "",
            `Browse the ${title.toLowerCase()} pages in this section.`,
            "",
            "<div className=\"surge-section-links\">",
            ...children.map((child) => `  <a href="${child.path}">${child.title}</a>`),
            "</div>",
          ].join("\n")
        : `# ${title}\n`;

    await ensureDir(path.dirname(targetFile));
    await fs.writeFile(targetFile, buildPageMdx({ title, body }), "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
