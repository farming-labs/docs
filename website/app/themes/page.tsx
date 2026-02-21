import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
];

export default function ThemesPage() {
  return (
    <div className="min-h-dvh bg-black text-white" style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      {/* Header */}
      <header className="border-b border-white/[6%] px-6 py-5">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Themes</h1>
            <p className="text-[13px] text-white/40 mt-0.5">
              Pick a preset and customize it live on the docs.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-[13px] text-white/40 hover:text-white/70 transition-colors hover:no-underline"
            >
              Home
            </Link>
            <Link
              href="/docs"
              className="text-[13px] text-white/40 hover:text-white/70 transition-colors hover:no-underline"
            >
              Docs
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Info */}
        <div className="mb-10 max-w-2xl">
          <p className="text-[14px] text-white/50 leading-relaxed">
            Each theme ships as a single CSS import and a factory function.
            Click <strong className="text-white/80">Try it live</strong> to
            open the docs with that theme applied and the customizer drawer
            open — tweak colors, layout, and features in real time, then copy
            the generated CSS and config.
          </p>
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {themes.map((theme) => (
            <div
              key={theme.key}
              className="group relative rounded-xl border border-white/[6%] bg-white/[2%] p-6 transition-all hover:border-white/[12%] hover:bg-white/[3%]"
            >
              {/* Color swatches */}
              <div className="flex items-center gap-2 mb-4">
                {theme.colors.map((c, i) => (
                  <div
                    key={i}
                    className="size-4 rounded-[3px] border border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <h2 className="text-[15px] font-semibold tracking-tight mb-1">
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
                className="inline-flex items-center gap-2 text-[12px] font-medium px-4 py-2 rounded-lg border transition-all hover:no-underline"
                style={{
                  borderColor: `${theme.accent}40`,
                  color: theme.accent,
                  background: `${theme.accent}08`,
                }}
              >
                Try it live
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Custom Theme CTA */}
        <div className="mt-12 rounded-xl border border-white/[6%] bg-white/[2%] p-8 text-center">
          <h3 className="text-[15px] font-semibold tracking-tight mb-2">
            Build your own
          </h3>
          <p className="text-[13px] text-white/40 mb-5 max-w-md mx-auto">
            Start from any preset and customize every color, layout option, and
            feature toggle. The customizer generates the CSS and config for you.
          </p>
          <Link
            href="/docs?theme=default"
            className="inline-flex items-center gap-2 text-[13px] font-medium px-5 py-2.5 rounded-lg border border-white/10 bg-white/[4%] text-white/80 transition-all hover:bg-white/[7%] hover:text-white hover:border-white/20 hover:no-underline"
          >
            Open Customizer
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
