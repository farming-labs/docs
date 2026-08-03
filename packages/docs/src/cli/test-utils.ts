const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}
