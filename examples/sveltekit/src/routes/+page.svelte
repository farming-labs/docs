<script>
</script>

<div class="home">
  <h1>Docs Framework Example</h1>
  <p>Welcome to the Farming Labs docs framework (SvelteKit example).</p>
  <ul>
    <li><a href="/docs">Docs root</a></li>
    <li><a href="/docs/installation">Installation</a></li>
    <li><a href="/docs/get-started">Get Started</a></li>
  </ul>
</div>

<style>
  .home {
    max-width: 768px;
    margin: 0 auto;
    padding: 3rem 1.5rem;
  }

  h1 {
    margin-bottom: 1rem;
  }

  p {
    margin-bottom: 1.5rem;
    color: var(--color-fd-muted-foreground, #999);
  }

  ul {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  a {
    color: var(--color-fd-primary, #6366f1);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
