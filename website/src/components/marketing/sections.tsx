import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IndexedLabel } from "@/components/marketing/primitives";
import { cn } from "@/lib/utils";

/** Crosshairs where a section's bottom rule crosses the content column's edges. */
export function Crosshairs() {
  return (
    <>
      <span aria-hidden className="mk-cross -bottom-[7px] -left-[7px]" />
      <span aria-hidden className="mk-cross -bottom-[7px] -right-[7px]" />
    </>
  );
}

/** A full-width band closed by a rule that runs to the viewport edges. */
export function Section({
  id,
  children,
  className,
  crosshairs = true,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  crosshairs?: boolean;
}) {
  return (
    <section className={cn("mk-rule relative w-full scroll-mt-28", className)} id={id}>
      {children}
      {crosshairs ? <Crosshairs /> : null}
    </section>
  );
}

/** Two-tone statement heading: a bold line, then a muted continuation, under an index eyebrow. */
export function SectionHeader({
  index,
  icon,
  label,
  title,
  muted,
  body,
  align = "left",
  actions,
  className,
}: {
  index?: string;
  icon?: LucideIcon;
  label?: string;
  title: ReactNode;
  muted?: ReactNode;
  body?: ReactNode;
  align?: "left" | "center";
  actions?: ReactNode;
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div className={cn("max-w-3xl", centered && "mx-auto text-center", className)}>
      {index && label ? (
        <div className={cn("mb-5 flex text-mk-fg/50", centered && "justify-center")}>
          <IndexedLabel icon={icon} index={index} label={label} />
        </div>
      ) : null}
      <h2 className="text-balance text-[clamp(1.5rem,2.6vw,2.1rem)] font-medium leading-[1.15] tracking-[-0.035em] text-mk-fg">
        {title}
        {muted ? <span className="text-mk-fg/40"> {muted}</span> : null}
      </h2>
      {body ? (
        <p
          className={cn(
            "mt-4 max-w-xl text-pretty text-[15px] leading-6 text-mk-fg/50",
            centered && "mx-auto",
          )}
        >
          {body}
        </p>
      ) : null}
      {actions ? (
        <div className={cn("mt-8 flex flex-wrap gap-3", centered && "justify-center")}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Two columns of cells split by hairlines; cells stack on small screens. */
export function CellGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid lg:grid-cols-2",
        "[&>*]:border-mk-line [&>*:nth-child(n+2)]:border-t lg:[&>*:nth-child(2)]:border-t-0 lg:[&>*:nth-child(even)]:border-l",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One feature: `01 / LABEL`, a two-tone heading, then its figure. */
export function Cell({
  id,
  index,
  label,
  title,
  muted,
  href,
  children,
  className,
}: {
  id?: string;
  index: string;
  label: string;
  title: string;
  muted?: string;
  href?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 scroll-mt-28 flex-col p-6 sm:p-10", className)} id={id}>
      <div className="flex items-center justify-between gap-4 text-mk-fg/50">
        <IndexedLabel index={index} label={label} />
        {href ? (
          <a
            aria-label={`${label} documentation`}
            className="group inline-flex items-center gap-1 font-mono text-[11px] uppercase text-mk-fg/40 hover:text-mk-fg hover:no-underline"
            href={href}
          >
            Docs
            <ArrowRight
              aria-hidden
              className="size-3 transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.8}
            />
          </a>
        ) : null}
      </div>
      <h3 className="mt-5 text-[18px] font-medium leading-snug tracking-[-0.02em] text-mk-fg">
        {title}
      </h3>
      {muted ? <p className="mt-1.5 text-[14.5px] leading-6 text-mk-fg/50">{muted}</p> : null}
      {children ? <div className="mt-7 flex-1">{children}</div> : null}
    </div>
  );
}

/** A soft tray that holds a product figure, with a dotted floor. */
export function Tray({
  children,
  className,
  dots = true,
}: {
  children: ReactNode;
  className?: string;
  dots?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative h-[320px] overflow-hidden rounded-lg border border-mk-line bg-mk-fg/[0.02] p-3 sm:p-4",
        dots && "mk-dots",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Compact feature: linked title with an arrow, then a short description. */
export function FeatureItem({
  title,
  href,
  children,
  className,
}: {
  title: string;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <a
        className="group inline-flex items-center gap-1.5 text-[15px] font-medium tracking-[-0.015em] text-mk-fg hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mk-fg"
        href={href}
      >
        {title}
        <ArrowRight
          aria-hidden
          className="size-4 opacity-50 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
          strokeWidth={1.8}
        />
      </a>
      <p className="mt-1 text-pretty text-[14px] leading-6 text-mk-fg/50">{children}</p>
    </div>
  );
}

/** A row of numbered anchors to the sections below, like a table of contents. */
export function NumberedStrip({
  items,
}: {
  items: ReadonlyArray<{ label: string; href: string }>;
}) {
  return (
    <nav aria-label="On this page" className="mk-rule relative w-full">
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item, index) => (
          <li
            key={item.href}
            className="border-mk-line [&:not(:last-child)]:border-r max-lg:[&:nth-child(-n+3)]:border-b max-sm:[&:nth-child(-n+4)]:border-b max-sm:[&:nth-child(2n)]:border-r-0 sm:max-lg:[&:nth-child(3n)]:border-r-0"
          >
            <a
              className="group relative flex h-full flex-col gap-2 px-5 py-4 transition-colors duration-150 hover:bg-mk-fg/[0.03] hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mk-fg sm:px-6"
              href={item.href}
            >
              <span className="font-mono text-[11px] text-mk-fg/40">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[14px] font-medium tracking-[-0.01em] text-mk-fg/70 transition-colors group-hover:text-mk-fg">
                {item.label}
              </span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-mk-fg transition-transform duration-200 group-hover:scale-x-100"
              />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
