export function ChangelogActions() {
  const actionClass =
    "inline-flex min-h-9 items-center justify-center rounded-full border border-fd-border/70 bg-fd-card/70 px-3.5 py-2 text-[0.8rem] font-medium text-fd-foreground no-underline transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground";

  return (
    <>
      <a
        className={actionClass}
        href="https://github.com/farming-labs/docs"
        target="_blank"
        rel="noreferrer"
      >
        Follow GitHub
      </a>
      <a
        className={actionClass}
        href="mailto:hello@farming-labs.dev?subject=Docs%20changelog%20updates"
      >
        Subscribe
      </a>
      <a
        className={actionClass}
        href="https://x.com/farminglabs"
        target="_blank"
        rel="noreferrer"
      >
        Follow X
      </a>
    </>
  );
}
