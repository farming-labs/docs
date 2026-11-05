import { describe, expect, it, vi } from "vitest";
import { createTheme } from "./create-theme.js";
import { applyThemeConfigDefaults, defineDocs } from "./define-docs.js";
import type { DocsConfig } from "./types.js";

describe("defineDocs", () => {
  it("keeps the page content footer", () => {
    const footer = { type: "p", props: { children: "MIT License" } };
    expect(defineDocs({ entry: "docs", footer }).footer).toBe(footer);
  });

  it("keeps the docs roots", () => {
    const roots = [{ entry: "statewire/docs", nav: { title: "Statewire" } }];
    expect(defineDocs({ entry: "docs", roots }).roots).toBe(roots);
  });

  it("preserves feedback and copy callbacks in the normalized config", () => {
    const onCopyClick = vi.fn();
    const onFeedback = vi.fn();
    const onAgentFeedback = vi.fn();
    const authenticateMcp = vi.fn();
    const actionsComponent = { type: "div" };

    const config = defineDocs({
      entry: "docs",
      onCopyClick,
      feedback: {
        enabled: true,
        onFeedback,
        agent: {
          enabled: true,
          route: "/api/docs/agent/feedback",
          onFeedback: onAgentFeedback,
        },
      },
      search: {
        provider: "typesense",
        baseUrl: "https://typesense.example.com",
        collection: "docs",
        apiKey: "search-key",
      },
      mcp: {
        enabled: true,
        route: "/api/docs/mcp",
        security: {
          authenticate: authenticateMcp,
          protectedResource: {
            authorizationServers: ["https://auth.example.com"],
            scopesSupported: ["docs:read"],
            requiredScopes: ["docs:read"],
          },
        },
      },
      changelog: {
        enabled: true,
        path: "changelog",
        description: "Latest changes",
        actionsComponent,
      },
    });

    expect(config.onCopyClick).toBe(onCopyClick);
    expect(config.feedback).toEqual({
      enabled: true,
      onFeedback,
      agent: {
        enabled: true,
        route: "/api/docs/agent/feedback",
        onFeedback: onAgentFeedback,
      },
    });
    expect(config.search).toEqual({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "docs",
      apiKey: "search-key",
    });
    expect(config.mcp).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
      security: {
        authenticate: authenticateMcp,
        protectedResource: {
          authorizationServers: ["https://auth.example.com"],
          scopesSupported: ["docs:read"],
          requiredScopes: ["docs:read"],
        },
      },
    });
    expect(config.changelog).toEqual({
      enabled: true,
      path: "changelog",
      description: "Latest changes",
      actionsComponent,
    });
  });

  it("keeps analytics and observability as separate event stream configs", () => {
    const onAnalyticsEvent = vi.fn();
    const onObservabilityEvent = vi.fn();

    const config = defineDocs({
      entry: "docs",
      analytics: {
        console: "info",
        onEvent: onAnalyticsEvent,
      },
      telemetry: {
        enabled: true,
        endpoint: "https://telemetry.example.com/events",
      },
      observability: {
        console: "debug",
        onEvent: onObservabilityEvent,
      },
    });

    expect(config.analytics).toEqual({
      console: "info",
      onEvent: onAnalyticsEvent,
    });
    expect(config.telemetry).toEqual({
      enabled: true,
      endpoint: "https://telemetry.example.com/events",
    });
    expect(config.observability).toEqual({
      console: "debug",
      onEvent: onObservabilityEvent,
    });
    expect(config.analytics).not.toBe(config.observability);
  });

  it("preserves cloud settings for CLI docs.json materialization", () => {
    const config = defineDocs({
      entry: "docs",
      cloud: {
        apiKey: {
          env: "CUSTOM_DOCS_CLOUD_KEY",
        },
        preview: {
          enabled: true,
        },
        publish: {
          mode: "draft-pr",
          baseBranch: "main",
        },
      },
    });

    expect(config.cloud).toEqual({
      apiKey: {
        env: "CUSTOM_DOCS_CLOUD_KEY",
      },
      preview: {
        enabled: true,
      },
      publish: {
        mode: "draft-pr",
        baseBranch: "main",
      },
    });
  });
});

describe("theme config defaults", () => {
  const theme = createTheme({
    name: "assistant-ui",
    ui: { layout: { header: { placement: "top" } } },
    configDefaults: {
      nav: { links: [{ label: "Docs", href: "/docs" }] },
      breadcrumb: false,
      sidebar: { flat: true, collapsible: false },
      pageActions: {
        copyMarkdown: true,
        openDocs: { providers: [{ name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={url}" }] },
        position: "above-title",
      },
    },
  });

  it("turns on the theme's page options when the config leaves them unset", () => {
    const config = defineDocs({ entry: "docs", theme: theme() });

    expect(config.nav).toEqual({ links: [{ label: "Docs", href: "/docs" }] });
    expect(config.breadcrumb).toBe(false);
    expect(config.sidebar).toEqual({ flat: true, collapsible: false });
    expect(config.pageActions).toMatchObject({ copyMarkdown: true, position: "above-title" });
  });

  it("lets the config win, merging objects over the theme's one key deep", () => {
    const config = defineDocs({
      entry: "docs",
      theme: theme(),
      nav: { title: "Acme" },
      breadcrumb: true,
      sidebar: false,
      pageActions: {
        copyMarkdown: false,
        openDocs: { providers: [] },
        alignment: undefined,
        position: undefined,
      },
    });

    expect(config.nav).toEqual({ title: "Acme", links: [{ label: "Docs", href: "/docs" }] });
    expect(config.breadcrumb).toBe(true);
    expect(config.sidebar).toBe(false);
    expect(config.pageActions).toEqual({
      copyMarkdown: false,
      openDocs: { providers: [] },
      position: "above-title",
    });
  });

  it("lets a theme supply MDX components that a site replaces one by one", () => {
    const ThemeCallout = () => null;
    const ThemePre = () => null;
    const SiteCallout = () => null;
    const withComponents = createTheme({
      name: "components",
      configDefaults: { components: { Callout: ThemeCallout, pre: ThemePre } },
    });

    expect(defineDocs({ entry: "docs", theme: withComponents() }).components).toEqual({
      Callout: ThemeCallout,
      pre: ThemePre,
    });
    expect(
      defineDocs({
        entry: "docs",
        theme: withComponents(),
        components: { Callout: SiteCallout },
      }).components,
    ).toEqual({ Callout: SiteCallout, pre: ThemePre });
  });

  it("keeps theme factory overrides and applies them once however often it runs", () => {
    const overridden = theme({ configDefaults: { breadcrumb: true } });
    const once = applyThemeConfigDefaults<DocsConfig>({ entry: "docs", theme: overridden });

    expect(overridden.configDefaults?.sidebar).toEqual({ flat: true, collapsible: false });
    expect(once.breadcrumb).toBe(true);
    expect(applyThemeConfigDefaults(once)).toEqual(once);
  });

  it("returns a config whose theme has no defaults unchanged", () => {
    const config = { entry: "docs", theme: { name: "ledger" } };
    expect(applyThemeConfigDefaults(config)).toBe(config);
  });
});
