<script>
  import DocsPage from "./DocsPage.svelte";

  let { data, config = null } = $props();

  let titleSuffix = $derived(
    config?.metadata?.titleTemplate
      ? config.metadata.titleTemplate.replace("%s", "")
      : " – Docs"
  );
</script>

<svelte:head>
  <title>{data.title}{titleSuffix}</title>
  {#if data.description}
    <meta name="description" content={data.description} />
  {/if}
</svelte:head>

<DocsPage
  entry={config?.entry ?? "docs"}
  tocEnabled={true}
  breadcrumbEnabled={config?.breadcrumb?.enabled ?? true}
  previousPage={data.previousPage}
  nextPage={data.nextPage}
  editOnGithub={data.editOnGithub}
  lastModified={data.lastModified}
>
  {#snippet children()}
    {@html data.html}
  {/snippet}
</DocsPage>
