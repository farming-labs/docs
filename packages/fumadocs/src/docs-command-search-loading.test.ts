import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("fumadocs-core/framework", async (importOriginal) => {
  load();
  return { ...(await importOriginal<object>()), useRouter: () => ({ push: vi.fn() }) };
});
import { DocsCommandSearch } from "./docs-command-search.js";

it("renders the closed search without initializing dialog navigation", () => {
  expect(renderToStaticMarkup(React.createElement(DocsCommandSearch))).toBe("");
  expect(load).not.toHaveBeenCalled();
});
