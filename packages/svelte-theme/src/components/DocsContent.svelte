<script>
  import DocsPage from "./DocsPage.svelte";

  let { data, config = null } = $props();

  let titleSuffix = $derived(
    config?.metadata?.titleTemplate
      ? config.metadata.titleTemplate.replace("%s", "")
      : " – Docs"
  );

  let tocEnabled = $derived(
    config?.theme?.ui?.layout?.toc?.enabled ?? true
  );

  let breadcrumbEnabled = $derived.by(() => {
    const bc = config?.breadcrumb;
    if (bc === undefined || bc === true) return true;
    if (bc === false) return false;
    if (typeof bc === "object") return bc.enabled !== false;
    return true;
  });

  let showEditOnGithub = $derived(
    !!config?.github && !!data.editOnGithub
  );

  let showLastModified = $derived(!!data.lastModified);
</script>

<svelte:head>
  <title>{data.title}{titleSuffix}</title>
  {#if data.description}
    <meta name="description" content={data.description} />
  {/if}
</svelte:head>

<DocsPage
  entry={config?.entry ?? "docs"}
  {tocEnabled}
  {breadcrumbEnabled}
  previousPage={data.previousPage}
  nextPage={data.nextPage}
  editOnGithub={showEditOnGithub ? data.editOnGithub : null}
  lastModified={showLastModified ? data.lastModified : null}
>
  {#snippet children()}
    {@html data.html}
  {/snippet}
</DocsPage>
