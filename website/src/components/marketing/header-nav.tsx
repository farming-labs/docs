"use client";

import { usePathname } from "@farm.js/core/navigation";
import { navItems } from "@/components/marketing/nav-items";
import { IndexedLabel } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

/** Desktop navigation. Client-side only for the current-page underline. */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden items-stretch self-stretch border-l border-mk-line lg:flex"
    >
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a
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
          </a>
        );
      })}
    </nav>
  );
}
