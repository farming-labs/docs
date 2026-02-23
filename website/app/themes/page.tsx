import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

const themes = [
  {
    key: "default",
    name: "Default",
    description: "Clean neutral palette with an indigo accent. Great starting point for any project.",
    import: '@import "@farming-labs/theme/default/css";',
    colors: ["#6366f1", "#0a0a0a", "#fafafa", "#262626"],
    accent: "#6366f1",
  },
  {
    key: "colorful",
    name: "Colorful",
    description: "Warm amber accent with a tree-line directional TOC. Inspired by fumadocs default.",
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
    description: "Clerk-inspired, polished purple",
    import: '@import "@farming-labs/theme/shiny/css";',
    colors: ["#f0f0f0", "#000000", "#a8a29e", "#292524"],
    accent: "#f0f0f0",
  },
  // GreenTree
  {
    key: "greentree",
    name: "GreenTree",
    description: "Mintlify-inspired, emerald green",
    import: '@import "@farming-labs/theme/greentree/css";',
    colors: ["#0D9373", "#26BD6C", "#171A18", "#DFE1E0"],
    accent: "#0D9373",
  },
];

export default function ThemesPage() {
  return (
    <div className="min-h-dvh relative bg-black text-white" style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div className="pointer-events-none fixed inset-0 z-[999] hidden lg:block">
        <div className="mx-auto max-w-[90%] h-full relative">
          <div className="absolute left-0 top-0 h-full w-px bg-white/[8%]" />
          <div className="absolute right-0 top-0 h-full w-px bg-white/[8%]" />
        </div>
      </div>
      <header className="border-b border-white/[8%] px-6 py-5">
        <div className="mx-auto max-w-[90%] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg uppercase font-mono tracking-wide">Themes</h1>
            <p className="text-[13px] text-white/40 mt-0.5">
              Pick a preset and customize it live on the docs.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex group border border-white/[8%] items-center gap-2 text-[11px] font-mono px-4 py-2 rounded-none uppercase transition-all hover:no-underline"
          >
            <ArrowLeft className="size-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="overflow-x-hidden mx-auto max-w-[90%] mx-auto px-6 py-12">
        {/* Info */}
        <div className="mb-10 max-w-2xl">
          <p className="text-[13px] text-white/40 leading-relaxed">
            Each theme ships as a single CSS import and a factory function.
            Click <strong className="text-white/80">Try it live</strong> to
            open the docs with that theme applied and the customizer drawer
            open — tweak colors, layout, and features in real time, then copy
            the generated CSS and config.
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

              <h2 className="text-sm uppercase font-mono tracking-wide mb-1">
                {theme.name}
              </h2>
              <p className="text-[12px] text-white/40 mb-4 leading-relaxed">
                {theme.description}
              </p>

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
