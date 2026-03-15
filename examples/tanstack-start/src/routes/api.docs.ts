import { createFileRoute } from "@tanstack/react-router";
import { docsServer } from "@/lib/docs.server";

export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: async ({ request }) => docsServer.GET({ request }),
      POST: async ({ request }) => docsServer.POST({ request }),
    },
  },
});
