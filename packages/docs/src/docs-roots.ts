export interface DocsRootRouterOptions {
  /** API route shared by every root. Defaults to `api/docs`. */
  apiRoute?: string;
}

export interface DocsRootSelection<Root> {
  root: Root;
  /** True when the choice came from the Referer, so the response must carry `Vary: Referer`. */
  varyReferer: boolean;
}

export interface DocsRootRouter<Root> {
  readonly primary: Root;
  /** The root whose docs path owns `pathname` (pages, `.md` mirrors, navigation data). */
  match(pathname: string): Root | undefined;
  /**
   * The root that answers `request`: the root owning the path; for the API route, the root named
   * by `?root=`, then by `?pathname=`, then by the Referer's path; otherwise the first root, which
   * owns site-wide files and MCP.
   */
  select(request: Request): DocsRootSelection<Root>;
}

export type DocsRootRequestHandler = (
  request: Request,
) => Response | null | undefined | Promise<Response | null | undefined>;

function docsRootPath(entry: string): string {
  return `/${entry.replace(/^\/+|\/+$/g, "")}`;
}

function pathnameOf(value: string | null, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).pathname;
  } catch {
    return undefined;
  }
}

/** Routes requests between several docs roots served by one app. The first root is the primary. */
export function createDocsRootRouter<Root extends { entry: string }>(
  roots: readonly Root[],
  options: DocsRootRouterOptions = {},
): DocsRootRouter<Root> {
  const primary = roots[0];
  if (!primary) throw new Error("[docs] docs roots need at least one root");
  const paths = roots.map((root) => docsRootPath(root.entry));
  const duplicate = paths.find((path, index) => paths.indexOf(path) !== index);
  if (duplicate) throw new Error(`[docs] two docs roots share the entry ${duplicate}`);
  const byLength = roots
    .map((root, index) => ({ root, path: paths[index]! }))
    .sort((a, b) => b.path.length - a.path.length);
  const apiPath = docsRootPath(options.apiRoute ?? "api/docs");

  const match = (pathname: string) => {
    const normalized = pathname.replace(/(.)\/+$/, "$1");
    return byLength.find(
      ({ path }) =>
        normalized === path || normalized === `${path}.md` || normalized.startsWith(`${path}/`),
    )?.root;
  };

  const select = (request: Request): DocsRootSelection<Root> => {
    const url = new URL(request.url);
    const owner = match(url.pathname);
    if (owner) return { root: owner, varyReferer: false };
    const pathname = url.pathname.replace(/(.)\/+$/, "$1");
    if (pathname !== apiPath && !pathname.startsWith(`${apiPath}/`)) {
      return { root: primary, varyReferer: false };
    }
    const named = url.searchParams.get("root");
    if (named !== null) {
      const root = byLength.find(({ path }) => path === docsRootPath(named))?.root;
      return { root: root ?? primary, varyReferer: false };
    }
    const page = pathnameOf(url.searchParams.get("pathname"), url.origin);
    if (page !== undefined) return { root: match(page) ?? primary, varyReferer: false };
    const referer = pathnameOf(request.headers.get("referer"), url.origin);
    return { root: (referer && match(referer)) || primary, varyReferer: true };
  };

  return { primary, match, select };
}

/** One request handler over several docs roots, each with its own `(request) => Response` handler. */
export function createDocsRootHandler(
  roots: ReadonlyArray<{ entry: string; handle: DocsRootRequestHandler }>,
  options: DocsRootRouterOptions = {},
): (request: Request) => Promise<Response | null> {
  const router = createDocsRootRouter(roots, options);
  return async function handleDocsRootRequest(request) {
    const { root, varyReferer } = router.select(request);
    const response = (await root.handle(request)) ?? null;
    return response && varyReferer ? withVaryReferer(response) : response;
  };
}

/** Adds `Vary: Referer`, copying the response when its headers are immutable. */
export function withVaryReferer(response: Response): Response {
  try {
    response.headers.append("Vary", "Referer");
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.append("Vary", "Referer");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
