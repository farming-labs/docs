<script>
  /**
   * Breadcrumb — Path-based breadcrumb showing parent / current.
   */
  let { pathname = "", entry = "docs", locale = undefined } = $props();

  let segments = $derived.by(() => {
    return pathname.split("/").filter(Boolean);
  });

  let entryParts = $derived.by(() => {
    return entry.split("/").filter(Boolean);
  });

  let contentSegments = $derived.by(() => {
    return segments.slice(entryParts.length);
  });

  let parentLabel = $derived.by(() => {
    if (contentSegments.length < 2) return "";
    return contentSegments[contentSegments.length - 2]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  });

  let currentLabel = $derived.by(() => {
    if (contentSegments.length < 2) return "";
    return contentSegments[contentSegments.length - 1]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  });

  let parentUrl = $derived.by(() => {
    if (contentSegments.length < 2) return "";
    return (
      "/" +
      [...segments.slice(0, entryParts.length), ...contentSegments.slice(0, -1)].join("/")
    );
  });

  let localizedParentUrl = $derived.by(() => {
    if (!parentUrl) return "";
    try {
      const url = new URL(parentUrl, "https://farming-labs.local");
      if (locale) url.searchParams.set("lang", locale);
      else url.searchParams.delete("lang");
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return parentUrl;
    }
  });
</script>

{#if contentSegments.length >= 2}
  <nav class="fd-breadcrumb" aria-label="Breadcrumb">
    <span class="fd-breadcrumb-item">
      <a href={localizedParentUrl} class="fd-breadcrumb-parent fd-breadcrumb-link">
        {parentLabel}
      </a>
    </span>
    <span class="fd-breadcrumb-item">
      <span class="fd-breadcrumb-sep">/</span>
      <span class="fd-breadcrumb-current">{currentLabel}</span>
    </span>
  </nav>
{/if}
