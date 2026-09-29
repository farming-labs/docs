# OpenAPI diffs

Use `docs openapi diff` to compare the currently published or target-branch contract with the
contract that will be released. The `docs api diff` alias is equivalent.

## Sources

Pass the baseline first and current contract second. Each source may be a project-relative or
absolute JSON/YAML path, a `file:` URL, or an HTTP(S) URL. External references are resolved with
the same limits and validation used by the native API reference.

```bash
pnpm exec docs openapi diff api/openapi.v1.yaml api/openapi.yaml
pnpm exec docs openapi diff --base api/openapi.v1.json --head api/openapi.yaml
pnpm exec docs api diff https://api.example.com/openapi.json api/openapi.yaml --json
```

Use `--base-url <url>` only when a request-relative remote source needs an origin. Remote source
query strings and user information are redacted from the report, but secrets passed on a command
line may remain in shell history; prefer a non-secret source URL or a protected CI environment.

## Exit policy

- `--fail-on breaking` is the default and is suitable for compatibility gates.
- `--fail-on any` rejects breaking and non-breaking contract changes.
- `--fail-on never` produces a report without rejecting detected changes.
- Load, parse, validation, or reference-resolution errors always fail the command.

`--json` prints the stable `farming-labs-openapi-diff.v1` report. It includes baseline and current
source summaries, breaking and non-breaking counts, and an ordered list of changes with stable
kinds, selectors, locations, and details.

## What is compared

The compatibility pass covers operation additions/removals, operation IDs, parameters, request
bodies, responses, media types, security, servers, deprecation, and structural request/response
schema changes. Annotation-only prose and examples are ignored. The command never calls an API
operation.

## Verification

Run the comparison once with the intended CI policy and inspect the human report. Then run it with
`--json --fail-on never`, parse the output in the consumer, and verify the `format` value before
depending on individual change fields.
