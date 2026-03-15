module.exports = [
"[turbopack-node]/transforms/postcss.ts { CONFIG => \"[project]/oss/docs_/examples/next/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/a58df__pnpm_b4296ef2._.js",
  "chunks/[root-of-the-server]__6fb0e034._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts { CONFIG => \"[project]/oss/docs_/examples/next/postcss.config.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];