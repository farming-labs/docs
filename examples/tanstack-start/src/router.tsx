import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: () => (
      <main style={{ padding: "2rem", fontFamily: "var(--fd-font-sans, sans-serif)" }}>
        <h1>Page not found</h1>
        <p>The requested documentation route does not exist.</p>
      </main>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
