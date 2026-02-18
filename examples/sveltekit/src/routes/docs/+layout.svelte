<script>
  import { DocsLayout } from "@farming-labs/svelte-theme";

  let { data, children } = $props();
</script>

<DocsLayout
  tree={data.tree}
  title="Example Docs"
  titleUrl="/docs"
  themeToggle={true}
>
  {@render children()}
</DocsLayout>
