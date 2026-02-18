<script>
  import { DocsLayout } from "@farming-labs/svelte-theme";
  import config from "@/docs.config";

  let { data, children } = $props();
</script>

<DocsLayout tree={data.tree} {config}>
  {@render children()}
</DocsLayout>
