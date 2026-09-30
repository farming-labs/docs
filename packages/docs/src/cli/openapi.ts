import pc from "picocolors";

export function printOpenApiHelp(): void {
  console.log(`${pc.bold("docs openapi")} — OpenAPI contract utilities

Usage:
  docs openapi <command> [options]
  docs api <command> [options]

Commands:
  ${pc.cyan("diff")}  Compare contracts and detect breaking changes
  ${pc.cyan("sdk")}   Generate a typed TypeScript fetch client

Run ${pc.cyan("docs openapi <command> --help")} for command-specific options.
`);
}
