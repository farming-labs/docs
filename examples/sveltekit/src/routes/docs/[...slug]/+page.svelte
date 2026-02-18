<script>
  import { DocsContent } from "@farming-labs/svelte-theme";
  import config from "@/docs.config";

  let { data } = $props();
</script>

<DocsContent {data} {config} />
