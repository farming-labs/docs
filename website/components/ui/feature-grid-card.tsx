import type { LucideIcon } from "lucide-react";

export function FeatureGridCard({
  title,
  icon: Icon,
  backgroundIcon: BackgroundIcon,
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
    <div className="relative flex h-full flex-col justify-between gap-6 bg-white px-5 pb-5 pt-6 shadow-xs dark:bg-black">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-2 top-1 h-28 w-28 rounded-full bg-black/[0.012] blur-3xl dark:bg-white/[0.018] sm:h-32 sm:w-32" />
        <div className="absolute inset-0 bg-[radial-gradient(44%_46%_at_84%_18%,rgba(0,0,0,0.02),transparent_72%)] dark:bg-[radial-gradient(44%_46%_at_84%_18%,rgba(255,255,255,0.03),transparent_72%)]" />
        {BackgroundIcon ? (
          <div className="absolute -right-2 -top-2 z-0 flex items-start justify-end sm:-right-12 sm:-top-12">
            <BackgroundIcon className="size-36 stroke-1 text-black/[0.03] dark:text-white/[0.025] sm:size-52" />
          </div>
        ) : null}
        <div className="absolute inset-0 hidden bg-[radial-gradient(50%_80%_at_25%_0%,rgba(255,255,255,0.08),transparent)] dark:block" />
      </div>
      <div className="absolute -inset-y-4 -left-px z-20 w-px bg-black/10 dark:bg-white/10" />
      <div className="absolute -inset-y-4 -right-px z-20 w-px bg-black/10 dark:bg-white/10" />
      <div className="absolute -inset-x-4 -top-px z-20 h-px bg-black/10 dark:bg-white/10" />
      <div className="absolute -bottom-px -left-4 -right-4 z-20 h-px bg-black/10 dark:bg-white/10" />
      <span className="absolute -left-px -top-px z-20 block size-2 border-l-2 border-t-2 border-black dark:border-white" />

      <div className="relative z-10 space-y-5">
        <div className="flex w-fit items-center justify-center rounded-none border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <Icon className="size-5 stroke-[1.5] text-black dark:text-white" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/45 dark:text-white/45">
            # {label}
          </p>
          <h3 className="font-pixel text-xl font-medium tracking-normal text-black dark:text-white">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-black/55 dark:text-white/45">{description}</p>
        </div>
      </div>
      <hr className="mt-4 -mx-5 bg-black/10 dark:bg-white/10" />
      <div className="relative z-10 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex border border-black/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-black/50 dark:border-white/10 dark:text-white/45"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
