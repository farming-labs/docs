import { describe, it, expect } from "vitest";
import {
  type TemplateConfig,
  docsConfigTemplate,
  docsLayoutTemplate,
  rootLayoutTemplate,
  injectRootProviderIntoLayout,
  globalCssTemplate,
  injectCssImport,
  postcssConfigTemplate,
  nextConfigTemplate,
  nextConfigMergedTemplate,
  svelteDocsLayoutTemplate,
  svelteDocsLayoutServerTemplate,
} from "./templates.js";

const baseConfig: TemplateConfig = {
  entry: "docs",
  theme: "fumadocs",
  projectName: "my-docs",
  framework: "nextjs",
  useAlias: true,
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

  it("uses relative path when useAlias is false", () => {
    const out = docsLayoutTemplate({ ...baseConfig, useAlias: false });
    expect(out).toContain('from "../../docs.config"');
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
