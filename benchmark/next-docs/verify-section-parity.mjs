import { pathToFileURL } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { deepStrictEqual } from 'node:assert/strict';
import { createHash } from 'node:crypto';
const [beforePath, afterPath, corpus] = process.argv.slice(2);
const before = (await import(pathToFileURL(beforePath))).parseDocsMarkdownSections;
const after = (await import(pathToFileURL(afterPath))).parseDocsMarkdownSections;
const files = readdirSync(corpus, { recursive: true }).filter(f=>/\.mdx?$/.test(f)).sort();
const hash = createHash('sha256');
let comparisons = 0;
for (const file of files) {
  const source = readFileSync(join(corpus,file), 'utf8');
  hash.update(file).update('\0').update(source).update('\0');
  for (const content of [source, source+'\n\n{', source+'\n\n## Edited title\n\nFresh content.']) {
    const expected = before(content);
    deepStrictEqual(after(content), expected, file);
    const actual = after(content);
    deepStrictEqual(actual, expected, file+' repeat');
    if (actual.length) actual[0].content = 'caller mutation';
    actual.length = 0;
    deepStrictEqual(after(content), expected, file+' mutation isolation');
    comparisons += 3;
  }
}
console.log(JSON.stringify({files:files.length, comparisons, corpusSha256:hash.digest('hex'), parity:true},null,2));
