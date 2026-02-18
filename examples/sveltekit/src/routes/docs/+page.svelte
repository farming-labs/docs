<script>
  import { DocsPage } from "@farming-labs/svelte-theme";

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.title} – Docs</title>
  {#if data.description}
    <meta name="description" content={data.description} />
  {/if}
</svelte:head>

<DocsPage
  entry="docs"
  tocEnabled={true}
  breadcrumbEnabled={true}
  previousPage={data.previousPage}
  nextPage={data.nextPage}
  editOnGithub={data.editOnGithub}
  lastModified={data.lastModified}
>
  {#snippet children()}
    {@html data.html}
  {/snippet}
</DocsPage>
