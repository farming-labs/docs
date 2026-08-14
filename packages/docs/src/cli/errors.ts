const CLI_ERROR_REPORTED_KEY = "__farmingLabsDocsCliErrorReported";

type ReportedCliError = {
  [CLI_ERROR_REPORTED_KEY]?: boolean;
};

export function formatCliError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return "An unexpected error occurred.";
}

export function markCliErrorReported(error: unknown): void {
  if (error && typeof error === "object") {
    (error as ReportedCliError)[CLI_ERROR_REPORTED_KEY] = true;
  }
}

export function wasCliErrorReported(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    (error as ReportedCliError)[CLI_ERROR_REPORTED_KEY] === true,
  );
}

export function shouldPrintStackTrace(env: NodeJS.ProcessEnv = process.env): boolean {
  const debug = env.DOCS_DEBUG ?? env.DEBUG;
  return debug === "1" || debug === "true" || debug === "@farming-labs/docs";
}
