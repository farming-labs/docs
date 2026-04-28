import Link from "next/link";
import type { ReactNode } from "react";

function BrandMarkInner({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <img
        src="/logo/light.svg"
        alt="Surge"
        className={`${compact ? "h-8" : "h-10 sm:h-11"} w-auto dark:hidden`}
      />
      <img
        src="/logo/dark.svg"
        alt="Surge"
        className={`${compact ? "h-8" : "h-10 sm:h-11"} hidden w-auto dark:block`}
      />
      <span
        className={compact ? "text-sm font-semibold tracking-tight" : "text-base font-semibold tracking-tight"}
      >
        Surge
      </span>
    </>
  );
}

function BrandContainer({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-3 no-underline" style={{ color: "inherit" }}>
      {children}
    </span>
  );
}

export function BrandMark({
  compact = false,
  linked = true,
}: {
  compact?: boolean;
  linked?: boolean;
}) {
  const content = <BrandMarkInner compact={compact} />;

  if (!linked) {
    return <BrandContainer>{content}</BrandContainer>;
  }

  return (
    <Link href="/" className="inline-flex items-center gap-3 no-underline" style={{ color: "inherit" }}>
      {content}
    </Link>
  );
}

export function SectionLinks({
  current,
}: {
  current: "api-reference" | "guides" | "ui";
}) {
  const links = [
    { href: "/api-reference", label: "API Reference", key: "api-reference" },
    { href: "/guides", label: "Guides", key: "guides" },
    { href: "/ui", label: "UI Components", key: "ui" },
  ] as const;

  return (
    <div className="surge-sidebar-banner">
      <div className="surge-sidebar-banner-links">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="surge-sidebar-banner-link"
            data-active={current === link.key}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <Link href="https://hq.surge.app" className="surge-button surge-button-primary w-full" target="_blank">
        Open Dashboard
      </Link>
    </div>
  );
}

export function SidebarFooter() {
  return (
    <div className="surge-sidebar-footer">
      <p className="surge-sidebar-footer-copy">
        Support for embedded messaging, campaigns, and webhook-driven workflows.
      </p>
      <div className="surge-sidebar-footer-links">
        <a href="mailto:support@surge.app">support@surge.app</a>
        <a href="https://x.com/surgeapi" target="_blank" rel="noreferrer">
          X
        </a>
        <a href="https://github.com/surgeapi" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="https://www.linkedin.com/company/surgeapi" target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      </div>
    </div>
  );
}
