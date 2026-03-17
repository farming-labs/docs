import docsConfig from "@/docs.config";
import { createNextApiReference } from "@farming-labs/next/api-reference";

export const GET = createNextApiReference(docsConfig);

export const revalidate = false;
