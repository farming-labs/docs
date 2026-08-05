/** Stable identifier used by Farm core to discover the official docs runtime. */
export const FARM_DOCS_ADAPTER_ID = "@farming-labs/farmjs" as const;

/**
 * Versioned boundary between Farm core and the official adapter.
 *
 * Increment this only when Farm must change how it loads an adapter entrypoint.
 */
export const FARM_DOCS_ADAPTER_PROTOCOL = 1 as const;

export interface FarmDocsRuntimeAdapter {
  id: typeof FARM_DOCS_ADAPTER_ID;
  protocol: typeof FARM_DOCS_ADAPTER_PROTOCOL;
  server: "@farming-labs/farmjs/server";
  react: "@farming-labs/farmjs/react";
  vite: "@farming-labs/farmjs/vite";
}

/** Serializable runtime descriptor placed in Farm's resolved docs config. */
export const farmDocsRuntimeAdapter: FarmDocsRuntimeAdapter = Object.freeze({
  id: FARM_DOCS_ADAPTER_ID,
  protocol: FARM_DOCS_ADAPTER_PROTOCOL,
  server: "@farming-labs/farmjs/server",
  react: "@farming-labs/farmjs/react",
  vite: "@farming-labs/farmjs/vite",
});
