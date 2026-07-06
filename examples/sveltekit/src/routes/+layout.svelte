<script>
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>Example Docs — SvelteKit</title>
  <meta name="description" content="Docs framework SvelteKit example" />
</svelte:head>

{@render children()}

<style>
  :global(html),
  :global(body) {
    margin: 0;
    min-width: 320px;
  }

  :global(body) {
    background: #0b0b0c;
    color: #f4f1e8;
  }
</style>
