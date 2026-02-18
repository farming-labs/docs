<script>
  import "../app.css";

  let { children } = $props();
</script>

<svelte:head>
  <title>Example Docs — SvelteKit</title>
  <meta name="description" content="Docs framework SvelteKit example" />
</svelte:head>

{@render children()}
