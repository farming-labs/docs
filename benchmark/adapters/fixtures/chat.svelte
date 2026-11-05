<script>
  import { FloatingAIChat } from "@farming-labs/svelte-theme";
  let style = $state("panel");
  let visible = $state(true);
</script>
<select aria-label="Chat style" bind:value={style}>
  {#each ["panel", "modal", "popover", "full-modal"] as value}<option>{value}</option>{/each}
</select>
<button onclick={() => visible = !visible}>Toggle chat mount</button>
{#key style}{#if visible}<FloatingAIChat floatingStyle={style} />{/if}{/key}
