import type { LucideIcon } from "lucide-react";

export function FeatureGridCard({
  title,
  icon: Icon,
  description,
  label,
  chips,
}: {
  title: string;
  icon: LucideIcon;
  backgroundIcon?: LucideIcon;
  description: string;
  label: string;
  chips: readonly string[];
}) {
  return (
    <div className="flex h-full flex-col border border-black/10 bg-black/[0.012] p-5 dark:border-white/10 dark:bg-white/[0.012] sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <Icon className="size-5 stroke-[1.6] text-black/70 dark:text-white/70" />
        <p className="text-right font-mono text-[10px] uppercase tracking-[0.12em] text-black/40 dark:text-white/40">
          {label}
        </p>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold tracking-tight text-black dark:text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-black/58 dark:text-white/50">{description}</p>
      </div>

      <ul
        aria-label={`${title} capabilities`}
        className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-black/8 pt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-black/45 dark:border-white/10 dark:text-white/42"
      >
        {chips.map((chip) => (
          <li key={chip}>{chip}</li>
        ))}
      </ul>
    </div>
  );
}
