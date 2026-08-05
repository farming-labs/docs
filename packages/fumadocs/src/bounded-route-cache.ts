/**
 * A small per-locale LRU cache for request-derived route variants.
 *
 * Locales come from the configured i18n locale list, while routes can be
 * inferred from request URLs. Bounding each locale prevents arbitrary request
 * paths from growing the cache indefinitely.
 */
export class BoundedRouteCache<T> {
  private readonly entries = new Map<string | undefined, Map<string, T>>();

  constructor(private readonly maxRoutesPerLocale: number) {
    if (!Number.isInteger(maxRoutesPerLocale) || maxRoutesPerLocale < 1) {
      throw new RangeError("maxRoutesPerLocale must be a positive integer");
    }
  }

  get(locale: string | undefined, route: string): T | undefined {
    const routes = this.entries.get(locale);
    if (!routes?.has(route)) return undefined;

    const value = routes.get(route) as T;
    routes.delete(route);
    routes.set(route, value);
    return value;
  }

  set(locale: string | undefined, route: string, value: T): void {
    let routes = this.entries.get(locale);
    if (!routes) {
      routes = new Map<string, T>();
      this.entries.set(locale, routes);
    }

    routes.delete(route);
    routes.set(route, value);

    while (routes.size > this.maxRoutesPerLocale) {
      const oldestRoute = routes.keys().next().value;
      if (oldestRoute === undefined) break;
      routes.delete(oldestRoute);
    }
  }
}
