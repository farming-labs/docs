# Scenario Catalog

Scenarios describe the docs subject and implementation task. The provider should change, but the
scenario should not.

Good scenario subjects include:

- A framework guide, such as adding a route, plugin, middleware, or adapter.
- An SDK guide, such as configuring auth, billing, storage, or telemetry.
- An API guide, such as implementing a webhook receiver or client wrapper.
- A product/internal-platform guide, such as adding an agent prompt endpoint.

Each scenario should include:

- Equivalent provider docs for `farming-labs` and `mintlify`.
- Equivalent provider projects for every provider run. For Codex, use
  `benchmark/codex/<provider>`.
- An acceptance script that verifies behavior, not just text shape.
- A scoring definition for relevant pages and noisy/wrong pages.

Use separate scenarios for separate claims. A docs-to-implementation scenario should keep provider
projects equivalent and only vary the docs provider. A setup-friction scenario should vary each
provider's real package, install command, generated files, and docs app acceptance checks.

Farming Labs/docs optimization should use `<Agent>...</Agent>` blocks or `agent.md` overrides to
deliver implementation-only guidance directly to agents while keeping the human docs clean.

## Error-Rate Stress Scenarios

Use [error-rate-stress.md](./error-rate-stress.md) when the claim is specifically about reducing
agent mistakes. These scenarios must keep Mintlify honest: same human docs, same task, same
acceptance, and no intentionally broken or misleading Mintlify content. Farming Labs/docs can still
use its agent primitives to package the same facts as a machine-readable runbook.
