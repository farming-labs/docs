"""Create the custom-shell Farming compiler port beside the native fixture."""
import json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SNAP=ROOT/'benchmark/assistant-ui/artifacts/snapshot'
BASE=SNAP/'apps/docs'; APP=SNAP/'apps/docs-farming'
if APP.exists(): raise SystemExit(f'Refusing to overwrite {APP}')
shutil.copytree(BASE,APP,symlinks=True,ignore=shutil.ignore_patterns('.next','.source','*.tsbuildinfo'))
for name,target in {
 '@farming-labs/docs':ROOT/'packages/docs','@farming-labs/next':ROOT/'packages/next','@farming-labs/theme':ROOT/'packages/fumadocs',
 '@next/mdx':ROOT/'packages/next/node_modules/@next/mdx','@mdx-js/loader':ROOT/'packages/next/node_modules/@mdx-js/loader',
 'remark-gfm':ROOT/'node_modules/remark-gfm','remark-frontmatter':ROOT/'node_modules/remark-frontmatter','remark-mdx-frontmatter':ROOT/'node_modules/remark-mdx-frontmatter',
 'gray-matter':ROOT/'packages/next/node_modules/gray-matter',
}.items():
 link=APP/'node_modules'/name;link.parent.mkdir(parents=True,exist_ok=True)
 if link.is_symlink():link.unlink()
 link.symlink_to(target.resolve(),target_is_directory=True)
shutil.move(APP/'app/(docs)/docs',APP/'app/docs')
p=APP/'mdx-components.tsx';p.write_text(p.read_text()+'\nexport function useMDXComponents() { return getMDXComponents({}); }\n')
p=APP/'tsconfig.json';ts=json.loads(p.read_text());ts['compilerOptions']['paths']['fumadocs-mdx:collections/*']=['./.source-farming/*'];p.write_text(json.dumps(ts,indent=2)+'\n')
(APP/'docs.config.ts').write_text('import {defineDocs} from "@farming-labs/docs";\nexport default defineDocs({entry:"docs",contentDir:"content/docs",telemetry:false,review:false,mcp:false,ai:{enabled:false}});\n')
p=APP/'next.config.ts';s=p.read_text().replace('import { createMDX } from "fumadocs-mdx/next";','import { withDocs } from "@farming-labs/next/config";\nimport { resolve } from "node:path";\nimport {execFileSync} from "node:child_process";')
s=s.replace('const withMDX = createMDX();\n\nexport default withAui(withMDX(config));','''const docsConfig = withDocs(config);
for (const rule of Object.values(docsConfig.turbopack?.rules ?? {})) {
  for (const item of Array.isArray(rule) ? rule : [rule]) {
    if (!item || typeof item !== "object" || !("loaders" in item)) continue;
    for (const loader of item.loaders ?? []) {
      if (typeof loader !== "object" || !loader.options) continue;
      const options = loader.options as { remarkPlugins?: unknown[]; rehypePlugins?: unknown[] };
      if (!options.remarkPlugins) continue;
      options.remarkPlugins.push([resolve("benchmark-plugins/remark-image.mjs"), {useImport:true}], resolve("benchmark-plugins/remark-code-tab.mjs"), resolve("benchmark-plugins/remark-npm.mjs"), resolve("benchmark-plugins/remark-mermaid.mjs"), [resolve("benchmark-plugins/remark-structure.mjs"), {exportAs:"structuredData"}]);
      options.rehypePlugins = (options.rehypePlugins ?? []).map((plugin) => Array.isArray(plugin) && String(plugin[0]).includes("rehype-code") ? resolve("benchmark-plugins/rehype-code.mjs") : plugin);
    }
  }
}
export default withAui(docsConfig);''')
p.write_text(s)
plugins=APP/'benchmark-plugins';plugins.mkdir()
(plugins/'remark-mermaid.mjs').write_text('''import {visit} from "unist-util-visit";
export default function remarkMermaid(){return tree=>visit(tree,"code",(node,index,parent)=>{if(node.lang!=="mermaid"||!node.value.trim()||parent===undefined||index===undefined)return;parent.children[index]={type:"mdxJsxFlowElement",name:"MermaidDiagram",attributes:[],children:[{type:"text",value:node.value}]};});}
''')
(plugins/'remark-structure.mjs').write_text('export {remarkStructure as default} from "fumadocs-core/mdx-plugins/remark-structure";\n')
(plugins/'rehype-code.mjs').write_text('''import {rehypeCode,rehypeCodeDefaultOptions} from "fumadocs-core/mdx-plugins";
import {transformerMetaHighlight} from "@shikijs/transformers";
export default function code(){return rehypeCode({lazy:true,langs:["ts","js","html","tsx","mdx","bash"],themes:{light:"catppuccin-latte",dark:"catppuccin-mocha"},transformers:[...(rehypeCodeDefaultOptions.transformers??[]),{name:"line-numbers",pre(node){node.properties["data-line-numbers"]="";}},transformerMetaHighlight()]});}
''')
for name,export in [('image','remarkImage'),('code-tab','remarkCodeTab'),('npm','remarkNpm')]:
 (plugins/f'remark-{name}.mjs').write_text(f'export {{{export} as default}} from "fumadocs-core/mdx-plugins";\n')
print(APP)
