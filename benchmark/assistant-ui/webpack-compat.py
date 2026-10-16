from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/'benchmark/assistant-ui/artifacts/snapshot/apps/docs-farming'
p=APP/'next.config.ts';s=p.read_text();start=s.index('execFileSync(process.execPath,') if 'execFileSync(process.execPath,' in s else s.index('const docsConfig = withDocs(config);')
s=s[:start]+'''execFileSync(process.execPath,[resolve("../../../../collections.mjs")],{stdio:"pipe"});
const originalRewrites = config.rewrites;
const docsConfig = withDocs(config);
const mergedRewrites = docsConfig.rewrites;
docsConfig.rewrites = async () => {
  const original = await originalRewrites?.();
  const merged = await mergedRewrites?.();
  if (!original || Array.isArray(original) || !merged || Array.isArray(merged)) return merged ?? [];
  const seen = new Set<string>();
  return {...merged, beforeFiles: [...(original.beforeFiles ?? []), ...(merged.beforeFiles ?? [])].filter(rule => {
    const key=JSON.stringify(rule);if(seen.has(key)) return false;seen.add(key);return true;
  })};
};
function configureMdx(options: {remarkPlugins?: unknown[];rehypePlugins?: unknown[]}) {
  if (!options.remarkPlugins || options.remarkPlugins.some(p=>typeof p === "string" && p.endsWith("remark-mermaid.mjs"))) return;
  options.remarkPlugins.push([resolve("benchmark-plugins/remark-image.mjs"), {useImport:true}], resolve("benchmark-plugins/remark-code-tab.mjs"), resolve("benchmark-plugins/remark-npm.mjs"), resolve("benchmark-plugins/remark-mermaid.mjs"), [resolve("benchmark-plugins/remark-structure.mjs"), {exportAs:"structuredData"}]);
  options.rehypePlugins = (options.rehypePlugins ?? []).map(plugin => Array.isArray(plugin) && String(plugin[0]).includes("rehype-code") ? resolve("benchmark-plugins/rehype-code.mjs") : plugin);
}
for (const rule of Object.values(docsConfig.turbopack?.rules ?? {})) {
  for (const item of Array.isArray(rule) ? rule : [rule]) {
    if (!item || typeof item !== "object" || !("loaders" in item)) continue;
    for (const loader of item.loaders ?? []) {
      if (typeof loader === "object" && loader.options) configureMdx(loader.options);
    }
  }
}
const docsWebpack=docsConfig.webpack;
docsConfig.webpack=(webpackConfig,context)=>{
  const result=docsWebpack?.(webpackConfig,context) ?? webpackConfig;
  function visit(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {for (const item of value) visit(item);return;}
    const item=value as {loader?: string;options?: {remarkPlugins?: unknown[];rehypePlugins?: unknown[]};use?:unknown;oneOf?:unknown;rules?:unknown};
    if (item.loader?.includes("mdx") && item.options) configureMdx(item.options);
    visit(item.use);visit(item.oneOf);visit(item.rules);
  }
  // The stock package-root alias bypasses package exports for source/page-tree.
  // This port keeps the app's installed Fumadocs dependency graph intact.
  for (const key of Object.keys(result.resolve?.alias ?? {})) {
    if (key === "fumadocs-core" || key.startsWith("fumadocs-core/")) delete result.resolve.alias[key];
  }
  visit(result.module?.rules);
  return result;
};
export default withAui(docsConfig);
'''
p.write_text(s)
