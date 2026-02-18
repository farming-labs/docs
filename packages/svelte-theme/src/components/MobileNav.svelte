<script>
  /**
   * MobileNav — Hamburger menu trigger for mobile sidebar.
   */
  let { onclick } = $props();
</script>

<button class="fd-mobile-nav-btn" {onclick} aria-label="Open menu">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
</button>
