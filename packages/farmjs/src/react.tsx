import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import type { DocsConfig } from "@farming-labs/docs";
import type { BrowserNavigationAdapter } from "@farming-labs/theme/browser";
import type { DocsServerLoadResult } from "./server.js";
import { normalizeDocsModuleKey, resolveDocsModule } from "./module-map.js";
import {
  createFarmDocsNavigator,
  type FarmDocsNavigationEnvironment,
  type FarmDocsNavigationOptions,
} from "./navigation.js";
import { FarmDocsPageRenderer } from "./page.js";

interface MdxModule {
  default: ComponentType<any>;
}

const rawDocModules = import.meta.glob("/**/*.{md,mdx}", {
  eager: true,
});

const docModules = Object.fromEntries(
  Object.entries(rawDocModules).map(([key, value]) => [normalizeDocsModuleKey(key), value]),
);

export function FarmDocsPage({
  config,
  data,
  navigation,
}: {
  config: DocsConfig;
  data: DocsServerLoadResult;
  navigation?: BrowserNavigationAdapter;
}) {
  const module = resolveDocsModule(docModules, data.sourcePath, data.entry) as
    | MdxModule
    | undefined;
  return (
    <FarmDocsPageRenderer
      config={config}
      data={data}
      Content={module?.default}
      navigation={navigation}
    />
  );
}

function scrollToNavigationTarget(url: URL): void {
  if (!url.hash) {
    window.scrollTo({ top: 0, left: 0 });
    return;
  }

  let id = url.hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // Keep the encoded hash when it is malformed.
  }
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}

function setNavigationPending(pending: boolean): void {
  const root = document.documentElement;
  const layout = document.getElementById("nd-docs-layout");

  if (pending) {
    root.dataset.farmDocsNavigating = "true";
    layout?.setAttribute("aria-busy", "true");
    return;
  }

  delete root.dataset.farmDocsNavigating;
  layout?.removeAttribute("aria-busy");
}

function updateNavigationHistory(mode: "push" | "replace", url: URL): void {
  const state = { ...window.history.state, farmDocs: true };
  window.history[mode === "push" ? "pushState" : "replaceState"](state, "", url.href);
}

function FarmDocsClient({ config, data }: { config: DocsConfig; data: DocsServerLoadResult }) {
  const [runtimeData, setRuntimeData] = useState(data);
  const pendingScrollRef = useRef<URL | null>(null);

  const navigationEnvironment = useMemo<FarmDocsNavigationEnvironment>(
    () => ({
      getHref: () => window.location.href,
      fetch: (url, init) => window.fetch(url, init),
      assign: (url) => window.location.assign(url),
      reload: () => window.location.reload(),
      updateHistory: updateNavigationHistory,
      setPending: setNavigationPending,
      scheduleScroll: (url) => requestAnimationFrame(() => scrollToNavigationTarget(url)),
    }),
    [],
  );

  const navigator = useMemo(
    () =>
      createFarmDocsNavigator({
        config,
        data,
        environment: navigationEnvironment,
        onData(nextData, scrollTarget) {
          pendingScrollRef.current = scrollTarget;
          startTransition(() => setRuntimeData(nextData));
        },
      }),
    [config, data, navigationEnvironment],
  );

  const navigation = useMemo<BrowserNavigationAdapter>(
    () => ({
      push(url: string) {
        return navigator.navigate(url, { history: "push", scroll: true, fallback: "assign" });
      },
      refresh() {
        window.location.reload();
      },
    }),
    [navigator],
  );

  useEffect(() => {
    const handlePopState = () => {
      void navigator.navigate(window.location.href, {
        history: "none",
        scroll: false,
        fallback: "reload",
      } satisfies FarmDocsNavigationOptions);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      navigator.dispose();
    };
  }, [navigator]);

  useLayoutEffect(() => {
    document.title = runtimeData.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const nextDescription = runtimeData.description ?? config.metadata?.description;
    if (description && nextDescription) {
      description.content = nextDescription;
    }

    const pendingScroll = pendingScrollRef.current;
    if (!pendingScroll) return;
    pendingScrollRef.current = null;
    scrollToNavigationTarget(pendingScroll);
  }, [config.metadata?.description, runtimeData]);

  return <FarmDocsPage config={config} data={runtimeData} navigation={navigation} />;
}

export function hydrateFarmDocs(input: {
  config: DocsConfig;
  data: DocsServerLoadResult;
  container?: Element | null;
}): Root {
  const container = input.container ?? document.getElementById("farm-docs-root");
  if (!container) {
    throw new Error("Farm docs hydration root was not found.");
  }

  return hydrateRoot(container, <FarmDocsClient config={input.config} data={input.data} />);
}
