import { withDocs } from "@farming-labs/next/config";

export default withDocs({
  // Keep local dev on `.next`, but build/start on a separate directory so
  // workspace builds don't fail when example dev is already running.
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
});
