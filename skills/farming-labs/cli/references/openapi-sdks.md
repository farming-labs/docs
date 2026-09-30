# OpenAPI SDKs

Use `docs openapi sdk` to generate a deterministic TypeScript fetch client. The `docs api sdk`
alias is equivalent.

## Sources and output

The source may be a project-relative or absolute JSON/YAML path, a `file:` URL, or an HTTP(S)
URL. External references use the same bounded resolver as the native API reference. The output is
required and must be a file inside the project root.

```bash
pnpm exec docs openapi sdk api/openapi.yaml --output src/generated/api-client.ts
pnpm exec docs api sdk --source https://api.example.com/openapi.json --out src/generated/api-client.ts
```

The module contains component schema types, operation input and successful-response types, a
fetch-based client, request serialization, and `ApiError`. Set a runtime base URL with
`--base-url` or the generated constructor. Pass authentication through default or per-request
headers; credentials are never copied from the contract.

## Safe generation

- `--check` exits non-zero when the output is missing or stale and does not write.
- `--dry-run` prints the generated module without writing.
- `--client-name <name>` overrides the generated class name.
- `--source-base-url <url>` resolves a request-relative remote source.
- `--force` replaces a non-generated file; inspect that file before using it.

Without `--force`, the command only refreshes files carrying its generated marker. Output is
deterministic and contains no generation timestamp.

## Verification

Run the generator once, inspect the output, then run the same command with `--check`. Type-check
the consumer project to validate its target and DOM fetch typings. If `--check` reports stale
output, regenerate from the intended contract and review the SDK diff before committing it.
