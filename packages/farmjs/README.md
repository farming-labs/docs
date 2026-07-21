# @farming-labs/farmjs

The official Farm.js runtime adapter for
[`@farming-labs/docs`](https://www.npmjs.com/package/@farming-labs/docs).

## Install

```bash
npm install @farming-labs/docs @farming-labs/farmjs @farming-labs/theme
```

## Configure Farm

Keep documentation settings in `docs.config.ts`, then enable the adapter from
`farm.config.ts`:

```ts
import { defineConfig } from "@farmjs/core";
import { withDocs } from "@farming-labs/farmjs/config";

export default withDocs(
  defineConfig({
    preset: "vercel",
  }),
);
```

Farm discovers `docs.config.ts` from the application root. A different path can
be provided explicitly:

```ts
export default withDocs(defineConfig({}), {
  configPath: "config/docs.config.ts",
});
```

## License

MIT
