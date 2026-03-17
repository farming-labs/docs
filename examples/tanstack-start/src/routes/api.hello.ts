import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/hello")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify({ ok: true, message: "Hello from TanStack Start" }), {
          headers: {
            "Content-Type": "application/json",
          },
        }),
    },
  },
});
