import "@farming-labs/next/api-reference.css";
import docsConfig from "@/docs.config";
import { createNextApiReferencePage } from "@farming-labs/next/api-reference";

const ApiReferencePage = createNextApiReferencePage(docsConfig);

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default ApiReferencePage;
