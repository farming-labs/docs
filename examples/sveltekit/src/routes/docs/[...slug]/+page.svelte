<script>
  import { DocsContent } from "@farming-labs/svelte-theme";
  import config from "$lib/docs.config.js";

  let { data } = $props();
</script>

<DocsContent {data} {config} />
