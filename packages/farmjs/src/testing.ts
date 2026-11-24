/**
 * Conformance tests for running the docs UI on a Farm renderer. A renderer package runs them in a
 * Vitest file with a DOM environment (`// @vitest-environment jsdom`):
 *
 * ```ts
 * import { defineFarmDocsRendererConformance } from "@farming-labs/farmjs/testing";
 * import * as client from "../src/client.js";
 * import * as server from "../src/server.js";
 *
 * defineFarmDocsRendererConformance({ name: "leaf", server, client });
 * ```
 *
 * The docs UI builds pages from host elements with `className`, `data-*`, `aria-*`, boolean
 * `hidden`, `key`, and `dangerouslySetInnerHTML`. The suite checks that the renderer writes them
 * as the reference renderer does, and that hydrating keeps the server's DOM.
 */
import { describe, expect, it } from "vitest";
import type { DocsServerLoadResult } from "./server.js";
import {
  attachFarmDocsBehaviors,
  createFarmDocsLayout,
  hydrateFarmDocs,
  type FarmDocsCreateElement,
  type FarmDocsLayoutInput,
} from "./universal-ui.js";

export interface FarmDocsRendererConformanceOptions {
  /** The renderer's name, for test titles. */
  name: string;
  /** The renderer's server module: `createElement()` and `renderToString()`. */
  server: {
    createElement(type: any, props?: any, ...children: any[]): unknown;
    renderToString(element: any): string | Promise<string>;
  };
  /** The renderer's client module. Without it, the suite checks server rendering only. */
  client?: {
    createElement(type: any, props?: any, ...children: any[]): unknown;
    hydrateRoot(container: Element, element: any): { unmount(): void };
  };
  /**
   * Attributes the renderer writes for its own hydration, such as Solid's `data-hk`. Comparing
   * the page's HTML with the reference ignores them.
   */
  hydrationAttributes?: readonly string[];
}

interface ReferenceElement {
  type: string;
  props: Record<string, unknown>;
  children: unknown[];
}

const VOID_ELEMENTS = new Set(["br", "hr", "img", "input", "link", "meta", "source", "wbr"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderReferenceHtml(element: unknown): string {
  if (element == null || typeof element === "boolean") return "";
  if (Array.isArray(element)) return element.map(renderReferenceHtml).join("");
  if (typeof element === "string" || typeof element === "number") {
    return escapeHtml(String(element));
  }
  const { type, props, children } = element as ReferenceElement;
  let attributes = "";
  let inner: string | undefined;
  for (const [name, value] of Object.entries(props)) {
    if (name === "key" || value == null || value === false) continue;
    if (name === "dangerouslySetInnerHTML") {
      inner = (value as { __html: string }).__html;
      continue;
    }
    const attribute = name === "className" ? "class" : name;
    attributes += value === true ? ` ${attribute}` : ` ${attribute}="${escapeHtml(String(value))}"`;
  }
  if (VOID_ELEMENTS.has(type)) return `<${type}${attributes}>`;
  inner ??= children.map(renderReferenceHtml).join("");
  return `<${type}${attributes}>${inner}</${type}>`;
}

/** The smallest renderer the docs UI runs on: host elements to an HTML string. */
export const referenceFarmDocsRenderer = {
  name: "reference",
  createElement(
    type: string,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): ReferenceElement {
    return { type, props: props ?? {}, children };
  },
  renderToString: renderReferenceHtml,
};

const CONTENT_HTML =
  '<h2 id="install">Install <em>&lt;now&gt;</em></h2><figure><button aria-live="polite">Copy</button><pre><code>pnpm add @farm.js/core</code></pre></figure>';

function page(name: string, url: string) {
  return { type: "page" as const, name, url };
}

/** A docs page with a nested folder, an open folder, and text that needs escaping. */
export function createFarmDocsConformanceInput(): FarmDocsLayoutInput {
  const data = {
    url: "/docs/guides/routing",
    entry: "docs",
    title: "Routing",
    documentTitle: "Routing",
    description: "Routes & <layouts>.",
    descriptionInBody: false,
    lastModified: "November 23, 2026",
    tree: {
      name: "Docs",
      children: [
        page("Introduction", "/docs"),
        {
          type: "folder" as const,
          name: "Guides",
          children: [page("Routing", "/docs/guides/routing"), page("Data", "/docs/guides/data")],
        },
        {
          type: "folder" as const,
          name: "Reference",
          children: [page("Config", "/docs/reference/config")],
        },
      ],
    },
    previousPage: page("Introduction", "/docs"),
    nextPage: page("Data", "/docs/guides/data"),
  } as unknown as DocsServerLoadResult;
  return {
    config: { entry: "docs", nav: { title: "Farm <Docs>" } } as never,
    data,
    contentHtml: CONTENT_HTML,
  };
}

/** Parses HTML into a container, dropping the comments some renderers write between texts. */
function parse(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  for (const comment of comments) comment.parentNode?.removeChild(comment);
  container.normalize();
  return container;
}

/**
 * Serializes a node with sorted attributes and single-spaced classes, so neither attribute order
 * nor the whitespace in a class list counts.
 */
function canonical(node: Node, ignoredAttributes: ReadonlySet<string>): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
  if (!(node instanceof Element)) return "";
  const attributes = [...node.attributes]
    .filter((attribute) => !ignoredAttributes.has(attribute.name))
    .map((attribute) => {
      const value =
        attribute.name === "class"
          ? attribute.value.trim().split(/\s+/).join(" ")
          : attribute.value;
      return `${attribute.name}="${escapeHtml(value)}"`;
    })
    .sort()
    .join(" ");
  const tag = node.tagName.toLowerCase();
  const children = [...node.childNodes]
    .map((child) => canonical(child, ignoredAttributes))
    .join("");
  return `<${tag}${attributes ? ` ${attributes}` : ""}>${children}</${tag}>`;
}

async function renderReference(input: FarmDocsLayoutInput): Promise<string> {
  return renderReferenceHtml(
    createFarmDocsLayout(referenceFarmDocsRenderer.createElement as FarmDocsCreateElement, input),
  );
}

export function defineFarmDocsRendererConformance(
  options: FarmDocsRendererConformanceOptions,
): void {
  const { name, server, client } = options;
  const hydrationAttributes = new Set(options.hydrationAttributes);
  const renderServer = async (input: FarmDocsLayoutInput) =>
    server.renderToString(
      createFarmDocsLayout(server.createElement as FarmDocsCreateElement, input),
    );

  describe(`docs UI on ${name}`, () => {
    it("writes the page's HTML as the reference renderer does", async () => {
      const input = createFarmDocsConformanceInput();
      const actual = parse(await renderServer(input));
      const expected = parse(await renderReference(input));
      expect(canonical(actual, hydrationAttributes)).toBe(canonical(expected, hydrationAttributes));
    });

    it("writes dangerouslySetInnerHTML unescaped and escapes text", async () => {
      const html = await renderServer(createFarmDocsConformanceInput());
      expect(html).toContain(CONTENT_HTML);
      // Escaped either way (`&gt;` is optional in text), the title parses back as text.
      const container = parse(html);
      expect(container.querySelector("#nd-subnav a")?.textContent).toBe("Farm <Docs>");
      expect(container.querySelector("docs")).toBeNull();
    });

    it("writes className as class, true as a bare attribute, and drops false and key", async () => {
      const container = parse(await renderServer(createFarmDocsConformanceInput()));
      const layout = container.querySelector("#nd-docs-layout");
      expect(layout?.getAttribute("class")).toContain("grid");
      expect(layout?.hasAttribute("className")).toBe(false);
      expect(container.querySelector("#nd-sidebar-mobile")?.hasAttribute("hidden")).toBe(true);
      const guides = container.querySelectorAll<HTMLElement>("#nd-sidebar [data-farm-docs-folder]");
      expect(guides[0]?.querySelector(":scope > div")?.hasAttribute("hidden")).toBe(false);
      expect(guides[1]?.querySelector(":scope > div")?.hasAttribute("hidden")).toBe(true);
      expect(container.querySelector("[key]")).toBeNull();
      expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("Routing");
    });

    if (!client) return;

    it("hydrates the server's DOM without replacing it", async () => {
      const input = createFarmDocsConformanceInput();
      const container = document.createElement("div");
      container.innerHTML = await renderServer(input);
      document.body.append(container);
      const layout = container.querySelector("#nd-docs-layout");
      const content = container.querySelector("[data-farm-docs-content]");
      const html = container.innerHTML;

      // As in the browser, where the page's HTML is read back from the server's DOM.
      const root = hydrateFarmDocs({
        config: input.config,
        data: input.data,
        renderer: client,
        container,
      });
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(container.querySelector("#nd-docs-layout")).toBe(layout);
        expect(container.querySelector("[data-farm-docs-content]")).toBe(content);
        expect(container.innerHTML).toBe(html);
      } finally {
        root.unmount();
        container.remove();
      }
    });

    it("keeps the page's listeners working on the hydrated DOM until they are removed", async () => {
      const input = createFarmDocsConformanceInput();
      const container = document.createElement("div");
      container.innerHTML = await renderServer(input);
      document.body.append(container);
      const root = client.hydrateRoot(
        container,
        createFarmDocsLayout(client.createElement as FarmDocsCreateElement, input),
      );
      const detach = attachFarmDocsBehaviors(container);
      try {
        const folder = container.querySelectorAll<HTMLElement>(
          "#nd-sidebar [data-farm-docs-folder]",
        )[1]!;
        const button = folder.querySelector<HTMLButtonElement>(":scope > button")!;
        const items = folder.querySelector<HTMLElement>(":scope > div")!;
        button.click();
        expect(items.hidden).toBe(false);
        expect(button.getAttribute("aria-expanded")).toBe("true");
        expect(folder.getAttribute("data-state")).toBe("open");

        detach();
        button.click();
        expect(items.hidden).toBe(false);
      } finally {
        detach();
        root.unmount();
        container.remove();
      }
    });
  });
}
