import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Cloud,
  Gauge,
  Menu,
  Palette,
  Search,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DocsCommandSearch } from "@/components/docs-command-search";
import { SidebarThemeToggle } from "@/components/sidebar-theme-toggle";
import { FarmingLabsMark, SimpleIcon } from "@/components/marketing/brand-icons";
import { getLatestRelease } from "@/lib/latest-release";
import { cn } from "@/lib/utils";

const navItems = [
  { index: "01", label: "Docs", href: "/docs", icon: BookOpen },
  { index: "02", label: "Themes", href: "/themes", icon: Palette },
  { index: "03", label: "Cloud", href: "/cloud", icon: Cloud },
  { index: "04", label: "Agent score", href: "/score", icon: Gauge },
] as const;

export type MarketingPage = "home" | "cloud" | "themes" | "showcase" | "score" | "changelog";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg";

export function isExternal(href: string) {
  return href.startsWith("http");
}

/** Small mono eyebrow: `02 / Label`. Carries the farm.js index rhythm into each section. */
export function IndexedLabel({
  index,
  icon: Icon,
  label,
  className,
}: {
  index: string;
  icon?: LucideIcon;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 font-mono text-[11px] font-normal uppercase tracking-normal text-current",
        className,
      )}
    >
      <span aria-hidden className="opacity-50">
        {index}
      </span>
      <span aria-hidden className="opacity-35">
        /
      </span>
      {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.5} /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  icon,
  size = "default",
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  size?: "default" | "compact";
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const external = isExternal(href);

  return (
    <Link
      className={cn(
        "group inline-flex min-w-0 items-center justify-center gap-2 rounded-none border font-medium tracking-[-0.01em] whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 hover:no-underline active:scale-[0.98]",
        focusRing,
        size === "default" && "h-11 px-5 text-[15px]",
        size === "compact" && "h-9 px-3.5 text-[14px]",
        variant === "primary" &&
          "border-mk-fg bg-mk-fg text-mk-bg hover:bg-mk-fg/85 hover:text-mk-bg",
        variant === "secondary" &&
          "border-mk-fg/15 bg-mk-bg text-mk-fg hover:border-mk-fg/35 hover:bg-mk-fg/[0.05] hover:text-mk-fg",
        variant === "ghost" &&
          "border-transparent text-mk-fg/70 hover:bg-mk-fg/[0.05] hover:text-mk-fg",
        className,
      )}
      href={href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {icon}
      <span>{children}</span>
      {external ? (
        <ArrowUpRight aria-hidden className="size-3.5 opacity-60" strokeWidth={1.8} />
      ) : variant !== "ghost" ? (
        <ArrowRight
          aria-hidden
          className="size-3.5 opacity-60 transition-transform duration-150 group-hover:translate-x-0.5"
          strokeWidth={1.8}
        />
      ) : null}
    </Link>
  );
}

/** Top announcement: a `NEW` tag and a one-line release note, linked to the changelog. */
/** The newest release from GitHub, linked to its release page. */
export async function AnnouncementBar() {
  const release = await getLatestRelease();
  return (
    <a
      className="group flex min-h-10 items-center justify-center gap-2.5 border-b border-mk-line px-4 text-center font-mono text-[11px] tracking-normal text-mk-fg/60 transition-colors hover:text-mk-fg hover:no-underline"
      href={release.href}
      rel="noreferrer"
      target="_blank"
    >
      <span className="shrink-0 rounded-none bg-mk-fg px-1.5 py-0.5 text-[10px] uppercase text-mk-bg">
        Latest
      </span>
      <span className="min-w-0 truncate">
        <span className="text-mk-fg">{release.version}</span>
        {release.title ? <> · {release.title}</> : null}
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-mk-fg/40 transition-colors group-hover:text-mk-fg sm:inline-flex">
        Release notes
        <ArrowUpRight
          aria-hidden
          className="size-3 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px"
          strokeWidth={1.8}
        />
      </span>
    </a>
  );
}

function BrandLockup() {
  return (
    <Link
      aria-label="@farming-labs/docs home"
      className="flex min-w-0 items-center gap-3 text-mk-fg hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mk-fg"
      href="/"
    >
      <FarmingLabsMark className="h-[18px] w-auto" />
      <span aria-hidden className="text-[20px] font-light text-mk-fg/25">
        /
      </span>
      <span className="font-mono text-[12px] tracking-normal">
        @farming-labs<span className="opacity-50">/docs</span>
      </span>
    </Link>
  );
}

function SearchButton() {
  // DocsCommandSearch opens on ⌘K and on any button that reads "Search … ⌘K".
  return (
    <button
      className={cn(
        "hidden h-8 w-52 items-center gap-2 rounded-none border border-mk-fg/12 bg-mk-fg/[0.03] pl-3 pr-1.5 text-left text-[13px] text-mk-fg/50 transition-colors duration-150 hover:border-mk-fg/25 hover:text-mk-fg/80 lg:flex",
        focusRing,
      )}
      type="button"
    >
      <Search aria-hidden className="size-3.5" strokeWidth={1.8} />
      <span className="flex-1">Search docs…</span>
      <kbd className="rounded border border-mk-fg/12 px-1.5 py-0.5 font-mono text-[10px] text-mk-fg/50">
        ⌘K
      </kbd>
    </button>
  );
}

export function MarketingHeader({ current }: { current?: MarketingPage }) {
  return (
    <header className="mk-rule sticky top-0 z-50 bg-mk-bg/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-12 w-full items-center gap-6 px-4 sm:px-6">
        <BrandLockup />

        <nav
          aria-label="Primary navigation"
          className="hidden items-stretch self-stretch border-l border-mk-line lg:flex"
        >
          {navItems.map((item) => {
            const active = current !== undefined && item.href === `/${current}`;
            return (
              <Link
                key={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center border-r border-mk-line px-4 text-mk-fg/50 transition-[background-color,color] duration-150 hover:bg-mk-fg/[0.035] hover:text-mk-fg hover:no-underline aria-[current=page]:bg-mk-fg/[0.04] aria-[current=page]:text-mk-fg xl:px-5",
                  "focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mk-fg",
                )}
                href={item.href}
              >
                <IndexedLabel icon={item.icon} index={item.index} label={item.label} />
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-px origin-left bg-mk-fg transition-transform duration-200",
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchButton />
          <Link
            aria-label="@farming-labs/docs on GitHub"
            className={cn(
              "hidden size-8 place-items-center rounded-none text-mk-fg/60 transition-colors duration-150 hover:bg-mk-fg/[0.05] hover:text-mk-fg sm:grid",
              focusRing,
            )}
            href="https://github.com/farming-labs/docs"
            rel="noreferrer"
            target="_blank"
          >
            <SimpleIcon className="size-[18px]" name="github" />
          </Link>
          <ButtonLink
            className="hidden h-8 px-3 text-[13px] sm:inline-flex"
            href="/docs/installation"
            size="compact"
          >
            Get started
          </ButtonLink>

          <details className="group relative lg:hidden">
            <summary
              className={cn(
                "grid size-8 cursor-pointer list-none place-items-center rounded-none text-mk-fg transition-colors hover:bg-mk-fg/[0.05] [&::-webkit-details-marker]:hidden",
                focusRing,
              )}
            >
              <span className="sr-only">Open navigation</span>
              <Menu aria-hidden className="size-[18px] group-open:hidden" strokeWidth={1.6} />
              <X aria-hidden className="hidden size-[18px] group-open:block" strokeWidth={1.6} />
            </summary>
            <nav
              aria-label="Mobile navigation"
              className="absolute right-0 top-10 w-[min(calc(100vw-2rem),20rem)] overflow-hidden border border-mk-line bg-mk-bg p-1.5 shadow-2xl shadow-black/25"
            >
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  className="flex h-11 items-center rounded-none px-3 text-mk-fg/65 hover:bg-mk-fg/[0.05] hover:text-mk-fg hover:no-underline"
                  href={item.href}
                >
                  <IndexedLabel icon={item.icon} index={item.index} label={item.label} />
                </Link>
              ))}
              <Link
                className="mt-1 flex h-11 items-center justify-center rounded-none bg-mk-fg text-[15px] font-medium text-mk-bg hover:bg-mk-fg/85 hover:text-mk-bg hover:no-underline"
                href="/docs/installation"
              >
                Get started
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

const footerColumns: ReadonlyArray<{
  title: string;
  links: ReadonlyArray<readonly [label: string, href: string]>;
}> = [
  {
    title: "Framework",
    links: [
      ["Introduction", "/docs"],
      ["Installation", "/docs/installation"],
      ["Configuration", "/docs/configuration"],
      ["CLI", "/docs/cli"],
      ["Migrations", "/docs/migrations"],
    ],
  },
  {
    title: "Agents",
    links: [
      ["MCP server", "/docs/customization/mcp"],
      ["llms.txt", "/docs/customization/llms-txt"],
      ["Page actions", "/docs/customization/page-actions"],
      ["Ask AI", "/docs/customization/ai-chat"],
      ["Agent score", "/score"],
    ],
  },
  {
    title: "Product",
    links: [
      ["Themes", "/themes"],
      ["Cloud", "/cloud"],
      ["API reference", "/api-reference"],
      ["Showcase", "/showcase"],
      ["Changelog", "/changelog"],
    ],
  },
  {
    title: "Farming Labs",
    links: [
      ["GitHub", "https://github.com/farming-labs/docs"],
      ["npm", "https://www.npmjs.com/package/@farming-labs/docs"],
      ["X", "https://x.com/KinfishT"],
      ["farmjs.dev", "https://farmjs.dev"],
      ["orm.farming-labs.dev", "https://orm.farming-labs.dev"],
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="w-full">
      <div className="grid gap-10 px-6 py-14 sm:grid-cols-2 sm:px-10 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] lg:px-12">
        <div className="max-w-xs">
          <BrandLockup />
          <p className="mt-4 text-[14px] leading-6 text-mk-fg/50">
            The documentation framework for people and agents. Open source and MIT licensed.
          </p>
        </div>
        {footerColumns.map((column) => (
          <div key={column.title}>
            <h3 className="text-[14px] font-medium text-mk-fg">{column.title}</h3>
            <ul className="mt-4 grid gap-2.5">
              {column.links.map(([label, href]) => {
                const external = isExternal(href);
                return (
                  <li key={label}>
                    <Link
                      className="inline-flex items-center gap-1 text-[14px] text-mk-fg/55 transition-colors duration-150 hover:text-mk-fg hover:no-underline"
                      href={href}
                      rel={external ? "noreferrer" : undefined}
                      target={external ? "_blank" : undefined}
                    >
                      {label}
                      {external ? (
                        <ArrowUpRight aria-hidden className="size-3 opacity-50" strokeWidth={1.8} />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="mk-top-rule flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-12">
        <div className="flex items-center gap-3 text-[13px] text-mk-fg/45">
          <FarmingLabsMark className="h-3.5 w-auto text-mk-fg/70" />
          <span>&copy; {new Date().getFullYear()} Farming Labs</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-normal text-mk-fg/50 transition-colors hover:text-mk-fg hover:no-underline"
            href="https://status.farming-labs.dev"
            rel="noreferrer"
            target="_blank"
          >
            <span aria-hidden className="size-1.5 rounded-full border border-current" />
            System status
          </Link>
          <span aria-hidden className="h-4 w-px bg-mk-line" />
          <SidebarThemeToggle
            className="grid size-8 place-items-center rounded-none border border-mk-line text-mk-fg/60 transition-colors hover:text-mk-fg"
            variant="icon"
          />
        </div>
      </div>
    </footer>
  );
}

/** Rails, sticky header, and footer shared by the landing and cloud pages. */
export function MarketingShell({
  children,
  current,
}: {
  children: ReactNode;
  current?: MarketingPage;
}) {
  return (
    <div className="mk-page min-h-screen overflow-x-clip font-sans antialiased">
      <div className="mk-grid">
        <div aria-hidden className="mk-rail" />
        <div className="mk-content min-w-0">
          <AnnouncementBar />
          <MarketingHeader current={current} />
          <main>{children}</main>
          <MarketingFooter />
        </div>
        <div aria-hidden className="mk-rail" />
      </div>
      <DocsCommandSearch />
    </div>
  );
}
