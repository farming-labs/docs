import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

export default withDocs({
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },
});
