import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

const repoRoot = path.resolve(process.cwd(), "..");

export default withDocs({
  turbopack: {
    root: repoRoot,
  },
});
