import { dirname, isAbsolute } from "node:path";

interface ResolveRequest {
  request?: string;
  path?: string | false;
  descriptionFilePath?: string;
  descriptionFileRoot?: string;
  descriptionFileData?: unknown;
  relativePath?: string;
}

type ResolveCallback = (error?: Error | null, result?: unknown) => void;
interface Resolver {
  getHook(name: string): {
    tapAsync(
      name: string,
      callback: (request: ResolveRequest, context: unknown, done: ResolveCallback) => void,
    ): void;
  };
  ensureHook(name: string): unknown;
  doResolve(
    hook: unknown,
    request: ResolveRequest,
    message: string,
    context: unknown,
    done: ResolveCallback,
  ): void;
}

/** Pin shared packages without replacing exported subpaths with filesystem paths. */
export class DocsPackageResolutionPlugin {
  private readonly roots: Map<string, string>;

  constructor(packages: Record<string, string>) {
    this.roots = new Map(
      Object.entries(packages)
        .filter(([, directory]) => isAbsolute(directory))
        .map(([name, directory]) => [name, dirname(dirname(directory))]),
    );
  }

  apply(resolver: Resolver) {
    resolver
      .getHook("described-resolve")
      .tapAsync("DocsPackageResolutionPlugin", (request, context, done) => {
        const name = request.request;
        if (!name) return done();
        const entry = [...this.roots].find(([pkg]) => name === pkg || name.startsWith(`${pkg}/`));
        if (!entry || request.path === entry[1]) return done();

        resolver.doResolve(
          resolver.ensureHook("resolve"),
          {
            ...request,
            path: entry[1],
            descriptionFilePath: undefined,
            descriptionFileRoot: undefined,
            descriptionFileData: undefined,
            relativePath: undefined,
          },
          `resolve shared docs package ${name}`,
          context,
          done,
        );
      });
  }
}
