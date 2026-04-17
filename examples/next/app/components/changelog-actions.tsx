import { BellRing, Github } from "lucide-react";

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h3.7l4.2 5.9L16.8 4H20l-6.5 7.5L20 20h-3.7l-4.6-6.3L7.1 20H4l6.6-7.7z" />
    </svg>
  );
}

export function ChangelogActions() {
  return (
    <>
      <a
        className="fd-changelog-action-link"
        href="https://github.com/farming-labs/docs"
        target="_blank"
        rel="noreferrer"
      >
        <Github />
        Follow GitHub
      </a>
      <a
        className="fd-changelog-action-link"
        href="mailto:hello@farming-labs.dev?subject=Docs%20changelog%20updates"
      >
        <BellRing />
        Subscribe
      </a>
      <a
        className="fd-changelog-action-link"
        href="https://x.com/farminglabs"
        target="_blank"
        rel="noreferrer"
      >
        <XIcon />
        Follow X
      </a>
    </>
  );
}
