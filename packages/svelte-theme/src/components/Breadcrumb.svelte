<script>
  /**
   * Breadcrumb — Path-based breadcrumb showing parent / current.
   */
  let { pathname = "", entry = "docs" } = $props();

  let segments = $derived.by(() => {
    return pathname.split("/").filter(Boolean);
  });

  let parentLabel = $derived.by(() => {
    if (segments.length < 2) return "";
    return segments[segments.length - 2]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  });

  let currentLabel = $derived.by(() => {
    if (segments.length < 2) return "";
    return segments[segments.length - 1]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  });

  let parentUrl = $derived.by(() => {
    if (segments.length < 2) return "";
    return "/" + segments.slice(0, segments.length - 1).join("/");
  });
</script>

{#if segments.length >= 2}
  <nav class="fd-breadcrumb" aria-label="Breadcrumb">
    <span class="fd-breadcrumb-item">
      <a href={parentUrl} class="fd-breadcrumb-parent fd-breadcrumb-link">
        {parentLabel}
      </a>
    </span>
    <span class="fd-breadcrumb-item">
      <span class="fd-breadcrumb-sep">/</span>
      <span class="fd-breadcrumb-current">{currentLabel}</span>
    </span>
  </nav>
{/if}
