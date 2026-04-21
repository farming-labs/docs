# Scenario: Provider Setup Friction

This scenario is for measuring each docs framework's own package and scaffold flow. Keep it separate
from docs-to-implementation runs so install friction does not blur retrieval and implementation
quality.

Codex should start in an empty startup repo and receive only the provider docs URL plus a task such
as:

1. Scaffold a production docs site for Northstar CRM.
2. Add the documented navigation, markdown routes, and agent-readable entrypoints.
3. Run the provider's build or acceptance command.

## Provider-Specific Inputs

- `farming-labs`: use `@farming-labs/docs`, `@farming-labs/next`, and `@farming-labs/theme`.
- `mintlify`: use Mintlify's CLI/package flow.

## What Is Measured

- Time to first successful scaffold.
- Install/build command errors.
- Files created or modified by the scaffold.
- Whether the generated docs site exposes the required markdown/agent routes.
- Token and docs-fetch cost needed to finish setup.
