import Link from "next/link";
import { ArrowLeft, ArrowRight, Paintbrush, PaintBucket } from "lucide-react";

const themes = [
  {
    key: "default",
    name: "Default",
    description:
      "Clean neutral palette with an indigo accent. Great starting point for any project.",
    import: '@import "@farming-labs/theme/default/css";',
    colors: ["#6366f1", "#0a0a0a", "#fafafa", "#262626"],
    accent: "#6366f1",
  },
  {
    key: "colorful",
    name: "Colorful",
    description:
      "Warm amber accent with a tree-line directional TOC. Inspired by fumadocs default.",
    import: '@import "@farming-labs/theme/colorful/css";',
    colors: ["#eab308", "#0a0a0a", "#fafafa", "#262626"],
    accent: "#eab308",
  },
  {
    key: "darksharp",
    name: "Darksharp",
    description: "All-black with sharp edges and zero border radius. Minimal and bold.",
    import: '@import "@farming-labs/theme/darksharp/css";',
    colors: ["#fafaf9", "#000000", "#a8a29e", "#292524"],
    accent: "#fafaf9",
  },
  {
    key: "pixel-border",
    name: "Pixel Border",
    description: "Refined dark UI with visible borders. Inspired by better-auth.com docs.",
    import: '@import "@farming-labs/theme/pixel-border/css";',
    colors: ["#fbfbfa", "#050505", "#8c8c8c", "#262626"],
    accent: "#fbfbfa",
  },
  {
    key: "shiny",
    name: "Shiny",
    description: "Shiny-inspired, polished purple",
    import: '@import "@farming-labs/theme/shiny/css";',
    colors: ["#f0f0f0", "#000000", "#a8a29e", "#292524"],
    accent: "#f0f0f0",
  },
  // GreenTree
  {
    key: "greentree",
    name: "GreenTree",
    description: "Bold , GreenTree inspired, emerald green",
    import: '@import "@farming-labs/theme/greentree/css";',
    colors: ["#0D9373", "#26BD6C", "#171A18", "#DFE1E0"],
    accent: "#0D9373",
  },
];

export default function ThemesPage() {
  return (
    <div
      className="min-h-dvh relative bg-black text-white"
      style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}
    >
      <div className="absolute w-full top-14 right-0 z-[999] h-px bg-white/[8%]" />
      <div className="pointer-events-none fixed inset-0 z-[999] hidden lg:block">
        <div className="mx-auto md:max-w-[90%] max-w-full h-full relative">
          <div className="absolute left-0 top-0 h-full w-px bg-white/[8%]" />
          <div className="absolute right-0 top-0 h-full w-px bg-white/[8%]" />
        </div>
      </div>
      <header className="px-6 py-5">
        <div className="mx-auto md:max-w-[90%] max-w-full mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-white/80 dark:text-white/80 pb-8">
              <Link
                href={"/"}
                className="hover:text-white transition-colors hover:no-underline font-mono uppercase text-black/50 dark:text-white/50"
              >
                Home <span className="ml-2 text-black/50 dark:text-white/50">/</span>
              </Link>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="17.5" cy="10.5" r="2.5" />
                <circle cx="8.5" cy="7.5" r="2.5" />
                <circle cx="6.5" cy="12.5" r="2.5" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
              <p className="font-mono uppercase">Themes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="overflow-x-hidden mx-auto md:max-w-[90%] max-w-full mx-auto px-6 py-12">
        {/* Info */}
        <div className="mb-10 max-w-2xl">
          <p className="text-[13px] text-white/40 leading-relaxed">
            Each theme ships as a single CSS import and a factory function. Click{" "}
            <strong className="text-white/80">Try it live</strong> to open the docs with that theme
            applied and the customizer drawer open — tweak colors, layout, and features in real
            time, then copy the generated CSS and config.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {themes.map((theme) => (
            <div
              key={theme.key}
              className="group relative rounded-none border border-white/[6%] bg-white/[2%] p-6 transition-all hover:border-white/[12%] hover:bg-white/[3%]"
            >
              {/* Color swatches */}
              <div className="flex items-center gap-2 mb-4">
                {theme.colors.map((c, i) => (
                  <div
                    key={i}
                    className="size-4 rounded-none border border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <h2 className="text-sm uppercase font-mono tracking-wide mb-1">{theme.name}</h2>
              <p className="text-[12px] text-white/40 mb-4 leading-relaxed">{theme.description}</p>

              <code className="block text-[11px] font-mono text-white/20 mb-5 break-all">
                {theme.import}
              </code>

              <Link
                href={`/docs?theme=${theme.key}`}
                className="inline-flex group items-center gap-2 text-[11px] font-mono px-4 py-2 rounded-none uppercase border transition-all hover:no-underline"
                style={{
                  borderColor: `${theme.accent}20`,
                  color: theme.accent,
                  background: `${theme.accent}04`,
                }}
              >
                Try it live
                <ArrowRight className="size-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
              </Link>
            </div>
          ))}
        </div>
        <div className="h-px w-[calc(100%+200px)] -ml-[100px]  mx-auto bg-white/[8%] my-12" />
      </main>
    </div>
  );
}
