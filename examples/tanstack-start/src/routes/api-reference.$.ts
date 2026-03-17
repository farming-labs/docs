import { createFileRoute } from "@tanstack/react-router";
import docsConfig from "../../docs.config";
import { createTanstackApiReference } from "@farming-labs/tanstack-start/api-reference";

const GET = createTanstackApiReference({
  ...docsConfig,
  rootDir: process.cwd(),
});

export const Route = createFileRoute("/api-reference/$")({
  server: {
    handlers: {
      GET,
    },
  },
});
