import docsConfig from "@/docs.config";
import { createDocsMCPAPI } from "@farming-labs/next/api";

export const { GET, POST, DELETE, OPTIONS } = createDocsMCPAPI(docsConfig);

export const revalidate = false;
