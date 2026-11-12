/** Stable identifier used by Farm core to discover the official docs runtime. */
export const FARM_DOCS_ADAPTER_ID = "@farming-labs/farmjs" as const;

/**
 * Versioned boundary between Farm core and the official adapter.
 *
 * Increment this only when Farm must change how it loads an adapter entrypoint.
 */
export const FARM_DOCS_ADAPTER_PROTOCOL = 1 as const;

/**
 * What this adapter does beyond the protocol. Farm reads them from the descriptor; a host that
 * does not know one ignores it.
 *
 * - `guarded-pages`: the runtime takes Farm's `isPathGuarded` and keeps a page a path guard
 *   covers out of every surface that answers without running the guard. Farm otherwise refuses
 *   to build docs pages behind a path guard with an adapter.
 */
export const FARM_DOCS_ADAPTER_CAPABILITIES = Object.freeze(["guarded-pages"] as const);

/** Internal request marker used by the client runtime for page-data navigation. */
export const FARM_DOCS_NAVIGATION_HEADER = "x-farm-docs-navigation" as const;

export interface FarmDocsRuntimeAdapter {
  id: typeof FARM_DOCS_ADAPTER_ID;
  protocol: typeof FARM_DOCS_ADAPTER_PROTOCOL;
  capabilities: typeof FARM_DOCS_ADAPTER_CAPABILITIES;
  server: "@farming-labs/farmjs/server";
  react: "@farming-labs/farmjs/react";
  vite: "@farming-labs/farmjs/vite";
  edgeCompiler: "@farming-labs/farmjs/edge-compiler";
}

/** Serializable runtime descriptor placed in Farm's resolved docs config. */
export const farmDocsRuntimeAdapter: FarmDocsRuntimeAdapter = Object.freeze({
  id: FARM_DOCS_ADAPTER_ID,
  protocol: FARM_DOCS_ADAPTER_PROTOCOL,
  capabilities: FARM_DOCS_ADAPTER_CAPABILITIES,
  server: "@farming-labs/farmjs/server",
  react: "@farming-labs/farmjs/react",
  vite: "@farming-labs/farmjs/vite",
  edgeCompiler: "@farming-labs/farmjs/edge-compiler",
});
