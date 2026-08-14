import type { DocsConfig } from "@farming-labs/docs";
import type { DocsServerLoadResult } from "./server.js";
import { FARM_DOCS_NAVIGATION_HEADER } from "./runtime.js";

export interface FarmDocsNavigationOptions {
  history: "push" | "replace" | "none";
  scroll: boolean;
  fallback: "assign" | "reload";
}

export interface FarmDocsNavigationEnvironment {
  getHref(): string;
  fetch(input: string, init: RequestInit): Promise<Response>;
  assign(url: string): void;
  reload(): void;
  updateHistory(mode: "push" | "replace", url: URL): void;
  setPending(pending: boolean): void;
  scheduleScroll(url: URL): void;
}

export interface FarmDocsNavigator {
  navigate(href: string, options: FarmDocsNavigationOptions): Promise<void>;
  dispose(): void;
}

interface FarmDocsNavigationPayload {
  data: DocsServerLoadResult;
}

function normalizeRoutePath(value: string): string {
  if (value === "/") return value;
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

function isDocsNavigationUrl(
  url: URL,
  config: DocsConfig,
  data: DocsServerLoadResult,
  origin: string,
): boolean {
  if (url.origin !== origin || url.pathname.endsWith(".md")) return false;

  const configuredPath = (config as DocsConfig & { docsPath?: string }).docsPath;
  const basePath = normalizeRoutePath(configuredPath ?? data.entry ?? "docs");
  const pathname = normalizeRoutePath(url.pathname);
  return basePath === "/" || pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "name" in error && error.name === "AbortError",
  );
}

export function createFarmDocsNavigator(input: {
  config: DocsConfig;
  data: DocsServerLoadResult;
  environment: FarmDocsNavigationEnvironment;
  onData(data: DocsServerLoadResult, scrollTarget: URL | null): void;
}): FarmDocsNavigator {
  let currentData = input.data;
  let request: { id: number; controller: AbortController } | null = null;
  let requestSequence = 0;
  let disposed = false;

  async function navigate(href: string, options: FarmDocsNavigationOptions): Promise<void> {
    if (disposed) return;

    const currentUrl = new URL(input.environment.getHref());
    const url = new URL(href, currentUrl);
    if (!isDocsNavigationUrl(url, input.config, currentData, currentUrl.origin)) {
      input.environment.assign(url.href);
      return;
    }

    const renderedUrl = new URL(currentData.url, currentUrl.origin);
    if (url.pathname === renderedUrl.pathname && url.search === renderedUrl.search) {
      if (options.history !== "none") input.environment.updateHistory(options.history, url);
      if (options.scroll) input.environment.scheduleScroll(url);
      return;
    }

    request?.controller.abort();
    const nextRequest = {
      id: ++requestSequence,
      controller: new AbortController(),
    };
    request = nextRequest;
    input.environment.setPending(true);

    try {
      const response = await input.environment.fetch(url.href, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          [FARM_DOCS_NAVIGATION_HEADER]: "1",
        },
        signal: nextRequest.controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("application/json")) {
        throw new Error(`Farm docs navigation returned ${response.status}.`);
      }

      const payload = (await response.json()) as Partial<FarmDocsNavigationPayload>;
      if (!payload.data?.sourcePath || typeof payload.data.url !== "string") {
        throw new Error("Farm docs navigation returned an invalid page payload.");
      }
      if (disposed || request?.id !== nextRequest.id) return;

      if (options.history !== "none") input.environment.updateHistory(options.history, url);
      currentData = payload.data;
      input.onData(payload.data, options.scroll ? url : null);
    } catch (error) {
      if (isAbortError(error) || disposed) return;
      if (options.fallback === "reload") input.environment.reload();
      else input.environment.assign(url.href);
    } finally {
      if (request?.id === nextRequest.id) {
        request = null;
        input.environment.setPending(false);
      }
    }
  }

  return {
    navigate,
    dispose() {
      disposed = true;
      request?.controller.abort();
      request = null;
      input.environment.setPending(false);
    },
  };
}
