import { describe, it, expect } from "vitest";
import {
  type TemplateConfig,
  docsConfigTemplate,
  docsLayoutTemplate,
  nextApiReferenceRouteTemplate,
  nextApiReferencePageTemplate,
  rootLayoutTemplate,
  injectRootProviderIntoLayout,
  tanstackDocsConfigTemplate,
  tanstackInstallationPageTemplate,
  tanstackApiReferenceRouteTemplate,
  tanstackRootRouteTemplate,
  injectTanstackRootProviderIntoRoute,
  injectTanstackVitePlugins,
  globalCssTemplate,
  injectCssImport,
  getThemeExportName,
  getCustomThemeCssImportPath,
  customThemeTsTemplate,
  customThemeCssTemplate,
  svelteDocsConfigTemplate,
  nuxtDocsConfigTemplate,
  postcssConfigTemplate,
  nextConfigTemplate,
  nextConfigMergedTemplate,
  svelteDocsLayoutTemplate,
  svelteDocsLayoutServerTemplate,
  svelteApiReferenceRouteTemplate,
  astroDocsConfigTemplate,
  astroApiReferenceRouteTemplate,
  nuxtServerApiReferenceRouteTemplate,
} from "./templates.js";

const baseConfig: TemplateConfig = {
  entry: "docs",
  theme: "fumadocs",
  projectName: "my-docs",
  framework: "nextjs",
  useAlias: true,
};

const i18nConfig: NonNullable<TemplateConfig["i18n"]> = {
  locales: ["en", "fr"],
  defaultLocale: "en",
};

describe("docsLayoutTemplate", () => {
  it("includes createDocsLayout, createDocsMetadata, and explicit Layout export", () => {
    const out = docsLayoutTemplate(baseConfig);
    expect(out).toContain("createDocsLayout");
    expect(out).toContain("createDocsMetadata");
    expect(out).toContain("export const metadata = createDocsMetadata(docsConfig)");
    expect(out).toContain("const DocsLayout = createDocsLayout(docsConfig)");
    expect(out).toContain("export default function Layout(");
    expect(out).toContain("<DocsLayout>{children}</DocsLayout>");
    expect(out).toContain("{children}");
  });

  it("uses @/docs.config when useAlias is true", () => {
    const out = docsLayoutTemplate({ ...baseConfig, useAlias: true });
    expect(out).toContain('from "@/docs.config"');
  });

  it("uses relative path when useAlias is false (app/)", () => {
    const out = docsLayoutTemplate({ ...baseConfig, useAlias: false });
    expect(out).toContain('from "../../docs.config"');
  });

  it("uses three-level relative path when useAlias is false and nextAppDir is src/app", () => {
    const out = docsLayoutTemplate({
      ...baseConfig,
      useAlias: false,
      nextAppDir: "src/app",
    });
    expect(out).toContain('from "../../../docs.config"');
  });

  it("creates a Next.js API reference route handler", () => {
    const out = nextApiReferenceRouteTemplate(
      { ...baseConfig, useAlias: false, nextAppDir: "app" },
      "app/api-reference/[[...slug]]/route.ts",
    );
    expect(out).toContain('from "@farming-labs/next/api-reference"');
    expect(out).toContain("createNextApiReference");
    expect(out).toContain('import docsConfig from "../../../docs.config"');
  });

  it("creates a Next.js API reference page for the fumadocs renderer", () => {
    const out = nextApiReferencePageTemplate(
      { ...baseConfig, useAlias: false, nextAppDir: "app" },
      "app/api-reference/[[...slug]]/page.tsx",
    );
    expect(out).toContain('import "@farming-labs/next/api-reference.css"');
    expect(out).toContain("createNextApiReferencePage");
    expect(out).toContain('import docsConfig from "../../../docs.config"');
    expect(out).toContain('export const dynamic = "force-dynamic"');
  });
});

describe("rootLayoutTemplate", () => {
  it("includes RootProvider and RootLayout", () => {
    const out = rootLayoutTemplate(baseConfig, "app/globals.css");
    expect(out).toContain("RootProvider");
    expect(out).toContain('import { RootProvider } from "@farming-labs/theme"');
    expect(out).toContain("export default function RootLayout(");
    expect(out).toContain("<RootProvider>{children}</RootProvider>");
    expect(out).toContain("docsConfig");
  });

  it("resolves CSS import for app/ path", () => {
    const out = rootLayoutTemplate(baseConfig, "app/globals.css");
    expect(out).toContain('import "./globals.css"');
  });

  it("resolves CSS import for src/app/ path", () => {
    const out = rootLayoutTemplate(baseConfig, "src/app/globals.css");
    expect(out).toContain('import "./globals.css"');
  });

  it("uses ../../docs.config when nextAppDir is src/app and useAlias is false", () => {
    const out = rootLayoutTemplate(
      { ...baseConfig, useAlias: false, nextAppDir: "src/app" },
      "src/app/globals.css",
    );
    expect(out).toContain('from "../../docs.config"');
  });
});

describe("injectRootProviderIntoLayout", () => {
  it("returns null when content already has RootProvider", () => {
    const content = `export default function RootLayout({ children }) {
  return <html><body><RootProvider>{children}</RootProvider></body></html>;
}`;
    expect(injectRootProviderIntoLayout(content)).toBeNull();
  });

  it("adds import and wraps {children} in a typical Next.js root layout", () => {
    const content = `import type { Metadata } from "next";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
    const result = injectRootProviderIntoLayout(content);
    expect(result).not.toBeNull();
    expect(result).toContain('import { RootProvider } from "@farming-labs/theme"');
    expect(result).toContain("<RootProvider>{children}</RootProvider>");
    expect(result).not.toContain("<body>{children}</body>");
    expect(result).toContain("<body><RootProvider>{children}</RootProvider></body>");
    // Import should be after the last existing import
    const lines = result!.split("\n");
    const themeImportIdx = lines.findIndex(
      (l) => l.includes("RootProvider") && l.includes("@farming-labs/theme"),
    );
    const globalsIdx = lines.findIndex((l) => l.includes('"./globals.css"'));
    expect(themeImportIdx).toBeGreaterThan(globalsIdx);
  });

  it("places new import after last import when using import type", () => {
    const content = `import type { Metadata } from "next";
import "./globals.css";

export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}
`;
    const result = injectRootProviderIntoLayout(content);
    expect(result).not.toBeNull();
    expect(result).toContain('import { RootProvider } from "@farming-labs/theme"');
    const lines = result!.split("\n");
    const idx = lines.findIndex((l) => l.trim().startsWith("import { RootProvider }"));
    expect(idx).toBe(2); // after line 0 (import type) and line 1 (import "./globals.css")
  });

  it("adds import at top when there are no imports", () => {
    const content = `export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}
`;
    const result = injectRootProviderIntoLayout(content);
    expect(result).not.toBeNull();
    expect(
      result!.trimStart().startsWith('import { RootProvider } from "@farming-labs/theme"'),
    ).toBe(true);
    expect(result).toContain("<RootProvider>{children}</RootProvider>");
  });

  it("wraps only the first occurrence of {children}", () => {
    const content = `import "./x.css";
export default function RootLayout({ children }) {
  return <div>{children}</div>;
}
`;
    const result = injectRootProviderIntoLayout(content);
    expect(result).not.toBeNull();
    expect(result).toContain("<RootProvider>{children}</RootProvider>");
    const count = (result!.match(/\{children\}/g) || []).length;
    expect(count).toBe(1);
  });

  it("returns null when content is empty (no change possible)", () => {
    expect(injectRootProviderIntoLayout("")).toBeNull();
  });
});

describe("globalCssTemplate", () => {
  it("includes tailwind and theme css for default theme", () => {
    const out = globalCssTemplate("fumadocs");
    expect(out).toContain('@import "tailwindcss"');
    expect(out).toContain("@farming-labs/theme/default/css");
  });

  it("uses correct theme path for darksharp", () => {
    const out = globalCssTemplate("darksharp");
    expect(out).toContain("@farming-labs/theme/darksharp/css");
  });

  it("uses correct theme path for concrete", () => {
    const out = globalCssTemplate("concrete");
    expect(out).toContain("@farming-labs/theme/concrete/css");
  });

  it("uses correct theme path for hardline", () => {
    const out = globalCssTemplate("hardline");
    expect(out).toContain("@farming-labs/theme/hardline/css");
  });
});

describe("injectCssImport", () => {
  it("returns null when theme import already present", () => {
    const content = `@import "tailwindcss";
@import "@farming-labs/theme/default/css";
`;
    expect(injectCssImport(content, "fumadocs")).toBeNull();
  });

  it("adds theme import when missing", () => {
    const content = `@import "tailwindcss";
`;
    const result = injectCssImport(content, "fumadocs");
    expect(result).not.toBeNull();
    expect(result).toContain('@import "@farming-labs/theme/default/css"');
  });
});

describe("postcssConfigTemplate", () => {
  it("returns valid postcss config with tailwind plugin", () => {
    const out = postcssConfigTemplate();
    expect(out).toContain("@tailwindcss/postcss");
    expect(out).toContain("export default");
  });
});

describe("docsConfigTemplate", () => {
  it("includes defineDocs, entry, theme, and metadata", () => {
    const out = docsConfigTemplate(baseConfig);
    expect(out).toContain("defineDocs");
    expect(out).toContain('entry: "docs"');
    expect(out).toContain("theme:");
    expect(out).toContain("metadata:");
    expect(out).toContain("titleTemplate");
  });

  it("uses correct theme factory for darksharp", () => {
    const out = docsConfigTemplate({ ...baseConfig, theme: "darksharp" });
    expect(out).toContain("darksharp");
    expect(out).toContain("@farming-labs/theme/darksharp");
  });

  it("uses correct theme factory for concrete", () => {
    const out = docsConfigTemplate({ ...baseConfig, theme: "concrete" });
    expect(out).toContain("concrete");
    expect(out).toContain("@farming-labs/theme/concrete");
  });

  it("uses correct theme factory for hardline", () => {
    const out = docsConfigTemplate({ ...baseConfig, theme: "hardline" });
    expect(out).toContain("hardline");
    expect(out).toContain("@farming-labs/theme/hardline");
  });

  it("uses local theme path for custom theme with customThemeName", () => {
    const out = docsConfigTemplate({
      ...baseConfig,
      theme: "custom",
      customThemeName: "my-theme",
    });
    expect(out).toContain('from "@/themes/my-theme"');
    expect(out).toContain("theme: myTheme(");
    expect(out).toContain("defineDocs");
  });

  it("includes i18n config when locales are provided", () => {
    const out = docsConfigTemplate({ ...baseConfig, i18n: { ...i18nConfig } });
    expect(out).toContain("i18n:");
    expect(out).toContain('locales: ["en", "fr"]');
    expect(out).toContain('defaultLocale: "en"');
  });

  it("includes apiReference when configured", () => {
    const out = docsConfigTemplate({
      ...baseConfig,
      apiReference: { path: "api-reference", routeRoot: "internal-api" },
    });
    expect(out).toContain("apiReference:");
    expect(out).toContain('path: "api-reference"');
    expect(out).toContain('routeRoot: "internal-api"');
  });
});

describe("tanstackDocsConfigTemplate", () => {
  it("includes contentDir, nav, and theme toggle", () => {
    const out = tanstackDocsConfigTemplate({
      ...baseConfig,
      framework: "tanstack-start",
    });
    expect(out).toContain('contentDir: "docs"');
    expect(out).toContain("nav:");
    expect(out).toContain('url: "/docs"');
    expect(out).toContain("themeToggle:");
  });
});

describe("api reference route templates", () => {
  it("creates a TanStack API reference route handler", () => {
    const out = tanstackApiReferenceRouteTemplate({
      filePath: "src/routes/api-reference.index.ts",
      useAlias: false,
      apiReferencePath: "api-reference",
      catchAll: false,
    });

    expect(out).toContain('from "@farming-labs/tanstack-start/api-reference"');
    expect(out).toContain('createFileRoute("/api-reference/")');
    expect(out).toContain("GET: handler");
  });

  it("creates a SvelteKit API reference route handler", () => {
    const out = svelteApiReferenceRouteTemplate("src/routes/api-reference/+server.ts", true);
    expect(out).toContain('from "@farming-labs/svelte/api-reference"');
    expect(out).toContain('import config from "$lib/docs.config"');
  });

  it("creates an Astro API reference route handler", () => {
    const out = astroApiReferenceRouteTemplate("src/pages/api-reference/index.ts");
    expect(out).toContain('from "@farming-labs/astro/api-reference"');
    expect(out).toContain('import config from "../../lib/docs.config"');
  });

  it("creates a Nuxt API reference route handler", () => {
    const out = nuxtServerApiReferenceRouteTemplate("server/routes/api-reference/index.ts", true);
    expect(out).toContain('from "@farming-labs/nuxt/api-reference"');
    expect(out).toContain('import config from "~/docs.config"');
  });
});

describe("tanstackInstallationPageTemplate", () => {
  it("uses the generated local custom theme in installation docs", () => {
    const out = tanstackInstallationPageTemplate({
      ...baseConfig,
      framework: "tanstack-start",
      theme: "custom",
      customThemeName: "my-theme",
    });

    expect(out).toContain('import { myTheme } from "./themes/my-theme"');
    expect(out).toContain("theme: myTheme()");
    expect(out).toContain('@import "../../themes/my-theme.css";');
    expect(out).toContain("themes/my-theme.ts");
    expect(out).toContain("themes/my-theme.css");
  });
});

describe("tanstackRootRouteTemplate", () => {
  it("links the selected CSS file and wraps Outlet with RootProvider", () => {
    const out = tanstackRootRouteTemplate("src/styles/app.css");
    expect(out).toContain('import appCss from "../styles/app.css?url"');
    expect(out).toContain('import { RootProvider } from "@farming-labs/theme/tanstack"');
    expect(out).toContain("<RootProvider>");
    expect(out).toContain("<Outlet />");
  });
});

describe("injectTanstackRootProviderIntoRoute", () => {
  it("injects RootProvider around Outlet", () => {
    const result =
      injectTanstackRootProviderIntoRoute(`import { Outlet } from "@tanstack/react-router";

export function App() {
  return <Outlet />;
}
`);
    expect(result).not.toBeNull();
    expect(result).toContain('import { RootProvider } from "@farming-labs/theme/tanstack"');
    expect(result).toContain("<RootProvider><Outlet /></RootProvider>");
  });
});

describe("injectTanstackVitePlugins", () => {
  it("adds docsMdx and tailwind plugins when missing", () => {
    const result = injectTanstackVitePlugins(
      `import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [tanstackStart()],
});
`,
      true,
    );

    expect(result).not.toBeNull();
    expect(result).toContain('import tailwindcss from "@tailwindcss/vite";');
    expect(result).toContain('import tsconfigPaths from "vite-tsconfig-paths";');
    expect(result).toContain('import { docsMdx } from "@farming-labs/tanstack-start/vite";');
    expect(result).toContain("tailwindcss()");
    expect(result).toContain("docsMdx()");
    expect(result).toContain("tsconfigPaths({ ignoreConfigErrors: true })");
  });

  it("does not duplicate equivalent imports with different quote or semicolon style", () => {
    const result = injectTanstackVitePlugins(
      `import { defineConfig } from "vite"
import tailwindcss from '@tailwindcss/vite'
import { docsMdx } from '@farming-labs/tanstack-start/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from "@tanstack/react-start/plugin/vite"

export default defineConfig({
  plugins: [tailwindcss(), docsMdx(), tsconfigPaths({ ignoreConfigErrors: true }), tanstackStart()],
})
`,
      true,
    );

    expect(result).toBeNull();
  });
});

describe("Create your own theme", () => {
  describe("getThemeExportName", () => {
    it("converts kebab-case to camelCase (my-theme -> myTheme)", () => {
      expect(getThemeExportName("my-theme")).toBe("myTheme");
    });
    it("handles single word", () => {
      expect(getThemeExportName("acme")).toBe("acme");
    });
    it("strips .ts suffix", () => {
      expect(getThemeExportName("my-theme.ts")).toBe("myTheme");
    });
    it("returns customTheme for empty after trim", () => {
      expect(getThemeExportName("")).toBe("customTheme");
    });
  });

  describe("getCustomThemeCssImportPath", () => {
    it("returns ../themes/<name>.css when global CSS is under app/", () => {
      expect(getCustomThemeCssImportPath("app/globals.css", "my-theme")).toBe(
        "../themes/my-theme.css",
      );
    });
    it("returns ../../themes/<name>.css when global CSS is under src/", () => {
      expect(getCustomThemeCssImportPath("src/app.css", "my-theme")).toBe(
        "../../themes/my-theme.css",
      );
    });
  });

  describe("customThemeTsTemplate", () => {
    it("exports createTheme with given name and ui options", () => {
      const out = customThemeTsTemplate("my-theme");
      expect(out).toContain('import { createTheme } from "@farming-labs/docs"');
      expect(out).toContain("export const myTheme = createTheme");
      expect(out).toContain('name: "my-theme"');
      expect(out).toContain("primary:");
      expect(out).toContain("background:");
    });
  });

  describe("customThemeCssTemplate", () => {
    it("imports black preset and defines .dark overrides", () => {
      const out = customThemeCssTemplate("my-theme");
      expect(out).toContain('@import "@farming-labs/theme/presets/black"');
      expect(out).toContain(".dark {");
      expect(out).toContain("--color-fd-primary:");
      expect(out).toContain("--radius:");
    });
  });

  describe("globalCssTemplate (custom theme)", () => {
    it("uses local themes path when customThemeName and globalCssRelPath provided", () => {
      const out = globalCssTemplate("custom", "my-theme", "app/globals.css");
      expect(out).toContain('@import "tailwindcss"');
      expect(out).toContain("../themes/my-theme.css");
    });
  });

  describe("injectCssImport (custom theme)", () => {
    it("injects local theme CSS path when theme is custom", () => {
      const content = `@import "tailwindcss";\n`;
      const result = injectCssImport(content, "custom", "my-theme", "app/globals.css");
      expect(result).not.toBeNull();
      expect(result).toContain("../themes/my-theme.css");
    });
    it("returns null when custom theme CSS import already present", () => {
      const content = `@import "tailwindcss";
@import "../themes/my-theme.css";
`;
      expect(injectCssImport(content, "custom", "my-theme", "app/globals.css")).toBeNull();
    });
  });

  describe("svelteDocsConfigTemplate (custom theme)", () => {
    it("imports from ../../themes/<name> and uses camelCase export", () => {
      const out = svelteDocsConfigTemplate({
        ...baseConfig,
        theme: "custom",
        customThemeName: "my-theme",
      });
      expect(out).toContain('from "../../themes/my-theme"');
      expect(out).toContain("theme: myTheme(");
    });
  });

  describe("framework docs config templates (i18n)", () => {
    it("adds i18n to Svelte docs config", () => {
      const out = svelteDocsConfigTemplate({
        ...baseConfig,
        framework: "sveltekit",
        i18n: { ...i18nConfig },
      });
      expect(out).toContain('contentDir: "docs"');
      expect(out).toContain("i18n:");
      expect(out).toContain('defaultLocale: "en"');
    });

    it("adds i18n to Astro docs config", () => {
      const out = astroDocsConfigTemplate({
        ...baseConfig,
        framework: "astro",
        i18n: { ...i18nConfig },
      });
      expect(out).toContain('contentDir: "docs"');
      expect(out).toContain("i18n:");
      expect(out).toContain('locales: ["en", "fr"]');
    });

    it("adds i18n to Nuxt docs config", () => {
      const out = nuxtDocsConfigTemplate({
        ...baseConfig,
        framework: "nuxt",
        i18n: { ...i18nConfig },
      });
      expect(out).toContain('contentDir: "docs"');
      expect(out).toContain("i18n:");
      expect(out).toContain('defaultLocale: "en"');
    });
  });

  describe("nuxtDocsConfigTemplate (custom theme)", () => {
    it("imports from ~/themes/<name> when useAlias and uses camelCase export", () => {
      const out = nuxtDocsConfigTemplate({
        ...baseConfig,
        theme: "custom",
        customThemeName: "my-theme",
      });
      expect(out).toContain('from "~/themes/my-theme"');
      expect(out).toContain("theme: myTheme(");
    });
    it("imports from ./themes/<name> when useAlias is false", () => {
      const out = nuxtDocsConfigTemplate({
        ...baseConfig,
        useAlias: false,
        theme: "custom",
        customThemeName: "my-theme",
      });
      expect(out).toContain('from "./themes/my-theme"');
    });
  });
});

describe("nextConfigTemplate", () => {
  it("exports withDocs from next config", () => {
    const out = nextConfigTemplate();
    expect(out).toContain("withDocs");
    expect(out).toContain("@farming-labs/next/config");
    expect(out).toContain("export default withDocs()");
  });
});

describe("nextConfigMergedTemplate", () => {
  it("returns unchanged content when withDocs already present", () => {
    const content =
      'import { withDocs } from "@farming-labs/next/config";\nexport default withDocs({});';
    expect(nextConfigMergedTemplate(content)).toBe(content);
  });

  it("injects withDocs import and wrap when missing", () => {
    const content = `const nextConfig = {};\nexport default nextConfig;`;
    const out = nextConfigMergedTemplate(content);
    expect(out).toContain("withDocs");
    expect(out).toContain("withDocs(nextConfig)");
  });
});

describe("svelteDocsLayoutTemplate", () => {
  it("includes DocsLayout and config import", () => {
    const out = svelteDocsLayoutTemplate(baseConfig);
    expect(out).toContain("DocsLayout");
    expect(out).toContain("@farming-labs/svelte-theme");
    expect(out).toContain("data.tree");
    expect(out).toContain("{@render children()}");
  });

  it("uses $lib path when useAlias is true", () => {
    const out = svelteDocsLayoutTemplate({ ...baseConfig, useAlias: true });
    expect(out).toContain("$lib/docs.config");
  });
});

describe("svelteDocsLayoutServerTemplate", () => {
  it("re-exports load from server module", () => {
    const out = svelteDocsLayoutServerTemplate(baseConfig);
    expect(out).toContain("export { load }");
  });
});
