import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = dirname(fileURLToPath(import.meta.url));
const app = resolve(root, "artifacts/snapshot/apps/docs-farming");
const require = createRequire(app + "/package.json");
const matter = require("gray-matter");
const sourceConfig = require("tsx/cjs/api").require("./source.config.ts", app + "/package.json");
const definitions = new Map(
  ["docs", "examples", "elements", "design", "blog", "careers"].map((name) => [
    name,
    { ...sourceConfig[name], name },
  ]),
);
for (const plugin of sourceConfig.default.plugins ?? []) {
  if (plugin.name === "last-modified") plugin.config({ collections: definitions });
}
function gitDates(directory) {
  const dates = new Map();
  try {
    const options = { cwd: app, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
    const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], options).trim();
    const log = execFileSync(
      "git",
      ["-c", "core.quotepath=off", "log", "--format=commit:%aI", "--name-only", "--", directory],
      options,
    );
    let date;
    for (const line of log.split("\n")) {
      if (line.startsWith("commit:")) {
        const parsed = new Date(line.slice(7));
        date = Number.isNaN(parsed.getTime()) ? undefined : parsed;
      } else if (line && date) {
        const file = resolve(gitRoot, line);
        if (!dates.has(file)) dates.set(file, date);
      }
    }
  } catch {
    /* Unknown Git history produces undefined, matching the native loader. */
  }
  return dates;
}
// Preserve the original collection schemas, defaults and Date coercion.
const literal = (value) => {
  if (value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
  if (Array.isArray(value)) return `[${value.map(literal).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${JSON.stringify(k)}:${literal(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
};
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? walk(resolve(dir, x.name)) : [resolve(dir, x.name)],
  );
let code = `// @ts-nocheck\nimport {server} from 'fumadocs-mdx/runtime/server';\nimport type * as Config from '../source.config';\nconst create=server<typeof Config, import('fumadocs-mdx/runtime/types').InternalTypeConfig>();\n`;
const stats = {};
for (const collection of ["docs", "examples", "elements", "design", "blog", "careers"]) {
  const base = resolve(app, "content", collection);
  const docs = walk(base)
    .filter((x) => /\.mdx?$/.test(x))
    .sort();
  const metas = walk(base)
    .filter((x) => x.endsWith("/meta.json"))
    .sort();
  const head = {};
  const meta = {};
  const bodies = [];
  const definition = definitions.get(collection);
  const schema = collection === "docs" ? definition.docs.schema : definition.schema;
  const modifiedOption = (collection === "docs" ? definition.docs : definition).lastModified;
  const dates = modifiedOption === true ? gitDates("content/" + collection) : new Map();
  for (const file of docs) {
    const name = relative(base, file);
    head[name] = await schema.parseAsync(matter(readFileSync(file, "utf8")).data);
    const spec = "../" + relative(app, file);
    const modified =
      typeof modifiedOption === "function" ? await modifiedOption(file) : dates.get(file);
    bodies.push(
      `${JSON.stringify(name)}:()=>import(${JSON.stringify(spec)}).then(m=>({...m,frontmatter:${literal(head[name])},lastModified:${literal(modified)}}))`,
    );
  }
  for (const file of metas) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    meta[relative(base, file)] =
      collection === "docs" ? await definition.meta.schema.parseAsync(data) : data;
  }
  const prefix = `${JSON.stringify(collection)},${JSON.stringify("content/" + collection)},`;
  if (collection === "docs")
    code += `export const docs=await create.docsLazy(${prefix}${literal(meta)},${literal(head)},{${bodies.join(",")}});\n`;
  else if (["blog", "careers"].includes(collection))
    code += `export const ${collection}=await create.doc(${prefix}{${bodies.join(",")}});\n`;
  else
    code += `export const ${collection}=await create.docLazy(${prefix}${literal(head)},{${bodies.join(",")}});\n`;
  stats[collection] = { pages: docs.length, metaFiles: metas.length };
}
mkdirSync(resolve(app, ".source-farming"), { recursive: true });
const output = resolve(app, ".source-farming/server.ts");
if (!existsSync(output) || readFileSync(output, "utf8") !== code) writeFileSync(output, code);
writeFileSync(resolve(root, "artifacts/collections.json"), JSON.stringify(stats, null, 2) + "\n");
console.log(stats);
