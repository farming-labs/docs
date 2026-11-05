<script>
  import { onMount } from "svelte";

  let props = $props();
  let mounted = $state(false);
  let Content = $state(null);
  let requestedOpen = $state(false);
  let loading;
  let disposed = false;
  const triggerComponent = $derived(props.triggerComponent);
  const label = $derived(props.aiLabel || "AI");
  const isFullModal = $derived(props.floatingStyle === "full-modal");
  const positions = {
    "bottom-right": "bottom:24px;right:24px",
    "bottom-left": "bottom:24px;left:24px",
    "bottom-center": "bottom:24px;left:50%;transform:translateX(-50%)",
  };
  const btnStyle = $derived(positions[props.position] || positions["bottom-right"]);

  onMount(() => {
    mounted = true;
    return () => { disposed = true; };
  });

  async function open() {
    requestedOpen = true;
    try {
      loading ??= import("./FloatingAIChatContent.svelte");
      const module = await loading;
      if (!disposed) Content = module.default;
    } catch (error) {
      // Leave the existing trigger usable so a failed chunk can be retried.
      loading = undefined;
      console.error("Unable to load Ask AI", error);
    }
  }
</script>

<svelte:window onkeydown={(event) => {
  if (!Content && event.key === "Escape") requestedOpen = false;
}} />

{#if Content}
  <Content {...props} initialOpen={requestedOpen} />
{:else if mounted}
  {#if isFullModal}
      <div class="fd-ai-fm-trigger-fixed" style={btnStyle}>
        {#if triggerComponent}
          {@const Trigger = triggerComponent}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div onclick={open} class="fd-ai-floating-trigger fd-ai-floating-trigger--static">
            <Trigger aiLabel={label} />
          </div>
        {:else}
          <button
            onclick={open}
            class="fd-ai-fm-trigger-btn"
            aria-label="Ask {label}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              <path d="M20 3v4"/><path d="M22 5h-4"/>
            </svg>
            <span>Ask {label}</span>
          </button>
        {/if}
      </div>
  {:else}
      {#if triggerComponent}
        {@const Trigger = triggerComponent}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          onclick={open}
          class="fd-ai-floating-trigger"
          style={btnStyle}
        >
          <Trigger aiLabel={label} />
        </div>
      {:else}
        <button
          onclick={open}
          aria-label="Ask {label}"
          class="fd-ai-floating-btn"
          style={btnStyle}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4"/><path d="M22 5h-4"/>
          </svg>
          <span>Ask {label}</span>
        </button>
      {/if}
  {/if}
{/if}
