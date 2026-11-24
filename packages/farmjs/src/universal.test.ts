// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import farmDocsBrowserCss from "./browser-css.generated.js";
import {
  createFarmDocsConformanceInput,
  defineFarmDocsRendererConformance,
  referenceFarmDocsRenderer,
} from "./testing.js";
import {
  attachFarmDocsBehaviors,
  createFarmDocsLayout,
  hydrateFarmDocs,
  renderFarmDocsPage,
  type FarmDocsCreateElement,
} from "./universal.js";
import { farmDocsTocFromHtml } from "./universal-content.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom replaces the global URL, so paths resolve with node:path.
const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const readSource = (file: string) => readFileSync(path.resolve(sourceDir, file), "utf8");

defineFarmDocsRendererConformance({
  name: "the reference renderer",
  server: referenceFarmDocsRenderer,
});

defineFarmDocsRendererConformance({
  name: "React",
  server: { createElement, renderToString },
  client: {
    createElement,
    hydrateRoot(container, element) {
      let root: Root | undefined;
      act(() => {
        root = hydrateRoot(container, element);
      });
      return { unmount: () => act(() => root!.unmount()) };
    },
  },
});

/**
 * Classes the React UI writes on the same elements that no class selector styles: Tailwind's
 * typography plugin reads `not-prose` through `[class~=not-prose]`, and the rest are hooks.
 */
const UNSTYLED_REACT_UI_CLASSES = new Set([
  "fd-page-nav-title-next",
  "fd-page-nav-title-prev",
  "fd-title-decorations-fallback",
  "not-prose",
]);

/** The class names the docs page uses, as the stylesheet writes them in selectors. */
function selectorFor(className: string): string {
  return `.${className.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)}`;
}

describe("the universal docs UI", () => {
  it("uses only classes the docs stylesheet defines", () => {
    const html = referenceFarmDocsRenderer.renderToString(
      createFarmDocsLayout(referenceFarmDocsRenderer.createElement as FarmDocsCreateElement, {
        ...createFarmDocsConformanceInput(),
        contentHtml: "",
      }),
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    const classes = new Set(
      [...container.querySelectorAll("[class]")].flatMap((element) =>
        [...element.classList].filter(
          (name) => !name.startsWith("lucide") && !UNSTYLED_REACT_UI_CLASSES.has(name),
        ),
      ),
    );
    const missing = [...classes].filter((name) => !farmDocsBrowserCss.includes(selectorFor(name)));
    expect(missing).toEqual([]);
  });

  it("gives browsers an entry that leaves out the server's Markdown renderer", () => {
    const manifest = JSON.parse(readSource("../package.json"));
    expect(manifest.exports["./universal"]).toMatchObject({
      browser: "./dist/universal.browser.js",
      import: "./dist/universal.js",
    });
    // Conditions match in order, so `browser` must come before `import`.
    expect(Object.keys(manifest.exports["./universal"]).indexOf("browser")).toBeLessThan(
      Object.keys(manifest.exports["./universal"]).indexOf("import"),
    );
    // Everything the browser entry imports at runtime, followed through local modules.
    const runtimeImports = (file: string): string[] =>
      [
        ...readSource(file).matchAll(
          /^(?:import|export)\s+(?!type\b)(?:[^;]*?from\s+)?"([^"]+)"/gms,
        ),
      ].flatMap(([, specifier]) =>
        specifier!.startsWith("./")
          ? [specifier!, ...runtimeImports(specifier!.replace(/\.js$/, ".ts"))]
          : [specifier!],
      );
    expect(runtimeImports("./universal.browser.ts")).toEqual(["./universal-ui.js"]);
  });

  it("lists the page's h2 to h4 headings with an id as its table of contents", () => {
    const html =
      '<h1 id="title">Title</h1>' +
      '<h2 id="install" class="group/heading"><a href="#install">Install <code>&lt;pkg&gt;</code></a>' +
      '<button aria-live="polite"><svg></svg><span>Copy link</span></button></h2>' +
      '<h3 id="a&amp;b">A &amp; B</h3><h4 id="deep">Deep</h4><h5 id="deeper">Deeper</h5><h2>No id</h2>';
    expect(farmDocsTocFromHtml(html)).toEqual([
      { title: "Install <pkg>", url: "#install", depth: 2 },
      { title: "A & B", url: "#a&b", depth: 3 },
      { title: "Deep", url: "#deep", depth: 4 },
    ]);
  });

  it("reserves the contents column without headings and leaves it out when the theme turns it off", () => {
    const render = (input: ReturnType<typeof createFarmDocsConformanceInput>) => {
      const container = document.createElement("div");
      container.innerHTML = referenceFarmDocsRenderer.renderToString(
        createFarmDocsLayout(
          referenceFarmDocsRenderer.createElement as FarmDocsCreateElement,
          input,
        ),
      );
      return container;
    };
    const input = createFarmDocsConformanceInput();
    expect(render(input).querySelectorAll("#nd-toc a")).toHaveLength(2);

    const empty = render({ ...input, toc: [] });
    expect(empty.querySelector("#nd-toc")).toBeNull();
    expect(empty.querySelector("#nd-toc-placeholder")?.className).toBe(
      "hidden xl:layout:[--fd-toc-width:268px]",
    );

    const off = render({
      ...input,
      config: { ...input.config, theme: { ui: { layout: { toc: { enabled: false } } } } } as never,
    });
    expect(off.querySelector("#nd-toc")).toBeNull();
    expect(off.querySelector("#nd-toc-placeholder")?.className).toBe("hidden");
  });

  it("marks the contents items whose headings are on screen", () => {
    let report: IntersectionObserverCallback | undefined;
    const observed: Element[] = [];
    let disconnected = false;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          report = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {
          disconnected = true;
        }
      },
    );
    const container = document.createElement("div");
    try {
      container.innerHTML = referenceFarmDocsRenderer.renderToString(
        createFarmDocsLayout(
          referenceFarmDocsRenderer.createElement as FarmDocsCreateElement,
          createFarmDocsConformanceInput(),
        ),
      );
      document.body.append(container);
      const detach = attachFarmDocsBehaviors(container);
      expect(observed.map((element) => element.id)).toEqual(["install", "options"]);
      const [install, options] = container.querySelectorAll("#nd-toc a");
      const show = (index: number, isIntersecting: boolean) =>
        report!([{ target: observed[index]!, isIntersecting }] as never, {} as never);

      show(1, true);
      expect(install?.getAttribute("data-active")).toBe("false");
      expect(options?.getAttribute("data-active")).toBe("true");
      // Scrolled past every heading: the last section stays marked.
      show(1, false);
      expect(options?.getAttribute("data-active")).toBe("true");

      detach();
      expect(disconnected).toBe(true);
    } finally {
      container.remove();
      vi.unstubAllGlobals();
    }
  });

  it("says Farm must pass the renderer when it renders without one", async () => {
    await expect(renderFarmDocsPage(createFarmDocsConformanceInput())).rejects.toThrow(
      "Upgrade @farm.js/core to a release that passes `renderer` to docs UIs",
    );
    expect(() => hydrateFarmDocs(createFarmDocsConformanceInput())).toThrow(
      "did not pass it in the browser",
    );
  });
});
