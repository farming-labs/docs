import type { DocsConfig } from "@farming-labs/docs";
import { resolveApiReferenceConfig } from "@farming-labs/docs/runtime";
import {
  SidebarTabsDropdown,
  type SidebarTabWithProps,
} from "fumadocs-ui/components/sidebar/tabs/dropdown";
import type { ReactNode } from "react";

// Shared navigation must not import either API page renderer into ordinary docs routes.
export function getDocsUrl(config: DocsConfig): string {
  if (typeof config.nav?.url === "string") return config.nav.url;
  return `/${config.entry ?? "docs"}`;
}

function SwitcherGlyph({ kind }: { kind: "docs" | "api" }) {
  const isApi = kind === "api";

  return (
    <span className="fd-api-reference-switcher-glyph" data-kind={kind} aria-hidden="true">
      {isApi ? (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M8 8L4 12L8 16M16 8L20 12L16 16M13.5 6L10.5 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M4.75 6.75C4.75 5.64543 5.64543 4.75 6.75 4.75H11.25V19.25H6.75C5.64543 19.25 4.75 18.3546 4.75 17.25V6.75ZM12.75 4.75H17.25C18.3546 4.75 19.25 5.64543 19.25 6.75V17.25C19.25 18.3546 18.3546 19.25 17.25 19.25H12.75V4.75Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export function ApiReferenceSwitcher({
  docsUrl,
  apiUrl,
}: {
  docsUrl: string;
  apiUrl: string;
  current: "docs" | "api";
  config: DocsConfig;
}) {
  const options: SidebarTabWithProps[] = [
    {
      url: docsUrl,
      title: "Documentation",
      description: "Guides & concepts",
      icon: <SwitcherGlyph kind="docs" />,
    },
    {
      url: apiUrl,
      title: "API Reference",
      description: "Endpoints & examples",
      icon: <SwitcherGlyph kind="api" />,
    },
  ];

  return (
    <SidebarTabsDropdown className="fd-api-reference-switcher w-full mb-4" options={options} />
  );
}

export function getExistingSidebarBanner(config: DocsConfig): unknown {
  if (!config.sidebar || config.sidebar === true) return undefined;
  return config.sidebar.banner;
}

export function mergeBanner(existing: unknown, next: ReactNode) {
  if (!existing) return next;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {existing as ReactNode}
      {next}
    </div>
  );
}

export function withNextApiReferenceBanner(config: DocsConfig): DocsConfig {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (!apiReference.enabled) return config;
  if (config.sidebar === false) return config;

  const docsUrl = getDocsUrl(config);
  const apiUrl = `/${apiReference.path}`;
  const switcher = (
    <ApiReferenceSwitcher docsUrl={docsUrl} apiUrl={apiUrl} current="docs" config={config} />
  );
  const existingBanner = getExistingSidebarBanner(config);
  const banner = mergeBanner(existingBanner, switcher);

  if (!config.sidebar || config.sidebar === true) {
    return {
      ...config,
      sidebar: {
        banner,
      },
    };
  }

  return {
    ...config,
    sidebar: {
      ...config.sidebar,
      banner,
    },
  };
}
