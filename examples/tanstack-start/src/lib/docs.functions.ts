import { createServerFn } from "@tanstack/react-start";
import { docsServer } from "./docs.server";

export const loadDocPage = createServerFn({ method: "GET" })
  .inputValidator((data: { pathname: string; locale?: string }) => data)
  .handler(async ({ data }) => docsServer.load(data));
