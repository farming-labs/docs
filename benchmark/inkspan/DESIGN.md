# Inkspan section extraction

Expose section extraction as a standalone ESM npm package. A search indexer should be able to obtain heading titles, depths, line ranges and source text without installing a documentation framework. Docs core also consumes the outline so its existing anchor, generated-contract and malformed-MDX rules remain authoritative.

Use one Rust WebAssembly binary across Node architectures. Load it on first use in Node. Use the JavaScript reference parser in other runtimes. Compile the binary from locked source before packaging and check in the generated files in the independent Inkspan repository so installing docs works without Rust. Node consumers install the same tarball on every OS.

Rust handles a deliberately narrow grammar for flat ATX documents. Other documents use the GFM/MDX parser. For long fenced examples, ordinary prose and qualifying GFM table rows, Inkspan tests a shorter representation with the same line count. It accepts the outline only if the tree places every replacement in the expected block. Missing proof triggers a parse of the original source. Public offsets and content always refer to the original document.

Rust recognizes JSON string arrays in JSX attributes and string or upper-case identifier expressions in prose. It sends complete import blocks to the bundled remark parser for validation. General expressions, ambiguous inline syntax, reference definitions and invalid MDX go through the original-source parser. Docs core retains its malformed-MDX recovery. A single literal ATX heading can return directly in JavaScript before initializing Wasm.

Acceptance requires complete output equality on the real human and agent corpora, the existing section and search tests, and a clean standalone tarball install. Compare first-pass extraction against the current JS implementation with caches empty on both sides, reversing execution order, and use an identical-baseline control. Target at least twice the median extraction throughput on each corpus separately. Search latency and build time are separate measurements.

## Audience tags

Use complete source spans from Inkspan for static, whole-line audience wrappers. Match each candidate opening and closing token against the generic component index. For authored files, index the body after a closed YAML or TOML frontmatter block and translate spans back to UTF-16 offsets in the original source. Defer to the existing docs visitor for unclosed frontmatter, embedded JSX, framework directives, raw HTML, ambiguous matches, and syntax errors. Consecutive human and agent projections, agent block extraction, and command discovery share one read-only tag list for the same source, bounded to one million UTF-16 code units. Direct tag discovery returns fresh records to callers. Verify whole tag arrays, projections, and filesystem page records against the existing docs parser. Compare the complete scan against a JavaScript-only reuse control.
