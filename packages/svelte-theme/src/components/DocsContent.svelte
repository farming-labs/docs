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

  let tocStyle = $derived(
    config?.theme?.ui?.layout?.toc?.style ?? "default"
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

  let llmsTxtEnabled = $derived.by(() => {
    const cfg = config?.llmsTxt;
    if (cfg === true) return true;
    if (typeof cfg === "object" && cfg !== null) return cfg.enabled !== false;
    return false;
  });
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
  {tocStyle}
  {breadcrumbEnabled}
  previousPage={data.previousPage}
  nextPage={data.nextPage}
  editOnGithub={showEditOnGithub ? data.editOnGithub : null}
  lastModified={showLastModified ? data.lastModified : null}
  {llmsTxtEnabled}
>
  {#snippet children()}
    {#if data.description}
      <p class="fd-page-description">{data.description}</p>
    {/if}
    {@html data.html}
  {/snippet}
</DocsPage>
