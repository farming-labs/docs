<script>
  import { DocsLayout } from "@farming-labs/svelte-theme";
  import AskAITrigger from "$lib/components/AskAITrigger.svelte";
  import config from "../../lib/docs.config";

  let { data, children } = $props();
</script>

<DocsLayout tree={data.tree} {config} triggerComponent={AskAITrigger}>
  {@render children()}
</DocsLayout>
