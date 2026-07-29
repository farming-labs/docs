import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bot,
  FileText,
  Github,
  Route,
  Search,
} from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import CodeBlock from "@/components/ui/code-block";
import { FeatureGridCard } from "@/components/ui/feature-grid-card";
import PixelCard from "@/components/ui/pixel-card";
import CopyCommand from "@/components/ui/copy-command";
import FrameworkTabs from "@/components/ui/framework-tabs";
import SvelteRouteTabs from "@/components/ui/svelte-route-tabs";
import AstroRouteTabs from "@/components/ui/astro-route-tabs";
import InitBlockTabs from "@/components/ui/init-block-tabs";
import { SidebarThemeToggle } from "@/components/sidebar-theme-toggle";

const heroVersions = [
  "v0.1.0",
  "v0.0.63",
  "v0.0.44",
  "v0.0.31",
  "v0.0.26",
  "v0.0.14",
  "v0.0.11",
  "v0.0.9",
  "v0.0.2-beta.5-10",
  "v0.0.1",
] as const;

const landingFeatureCards = [
  {
    title: "AI-native content",
    icon: FileText,
    backgroundIcon: FileText,
    description:
      "Write Markdown and MDX that stays clean for humans while remaining structured enough for AI tools and agents to read, cite, and update confidently.",
    label: "Human + agent ready",
    chips: ["Markdown", "MDX", "Frontmatter", "Page actions", "Readable source", "Agent-friendly"],
  },
  {
    title: "Ask AI + indexed search",
    icon: Search,
    backgroundIcon: Search,
    description:
      "Mix built-in Ask AI with search adapters for simple, Typesense, Algolia, MCP, or custom retrieval so you can keep the indexing flow that fits your stack.",
    label: "Retrieval layer",
    chips: ["Ask AI", "Simple search", "Typesense", "Algolia", "MCP search", "Custom adapters"],
  },
  {
    title: "Agent-optimized delivery",
    icon: Bot,
    backgroundIcon: Bot,
    description:
      "Ship docs to IDEs, agents, and humans from the same source with MCP, llms.txt, API reference, changelogs, and a docs runtime that stays open and portable.",
    label: "Agent optimized",
    chips: ["MCP", "llms.txt", "API reference", "Changelog", "Docs API", "Open runtime"],
  },
] as const;

const migrationIconPaths = {
  docusaurus:
    "M2.462 22.201h12.321a2.466 2.466 0 0 0 2.369-1.854c.026.004.052.008.079.008a.621.621 0 0 0 .615-.615.621.621 0 0 0-.615-.615c-.027 0-.053.004-.079.007l-.014-.055a.62.62 0 0 0 .378-.568.621.621 0 0 0-.615-.615.608.608 0 0 0-.371.127l-.042-.041a.606.606 0 0 0 .125-.368c0-.67-.919-.858-1.181-.241l-.055-.014c.003-.026.008-.052.008-.079a.622.622 0 0 0-.616-.615.621.621 0 0 0-.615.615h-.096a.617.617 0 0 0-1.033 0h-.717v-2.461h2.461c.115 0 .226-.017.331-.047a.307.307 0 1 0 .529-.304l.02-.021c.052.04.116.064.186.064h.002c.337 0 .428-.463.117-.591l.007-.028c.013.001.026.004.039.004a.31.31 0 0 0 .308-.308.31.31 0 0 0-.308-.308c-.013 0-.026.003-.039.004a.28.28 0 0 1-.007-.027c.327-.13-.028-.745-.305-.528l-.02-.021a.307.307 0 0 0 .062-.184c-.011-.326-.454-.416-.591-.12a1.238 1.238 0 0 0-.32-.047h-2.143a2.465 2.465 0 0 1 2.132-1.23h7.385V9.894l-8.618-.539a1.315 1.315 0 0 1-1.229-1.308c0-.688.542-1.265 1.229-1.307l8.618-.539v-1.23a2.473 2.473 0 0 0-2.462-2.462H8.615l-.307-.533a.356.356 0 0 0-.616 0l-.307.533-.308-.533a.355.355 0 0 0-.615 0l-.308.533-.308-.533a.355.355 0 0 0-.615 0l-.308.533-.008.001-.51-.51a.354.354 0 0 0-.594.159l-.168.628-.639-.171a.357.357 0 0 0-.436.435l.172.639-.628.169a.356.356 0 0 0-.16.594l.51.51v.008l-.533.307a.356.356 0 0 0 0 .616l.533.307-.533.308a.356.356 0 0 0 0 .616l.533.307-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.307a.356.356 0 0 0 0 .616l.533.308-.533.307a.356.356 0 0 0 0 .616l.533.307-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.307a.356.356 0 0 0 0 .616l.533.307-.533.308a.355.355 0 0 0 0 .615l.533.308-.533.308a.355.355 0 0 0 0 .615l.533.308a2.463 2.463 0 0 1-2.13-1.231A2.465 2.465 0 0 0 0 19.74c0 1.35 1.112 2.46 2.462 2.461zm19.692-5.204v2.743a2.473 2.473 0 0 1-2.461 2.461h-.001 1.231a2.466 2.466 0 0 0 2.383-1.854c.026.004.052.008.079.008A.621.621 0 0 0 24 19.74a.621.621 0 0 0-.615-.615c-.027 0-.053.004-.079.007l-.014-.055a.62.62 0 0 0 .378-.568.621.621 0 0 0-.615-.615.608.608 0 0 0-.371.127l-.042-.041a.612.612 0 0 0 .125-.368.623.623 0 0 0-.613-.615zm-4.067 2.62h2.223c.067 0 .123.056.123.123a.124.124 0 0 1-.123.123h-2.223a.845.845 0 0 0 0-.246zm-.33-1.231h2.553c.067 0 .123.056.123.123a.124.124 0 0 1-.123.123h-2.553a.845.845 0 0 0 0-.246zm-1.026-1.231h3.579c.067 0 .123.056.123.123a.124.124 0 0 1-.123.123h-3.474a.85.85 0 0 0-.105-.246zm3.579-.984h-6.159a.126.126 0 0 1-.123-.123c0-.068.056-.123.123-.123h6.159c.067 0 .123.056.123.123a.124.124 0 0 1-.123.123zm1.844-3.816v2.462c.115 0 .225-.017.331-.047a.308.308 0 1 0 .528-.304l.021-.021c.052.04.116.064.186.064a.312.312 0 0 0 .307-.308.306.306 0 0 0-.189-.283l.007-.028c.013.001.026.004.04.004a.312.312 0 0 0 .307-.308.312.312 0 0 0-.307-.308c-.014 0-.027.003-.04.004l-.007-.027a.31.31 0 0 0-.118-.592.306.306 0 0 0-.186.064l-.021-.021a.3.3 0 0 0 .063-.184c-.011-.326-.454-.416-.591-.12a1.24 1.24 0 0 0-.321-.047zm-6.059 2.339h4.215c.067 0 .123.056.123.123a.124.124 0 0 1-.123.123h-4.451a.564.564 0 0 0 .073-.19.553.553 0 0 0 .163-.056zm.454-1.208h3.761c.067 0 .123.056.123.123a.124.124 0 0 1-.123.123h-3.772a.552.552 0 0 0 .011-.246zm5.605-6.225h-.004c-.381.013-.561.393-.719.729-.166.35-.294.578-.504.572-.233-.009-.366-.271-.506-.549-.162-.32-.347-.682-.734-.668-.375.013-.556.344-.715.636-.169.311-.285.5-.507.491-.237-.008-.363-.222-.509-.469-.163-.275-.351-.585-.731-.574-.368.013-.549.294-.709.542-.169.262-.287.421-.513.412-.243-.009-.368-.186-.513-.391-.163-.231-.347-.491-.726-.479-.36.013-.541.243-.701.446-.151.192-.27.344-.52.335h-.005a.126.126 0 0 0-.123.123c0 .066.053.121.119.123.371.012.559-.222.723-.429.145-.184.27-.343.516-.352.237-.01.348.138.516.375.16.226.341.482.705.495.382.013.566-.273.729-.525.145-.226.271-.421.511-.429.22-.008.34.166.51.453.159.271.34.577.712.59.385.014.57-.322.732-.619.14-.257.273-.5.507-.508.221-.005.336.196.506.533.159.314.339.67.717.684h.021c.377 0 .556-.378.714-.713.14-.297.273-.576.501-.588zM7.385 6.509a.312.312 0 0 1-.308-.308c-.01-.532-.378-.911-.927-.922-.528-.011-.888.432-.919.922-.011.168-.139.307-.308.308a.31.31 0 0 1-.308-.308c0-.848.69-1.538 1.539-1.538.848 0 1.538.69 1.538 1.538a.312.312 0 0 1-.307.308zm9.846-2.308a.31.31 0 0 1 .308.308.31.31 0 0 1-.308.308.31.31 0 0 1-.308-.308.31.31 0 0 1 .308-.308zm2.461-.153a.31.31 0 0 1 .307.308.31.31 0 0 1-.308.308h-.001a.31.31 0 0 1-.307-.308.31.31 0 0 1 .308-.308z",
  mintlify:
    "M15.158.002a8.807 8.807 0 0 0-6.249 2.59l-.062.063h-.003L2.655 8.844a.605.605 0 0 0-.062.058 8.838 8.838 0 0 0-.83 11.55l6.251-6.249.065-.063a8.778 8.778 0 0 1-1.758-5.385 8.784 8.784 0 0 1 .283-2.151 8.993 8.993 0 0 1 2.151-.286 8.802 8.802 0 0 1 5.386 1.76 8.81 8.81 0 0 1 3.032 4.11 8.879 8.879 0 0 1 .225 5.21 8.784 8.784 0 0 0-.341.082 8.846 8.846 0 0 1-4.868-.303 8.679 8.679 0 0 1-2.323-1.25l-.064.065L3.55 22.24a8.85 8.85 0 0 0 11.548-.83l.06-.062 6.19-6.187a8.801 8.801 0 0 1-.367.337c.125-.11.247-.224.366-.341l.063-.058A8.817 8.817 0 0 0 24 8.844V.002ZM8.38 3.17a8.73 8.73 0 0 1 0 0Zm-.325.413Zm-.328.475Zm-.31.518Zm-.235.455Zm-.283.66zm-.156.447Zm14.147 9.44zm-.43.343zm-1.005.65zm-.533.274zm-.475.207z",
  nextra:
    "M22.68 21.031c-4.98-4.98-4.98-13.083 0-18.063l.978-.978c.22-.22.342-.513.342-.825 0-.311-.122-.604-.342-.824-.44-.441-1.207-.44-1.648 0l-.979.978c-4.98 4.98-13.084 4.98-18.063 0L1.99.34a1.17 1.17 0 0 0-1.649 0 1.168 1.168 0 0 0 0 1.649l.978.978c4.98 4.98 4.98 13.083 0 18.063l-.977.978c-.221.22-.342.513-.342.825 0 .31.121.604.341.824.442.443 1.21.441 1.65 0l.977-.977c4.98-4.983 13.083-4.98 18.064 0l.978.977c.22.22.513.342.824.342.312 0 .605-.122.824-.342.22-.22.342-.512.342-.824 0-.313-.122-.605-.342-.825l-.977-.978z",
  vitepress:
    "M17.029.0014a1.8382 1.8382 0 0 0-.1875.0176L4.0845 1.8334C3.0779 1.9767 2.3767 2.9196 2.518 3.939l2.5604 18.457c.1415 1.0193 1.0735 1.7292 2.08 1.586l12.757-1.8165c1.0066-.1433 1.7078-1.0861 1.5664-2.1054L18.9215 1.6049C18.7889.6493 17.961-.035 17.029.0014Zm.127.9316c.4271.027.7915.3549.8534.8008l2.5604 18.457c.0707.5097-.28.9812-.7831 1.0528L7.0296 23.058c-.5033.0717-.9683-.2833-1.039-.793L3.4302 3.81c-.0707-.5097.2799-.9811.7832-1.0528L16.9704.9408A.9066.9066 0 0 1 17.156.933zm-3.6443 5.3541L9.9668 7.5215a.1364.1364 0 0 0-.0898.1406l.3183 3.8692c.0075.0911.0994.1497.1836.1171l.9824-.3789c.092-.0355.1894.0373.1836.1368l-.0898 1.539c-.006.1036.1005.1763.1933.1328l.5997-.2812c.093-.0435.1976.031.1914.1347l-.1465 2.418c-.0092.1513.195.2037.2578.0664l.041-.0918 2.123-6.4238c.0355-.1076-.0658-.2104-.1718-.1738l-1.0176.3515c-.0955.033-.1917-.0491-.1777-.1504l.3437-2.4902a.1368.1368 0 0 0-.1426-.1562c-.016-.001-.0422.0084-.037.0058zm2.8223.7988a.2717.2717 0 0 0-.0801.0137L14 7.8496l-.0762.5606.4551-.1563c.5074-.1627.973.2955.8106.8027l-2.131 6.4493-.0526.1171c-.1268.2776-.4416.4304-.7383.3516-.2904-.077-.4911-.353-.4727-.6562l.1094-1.8086c-.5057.2578-.9731-.1473-.9473-.5938l.0567-.9765-.4532.1757c-.4144.1536-.8298-.1366-.8632-.543L9.453 8.5997l-3.0625-.123c-.2294-.0093-.3635.2552-.2226.4394l6.291 8.2305c.1293.169.391.1302.4668-.0684l3.668-9.6191c.072-.1889-.0765-.377-.2598-.373z",
  gitbook:
    "M12.513 1.097c-.645 0-1.233.34-2.407 1.017L3.675 5.82A7.233 7.233 0 0 0 0 12.063v.236a7.233 7.233 0 0 0 3.667 6.238L7.69 20.86c2.354 1.36 3.531 2.042 4.824 2.042 1.292.001 2.47-.678 4.825-2.038l4.251-2.453c1.177-.68 1.764-1.02 2.087-1.579.323-.56.324-1.24.323-2.6v-2.63a1.04 1.04 0 0 0-1.558-.903l-8.728 5.024c-.587.337-.88.507-1.201.507-.323 0-.616-.168-1.204-.506l-5.904-3.393c-.297-.171-.446-.256-.565-.271a.603.603 0 0 0-.634.368c-.045.111-.045.282-.043.625.002.252 0 .378.025.494.053.259.189.493.387.667.089.077.198.14.416.266l6.315 3.65c.589.34.884.51 1.207.51.324 0 .617-.17 1.206-.509l7.74-4.469c.202-.116.302-.172.377-.13.075.044.075.16.075.392v1.193c0 .34.001.51-.08.649-.08.14-.227.224-.522.394l-6.382 3.685c-1.178.68-1.767 1.02-2.413 1.02-.646 0-1.236-.34-2.412-1.022l-5.97-3.452-.043-.025a4.106 4.106 0 0 1-2.031-3.52V11.7c0-.801.427-1.541 1.12-1.944a1.979 1.979 0 0 1 1.982-.001l4.946 2.858c1.174.679 1.762 1.019 2.407 1.02.645 0 1.233-.34 2.41-1.017l7.482-4.306a1.091 1.091 0 0 0 0-1.891L14.92 2.11c-1.175-.675-1.762-1.013-2.406-1.013Z",
  mkdocs:
    "m17.029 18.772.777 1.166-5.417 2.709L0 16.451V4.063l5.417-2.709 5.298 7.948 7.867-5.24L24 1.354V16.84l-5.417 2.709zm2.023-13.827v13.253l3.949-1.975V2.97zM5.076 2.642 1.458 4.45 12.73 21.358l3.618-1.809z",
} as const;

const migrationSources = [
  { name: "Docusaurus", slug: "docusaurus", iconPath: migrationIconPaths.docusaurus },
  { name: "Mintlify", slug: "mintlify", iconPath: migrationIconPaths.mintlify },
  { name: "Nextra", slug: "nextra", iconPath: migrationIconPaths.nextra },
  { name: "Fumadocs", slug: "fumadocs", customIcon: "fumadocs" },
  { name: "VitePress", slug: "vitepress", iconPath: migrationIconPaths.vitepress },
  { name: "Starlight", slug: "starlight", customIcon: "starlight" },
  { name: "GitBook", slug: "gitbook", iconPath: migrationIconPaths.gitbook },
  { name: "Material for MkDocs", slug: "mkdocs", iconPath: migrationIconPaths.mkdocs },
] as const;

function MigrationSourceIcon({ source }: { source: (typeof migrationSources)[number] }) {
  if ("customIcon" in source && source.customIcon === "fumadocs") {
    return (
      <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 180 180">
        <circle
          cx="90"
          cy="90"
          r="82"
          fill="url(#fumadocs-migration-gradient)"
          stroke="currentColor"
          strokeWidth="12"
        />
        <defs>
          <linearGradient id="fumadocs-migration-gradient" gradientTransform="rotate(45)">
            <stop offset="45%" stopColor="currentColor" stopOpacity="0.08" />
            <stop offset="100%" stopColor="currentColor" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if ("customIcon" in source && source.customIcon === "starlight") {
    return (
      <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24.13 26">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M15.22 7.77 12.06.94 8.91 7.77l-.15.29L7 6.3a1.18 1.18 0 1 0-1.68 1.68l1.75 1.74-.2.1-.04.02L0 13l6.83 3.16.24.11-1.75 1.76A1.18 1.18 0 1 0 7 19.7l1.76-1.76.15.3 3.15 6.82 3.16-6.83.12-.24 1.71 1.71a1.18 1.18 0 1 0 1.68-1.67L17 16.3l.29-.15L24.13 13 17.3 9.84 17 9.7l1.73-1.73a1.18 1.18 0 1 0-1.68-1.67L15.35 8a4.15 4.15 0 0 1-.12-.21l-.01-.03Zm-3.17.36-.42.9a7.27 7.27 0 0 1-3.55 3.55l-.9.42.9.42a7.27 7.27 0 0 1 3.55 3.55l.42.9.42-.9a7.27 7.27 0 0 1 3.55-3.55l.9-.42-.9-.42a7.27 7.27 0 0 1-3.55-3.55l-.42-.9Z"
          clipRule="evenodd"
        />
        <path
          fill="currentColor"
          d="M22.27 4.43a1.18 1.18 0 1 0-1.67-1.68l-.57.57a1.18 1.18 0 0 0 1.68 1.67l.56-.56ZM4.2 5.18c-.46.46-1.2.46-1.67 0l-.56-.56a1.18 1.18 0 0 1 1.67-1.68l.57.57c.46.46.46 1.2 0 1.67Zm0 15.64a1.18 1.18 0 0 0-1.67 0l-.56.56a1.18 1.18 0 0 0 1.67 1.68l.57-.57c.46-.46.46-1.2 0-1.67Zm18.07.75a1.18 1.18 0 0 1-1.67 1.68l-.57-.57a1.19 1.19 0 0 1 1.68-1.67l.56.56Z"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24">
      <path d={"iconPath" in source ? source.iconPath : undefined} fill="currentColor" />
    </svg>
  );
}

function HeroSection() {
  return (
    <section className="relative md:mx-0 -mx-[5%] min-h-screen flex items-end overflow-y-hidden">
      <div className="absolute bottom-[70px] sm:bottom-16 left-0 right-0 z-[999] h-px bg-black/[8%] dark:bg-white/[8%]" />
      <div className="absolute top-8 left-2 sm:left-0 z-[1001]">
        <Link
          href="/changelog#v0.1.0"
          className="bg-transparent text-black/20 ml-2 sm:ml-0 dark:text-white/20 font-mono text-xs border border-l-0 border-b-0 border-black/10 dark:border-white/10 uppercase px-3 py-1 rounded-none shadow-none tracking-wider inline-flex hover:text-black/45 dark:hover:text-white/45 transition-colors hover:no-underline"
        >
          v0.1.0
        </Link>
      </div>
      <AnimatedBackground />
      <div className="relative z-[999] w-full pb-12 sm:pb-16 pt-24 px-5 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 sm:gap-16">
          <div className="max-w-full sm:max-w-xl">
            <div className="flex flex-col gap-2">
              {heroVersions.map((version) => (
                <div key={version} className="inline-block">
                  <a
                    href={`/changelog#${version}`}
                    className="text-[10px] font-mono tracking-tighter no-underline hover:underline duration-500 transition-all decoration-dotted text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:underline-offset-2 hover:decoration-black/30 dark:hover:decoration-white/30 px-0 py-1.5 flex items-center"
                  >
                    <div className="h-[12px] w-px bg-black/50 dark:bg-white/50 mr-2" />
                    {version}
                  </a>
                </div>
              ))}
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tighter text-black dark:text-white leading-[0.95]">
              a documentation
              <br />
              <div className="mt-2" />
              that just{" "}
              <span className="bg-black text-white dark:bg-white dark:text-black p-0 mt-2">
                work with AI.
              </span>
            </h1>
            <p className="mt-4 text-xs sm:text-base font-mono uppercase text-black/45 dark:text-white/45 max-w-md leading-relaxed">
              AI-native,{" "}
              <span className="bg-black text-white dark:bg-white dark:text-black p-0 mt-2">
                agent-optimized docs
              </span>{" "}
              with Ask AI, MCP, llms.txt, search adapters, and zero boilerplate.
            </p>

            <div className="-mb-5 sm:mb-0 mt-6 sm:mt-8 flex w-fit max-w-full flex-col md:flex-wrap md:flex-row-reverse items-start md:items-center gap-0">
              <Link
                href="/cloud"
                className="group inline-flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-5 py-[11px] mb-[0.5px] text-xs font-mono uppercase tracking-wider hover:bg-black/90 dark:hover:bg-white/90 transition-all hover:no-underline"
              >
                Get Started
                <ArrowRight className="w-3.5 h-3.5 -rotate-45 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <CopyCommand
                className="border-b-0 sm:border-b border-l-0 border-black/10 dark:border-white/10"
                command="pnpx @farming-labs/docs init"
              />
            </div>
          </div>

          <div className="sm:max-w-xs">
            <div className="flex justify-end">
              <Link
                href="https://github.com/farming-labs/docs"
                className="group uppercase font-mono tracking-tighter text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 hover:no-underline relative ease-in after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:translate-y-[3px] after:bg-black/30 dark:after:bg-white/30 after:opacity-0 after:duration-300 after:content-[''] hover:after:-translate-y-0.5 hover:after:opacity-100 text-[11px] transition-all duration-300"
              >
                <Github className="w-3 h-3 mr-1 inline-flex mb-1" />
                GET THE GITHUB
                <ArrowUpRight className="inline w-3 h-3 group-hover:-translate-y-0.5 transition-all duration-700 ml-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentFeaturesSection() {
  return (
    <section className="relative z-10 border-t border-black/[8%] bg-white dark:border-white/[8%] dark:bg-black">
      <div className="w-full px-4 py-16 sm:px-0 sm:py-20">
        <div className="max-w-3xl">
          <span className="mb-4 block font-mono text-[10px] uppercase tracking-[0.2em] text-black/30 dark:text-white/30">
            AI-native runtime
          </span>
          <h2 className="text-2xl font-semibold tracking-tighter text-black dark:text-white sm:text-4xl">
            Built for humans first, but ready for AI and agents out of the box.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/45 dark:text-white/40 sm:text-base">
            Keep your docs source simple, then layer in Ask AI, MCP delivery, llms.txt, and
            index-backed search without leaving the same runtime.
          </p>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {landingFeatureCards.map((card) => (
            <FeatureGridCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AgentScoreCalloutSection() {
  return (
    <section className="relative z-10 border-t border-black/[8%] bg-white dark:border-white/[8%] dark:bg-black">
      <div className="w-full py-10 sm:py-12">
        <div className="grid gap-7 border-y border-black/10 px-4 py-8 dark:border-white/10 sm:px-0 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8 lg:pb-0 lg:pt-8">
          <div className="max-w-2xl lg:pb-8">
            <span className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-black/30 dark:text-white/30">
              <Activity className="h-3.5 w-3.5" strokeWidth={1.8} />
              Agent score
            </span>
            <h2 className="text-2xl font-semibold tracking-tighter text-black dark:text-white sm:text-4xl">
              How agent-ready are your docs?
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-black/45 dark:text-white/40 sm:text-base">
              Run a public readiness check for llms.txt, markdown routes, OpenAPI discovery, MCP,
              sitemap, robots, structure, access, and cache hygiene, then compare your docs on the
              leaderboard.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Link
              href="/score"
              className="group inline-flex w-full items-center justify-center gap-2 bg-black px-5 py-3 font-mono text-xs uppercase tracking-wider text-white transition-all hover:bg-black/90 hover:no-underline sm:w-auto dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              Score your docs
              <ArrowRight className="h-3.5 w-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
            </Link>
            <Link
              href="/score#leaderboard"
              className="group inline-flex w-full items-center justify-center gap-2 border border-black/10 bg-black/[3%] px-5 py-3 font-mono text-xs uppercase tracking-wider text-black/70 transition-all hover:border-black/20 hover:bg-black/[5%] hover:text-black hover:no-underline sm:w-auto dark:border-white/10 dark:bg-white/[3%] dark:text-white/70 dark:hover:border-white/20 dark:hover:bg-white/[5%] dark:hover:text-white"
            >
              Leaderboard
              <ArrowRight className="h-3.5 w-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function NextJsSteps() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            1
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Install</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Add the core packages to your Next.js project.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Terminal"
          filename="shell"
          language="bash"
          code="pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/next"
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            2
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Configure</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One file. Theme, metadata, components, icons — everything.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Config"
          filename="docs.config.ts"
          code={`import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            3
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Next Config</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Wrap your config with{" "}
              <code className="text-black/60 dark:text-white/60 text-xs">withDocs()</code>. Handles
              MDX, routing, and search.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Next Config"
          filename="next.config.ts"
          code={`import { withDocs } from "@farming-labs/next/config";

export default withDocs({});`}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            4
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Root Layout</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Wrap your app with{" "}
              <code className="text-black/60 dark:text-white/60 text-xs">RootProvider</code> for
              search, theme switching, and AI.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Root Layout"
          filename="app/layout.tsx"
          code={`import { RootProvider } from "@farming-labs/theme";
import "./global.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}`}
        />

        <p className="text-xs text-black/50 dark:text-white/50 -mt-1 mb-2">
          In <code className="text-black/70 dark:text-white/70">app/global.css</code>, import your
          theme&apos;s CSS so docs styling applies (e.g.{" "}
          <code className="text-black/70 dark:text-white/70">{`@import "@farming-labs/theme/default/css";`}</code>{" "}
          — use the path that matches your theme).
        </p>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            5
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Write docs</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create MDX files under{" "}
              <code className="text-black/60 dark:text-white/60 text-xs">app/docs/</code>.
              Frontmatter for metadata. That&#39;s it.
            </p>
          </div>
        </div>
        <CodeBlock
          title="MDX Page"
          filename="app/docs/getting-started/page.mdx"
          code={`---
title: "Getting Started"
description: "Set up in 5 minutes"
icon: "rocket"
---

# Getting Started

Write your content in **MDX** with
frontmatter for metadata.

\`\`\`ts title="auth.ts"
export const auth = betterAuth({
  database: { provider: "postgresql" },
});
\`\`\``}
        />

        <p className="text-xs text-black/30 dark:text-white/30 mt-2">
          See the full{" "}
          <a
            href="/docs/installation"
            className="text-black/50 dark:text-white/50 underline underline-offset-2 hover:text-black/70 dark:hover:text-white/70"
          >
            installation walkthrough
          </a>{" "}
          for all generated files and options.
        </p>
      </div>
    </div>
  );
}

function SvelteKitSteps() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            1
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Install</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Add the core packages to your SvelteKit project.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Terminal"
          filename="shell"
          language="bash"
          code="pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/svelte @farming-labs/svelte-theme"
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            2
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Configure</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One config file. Theme, metadata, navigation — everything.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Config"
          filename="docs.config.ts"
          code={`import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/svelte-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            3
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Server</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create the server helper. Handles loading, search, and AI.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Server"
          filename="src/lib/docs.server.ts"
          code={`import { createDocsServer } from "@farming-labs/svelte/server";
import config from "./docs.config";

export const { load, GET, HEAD, POST } = createDocsServer(config);`}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            4
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Write docs</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create Markdown files under{" "}
              <code className="text-black/60 dark:text-white/60 text-xs">docs/</code>. That&#39;s
              it.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Markdown Page"
          filename="docs/getting-started/page.md"
          code={`---
title: "Getting Started"
description: "Set up in 5 minutes"
icon: "rocket"
---

# Getting Started

Write your content in **Markdown** with
frontmatter for metadata.

\`\`\`ts title="auth.ts"
export const auth = betterAuth({
  database: { provider: "postgresql" },
});
\`\`\``}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            5
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Routes</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Three small files for layout, server loader, and page.
            </p>
          </div>
        </div>
        <SvelteRouteTabs />
      </div>
    </div>
  );
}

function AstroSteps() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            1
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Install</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Add the core packages to your Astro project.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Terminal"
          filename="shell"
          language="bash"
          code="pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/astro @farming-labs/astro-theme"
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            2
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Configure</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One config file. Theme, metadata, navigation — everything.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Config"
          filename="docs.config.ts"
          code={`import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/astro-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            3
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Server</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create the server helper. Handles loading, search, and AI.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Server"
          filename="src/lib/docs.server.ts"
          code={`import { createDocsServer } from "@farming-labs/astro/server";
import config from "./docs.config";

export const { load, GET, HEAD, POST } = createDocsServer(config);`}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            4
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Write docs</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create Markdown files under{" "}
              <code className="text-black/60 dark:text-white/60 text-xs">docs/</code>. That&#39;s
              it.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Markdown Page"
          filename="docs/getting-started/page.md"
          code={`---
title: "Getting Started"
description: "Set up in 5 minutes"
icon: "rocket"
---

# Getting Started

Write your content in **Markdown** with
frontmatter for metadata.

\`\`\`ts title="auth.ts"
export const auth = betterAuth({
  database: { provider: "postgresql" },
});
\`\`\``}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            5
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Routes</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Index page, catch-all route, and API endpoint.
            </p>
          </div>
        </div>
        <AstroRouteTabs />
      </div>
    </div>
  );
}

function NuxtSteps() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            1
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Install</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Add the core packages to your Nuxt project.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Terminal"
          filename="shell"
          language="bash"
          code="pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/nuxt @farming-labs/nuxt-theme"
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            2
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Configure</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One config file. Theme, metadata, navigation — everything.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Config"
          filename="docs.config.ts"
          code={`import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/nuxt-theme/fumadocs";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            3
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Nuxt Config</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Import the theme CSS and configure Nitro server assets.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Nuxt Config"
          filename="nuxt.config.ts"
          code={`export default defineNuxtConfig({
  css: ["@farming-labs/theme/default/css"],
  nitro: {
    serverAssets: [
      { baseName: "docs", dir: "../docs" },
    ],
  },
});`}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            4
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Server API</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One handler for docs loading, search, and AI.
            </p>
          </div>
        </div>
        <CodeBlock
          title="API Handler"
          filename="server/api/docs.ts"
          code={`import { defineDocsHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsHandler(config, useStorage);`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            5
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Write docs</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create Markdown files under{" "}
              <code className="text-black/60 dark:text-white/60 text-xs">docs/</code>. That&apos;s
              it.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Markdown Page"
          filename="docs/getting-started/page.md"
          code={`---
title: "Getting Started"
description: "Set up in 5 minutes"
icon: "rocket"
---

# Getting Started

Write your content in **Markdown** with
frontmatter for metadata.

\`\`\`ts title="auth.ts"
export const auth = betterAuth({
  database: { provider: "postgresql" },
});
\`\`\``}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            6
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Page Route</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              A single Vue page that handles all doc routes.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Doc Page"
          filename="pages/docs/[...slug].vue"
          code={`<script setup lang="ts">
import { DocsLayout, DocsContent } from "@farming-labs/nuxt-theme";
import config from "~/docs.config";

const route = useRoute();
const pathname = computed(() => route.path);

const { data } = await useFetch("/api/docs", {
  query: { pathname },
  watch: [pathname],
});
</script>

<template>
  <DocsLayout :tree="data.tree" :config="config">
    <DocsContent :data="data" :config="config" />
  </DocsLayout>
</template>`}
        />
      </div>
    </div>
  );
}

function InstallSection() {
  return (
    <section className="relative z-10 bg-white dark:bg-black border-t border-black/[8%] dark:border-white/[8%]">
      <div className="w-full px-4 py-16 sm:px-0 sm:py-24">
        <div className="mb-4 sm:mb-5">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/30 dark:text-white/30 mb-4 block">
            Quick Start
          </span>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter text-black dark:text-white">
            Up and running in minutes
          </h2>
        </div>
        <div className="mb-8">
          <InitBlockTabs />
        </div>

        <div className="mb-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/25 dark:text-white/25">
            Or set up manually
          </span>
        </div>

        <FrameworkTabs
          tabs={[
            {
              label: "Next.js",
              value: "nextjs",
              content: <NextJsSteps />,
            },
            {
              label: "SvelteKit",
              value: "sveltekit",
              content: <SvelteKitSteps />,
            },
            {
              label: "Astro",
              value: "astro",
              content: <AstroSteps />,
            },
            {
              label: "Nuxt",
              value: "nuxt",
              content: <NuxtSteps />,
            },
          ]}
        />
      </div>
    </section>
  );
}

function MigrationCalloutSection() {
  return (
    <section
      id="migrations"
      className="relative z-10 border-t border-black/[8%] bg-white dark:border-white/[8%] dark:bg-black"
    >
      <div className="w-full py-10 sm:py-14">
        <div className="relative overflow-hidden border-y border-black/10 bg-black/[0.012] dark:border-white/10 dark:bg-white/[0.012]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 8px, color-mix(in srgb, currentColor 2.5%, transparent) 8px, color-mix(in srgb, currentColor 2.5%, transparent) 9px)",
            }}
          />

          <div className="relative grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="px-4 py-9 sm:px-0 sm:py-12 lg:pr-12">
              <span className="mb-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-black/35 dark:text-white/35">
                <Route aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                Migrations
              </span>

              <h2 className="max-w-2xl text-2xl font-semibold tracking-tighter text-black dark:text-white sm:text-4xl">
                Already have docs? Bring them with you.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/48 dark:text-white/42 sm:text-base">
                Move your content, navigation, assets, and existing URLs without starting over. Pick
                your current platform and follow a source-specific migration path.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/docs/migrations"
                  className="group inline-flex min-h-11 w-full items-center justify-center gap-2 bg-black px-5 py-3 font-mono text-xs uppercase tracking-wider text-white transition-colors duration-150 hover:bg-black/88 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/45 focus-visible:ring-offset-2 sm:w-auto dark:bg-white dark:text-black dark:hover:bg-white/88 dark:focus-visible:ring-white/60 dark:focus-visible:ring-offset-black"
                >
                  Explore migration guides
                  <ArrowRight
                    aria-hidden="true"
                    className="h-3.5 w-3.5 -rotate-45 transition-transform duration-150 group-hover:rotate-0"
                  />
                </Link>
                <Link
                  href="/docs/migrations.md"
                  className="group inline-flex min-h-11 w-full items-center justify-center gap-2 border border-black/12 bg-white/70 px-5 py-3 font-mono text-xs uppercase tracking-wider text-black/72 transition-colors duration-150 hover:border-black/20 hover:bg-black/[0.04] hover:text-black hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 focus-visible:ring-offset-2 sm:w-auto dark:border-white/12 dark:bg-black/50 dark:text-white/70 dark:hover:border-white/20 dark:hover:bg-white/[0.05] dark:hover:text-white dark:focus-visible:ring-white/50 dark:focus-visible:ring-offset-black"
                >
                  <FileText aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Share migrations.md
                </Link>
              </div>
            </div>

            <div className="relative border-t border-black/10 px-4 py-7 dark:border-white/10 sm:px-0 lg:border-l lg:border-t-0 lg:px-8 lg:py-10">
              <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-black/35 dark:border-white/10 dark:text-white/35">
                <span>Supported sources</span>
                <span aria-label="Eight migration sources">08 / ready</span>
              </div>

              <ul
                aria-label="Supported migration sources"
                className="mt-4 grid grid-cols-2 gap-px border border-black/[0.06] bg-black/[0.06] dark:border-white/[0.06] dark:bg-white/[0.06]"
              >
                {migrationSources.map((source) => (
                  <li key={source.slug} className="bg-white dark:bg-black">
                    <Link
                      href={`/docs/migrations/${source.slug}`}
                      aria-label={`Migrate from ${source.name}`}
                      className="group flex min-h-12 items-center gap-2.5 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-black/58 transition-colors duration-150 hover:bg-black/[0.04] hover:text-black hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/40 dark:text-white/52 dark:hover:bg-white/[0.06] dark:hover:text-white dark:focus-visible:ring-white/50"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-black/55 transition-colors duration-150 group-hover:text-black dark:text-white/55 dark:group-hover:text-white">
                        <MigrationSourceIcon source={source} />
                      </span>
                      <span>{source.name}</span>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="ml-auto h-3 w-3 shrink-0 -translate-x-0.5 opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-60 group-focus-visible:translate-x-0 group-focus-visible:opacity-60"
                        strokeWidth={1.8}
                      />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-black/30 dark:text-white/30">
                <span>Current docs</span>
                <ArrowRight aria-hidden="true" className="h-3 w-3" />
                <span className="text-black/60 dark:text-white/58">Farming Labs Docs</span>
              </div>
            </div>
          </div>

          <span
            aria-hidden="true"
            className="absolute left-0 top-0 block h-2 w-2 border-l-2 border-t-2 border-black dark:border-white"
          />
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 block h-2 w-2 border-b-2 border-r-2 border-black dark:border-white"
          />
        </div>
      </div>
    </section>
  );
}

function ThemesSection() {
  const themes = [
    {
      name: "Default",
      description: "Clean, neutral palette with standard border radius",
      import: '@import "@farming-labs/theme/default/css";',
      colors: ["#6366f1", "#ffffff", "#64748b", "#e5e7eb"],
    },
    {
      name: "Darksharp",
      description: "All-black, sharp corners, no rounded edges",
      import: '@import "@farming-labs/theme/darksharp/css";',
      colors: ["#fafaf9", "#000000", "#a8a29e", "#262626"],
    },
    {
      name: "Pixel Border",
      description: "Inspired by better-auth.com — refined dark UI",
      import: '@import "@farming-labs/theme/pixel-border/css";',
      colors: ["#fafaf9", "#050505", "#8c8c8c", "#262626"],
    },
    {
      name: "Colorful",
      description: "Faithful clone of the fumadocs default neutral theme",
      import: '@import "@farming-labs/theme/colorful/css";',
      colors: ["#FFFF00", "#f5f5f4", "#64748b", "#e5e7eb"],
    },
    {
      name: "Shiny",
      description: "Clerk docs-inspired — clean, polished purple accents",
      import: '@import "@farming-labs/theme/shiny/css";',
      colors: ["#6c47ff", "#f7f7f8", "#73738c", "#e5e5ea"],
    },
    {
      name: "Ledger",
      description: "Stripe Docs-inspired product docs shell with navy code panels",
      import: '@import "@farming-labs/theme/ledger/css";',
      colors: ["#5f6cf6", "#f6f8fb", "#30364a", "#262c43"],
    },
    {
      name: "DarkBold",
      description: "Pure monochrome design — clean, bold, minimal",
      import: '@import "@farming-labs/theme/darkbold/css";',
      colors: ["#000", "#fff", "#888", "#eaeaea"],
    },
    {
      name: "GreenTree",
      description: "Mintlify-inspired — emerald green, Inter font, modern",
      import: '@import "@farming-labs/theme/greentree/css";',
      colors: ["#0D9373", "#26BD6C", "#171A18", "#DFE1E0"],
    },
    {
      name: "Hardline",
      description: "Original hard-edge preset with square corners and strong borders",
      import: '@import "@farming-labs/theme/hardline/css";',
      colors: ["#ffd335", "#f2efe8", "#47423a", "#111111"],
    },
    {
      name: "Concrete",
      description: "Louder brutalist variant with offset shadows and poster-style contrast",
      import: '@import "@farming-labs/theme/concrete/css";',
      colors: ["#ff5b31", "#f6ead9", "#5b4e42", "#141210"],
    },
    {
      name: "Command Grid",
      description: "Mono-first paper-grid preset inspired by the better-cmdk landing page",
      import: '@import "@farming-labs/theme/command-grid/css";',
      colors: ["#141414", "#f8f6ed", "#d1c0a9", "#3d3d3d"],
    },
  ];

  return (
    <section className="relative z-10 bg-white dark:bg-black border-t border-black/[8%] dark:border-white/[8%]">
      <div className="w-full px-4 py-16 sm:px-0 sm:py-24">
        <div className="mb-10 sm:mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/30 dark:text-white/30 mb-4 block">
            Themes
          </span>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter text-black dark:text-white">
            More themes. Your choice.
          </h2>
          <p className="mt-3 text-black/40 dark:text-white/40 max-w-lg">
            Pick a preset or build your own with{" "}
            <code className="text-black/60 dark:text-white/60 text-xs font-mono">
              createTheme()
            </code>
            . Override any styles from config.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {themes.map((theme) => (
            <PixelCard
              key={theme.name}
              variant="default"
              className="transition-all overflow-x-hidden"
            >
              <div className="flex items-center gap-2 mb-4">
                {theme.colors.map((c, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <hr className="border-black/[6%] dark:border-white/[6%] opacity-60 -mx-10" />
              <h3 className="text-xs uppercase font-mono pt-2 text-black dark:text-white mb-0">
                {theme.name}
              </h3>
              <hr className="my-2 border-black/[6%] dark:border-white/[6%] opacity-60 -mx-10" />
              <p className="text-xs text-black/40 dark:text-white/40 mb-4">{theme.description}</p>
              <code className="text-[11px] font-mono text-black/25 dark:text-white/25 break-all">
                {theme.import}
              </code>
            </PixelCard>
          ))}
        </div>

        <div className="mt-8">
          <CodeBlock
            title="Custom Colors"
            filename="docs.config.ts"
            code={`theme: pixelBorder({
  ui: {
    colors: {
      primary: "oklch(0.72 0.19 149)",     // green
      accent: "hsl(220 80% 60%)",          // blue
    },
  },
}),`}
          />
        </div>

        <div className="mt-10 flex items-center gap-4 flex-wrap">
          <a className="group" href="/themes">
            <span className="inline-flex group items-center gap-2 rounded-none uppercase font-mono text-xs border border-black/10 dark:border-white/10 bg-black/[3%] dark:bg-white/[3%] px-5 py-2.5 cursor-pointer text-black/80 dark:text-white/80 transition-all hover:bg-black/[4%] dark:hover:bg-white/[4%] hover:text-black dark:hover:text-white hover:border-black/10 dark:hover:border-white/10 hover:no-underline">
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
              expore themes
              <ArrowRight className="w-3.5 h-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
            </span>
          </a>
          <a className="group" href="/showcase">
            <span className="inline-flex group items-center gap-2 rounded-none uppercase font-mono text-xs border border-black/10 dark:border-white/10 bg-black/[3%] dark:bg-white/[3%] px-5 py-2.5 cursor-pointer text-black/80 dark:text-white/80 transition-all hover:bg-black/[4%] dark:hover:bg-white/[4%] hover:text-black dark:hover:text-white hover:border-black/10 dark:hover:border-white/10 hover:no-underline">
              Showcase
              <ArrowRight className="w-3.5 h-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
            </span>
          </a>
          <a className="group" href="/score">
            <span className="inline-flex group items-center gap-2 rounded-none uppercase font-mono text-xs border border-black/10 dark:border-white/10 bg-black/[3%] dark:bg-white/[3%] px-5 py-2.5 cursor-pointer text-black/80 dark:text-white/80 transition-all hover:bg-black/[4%] dark:hover:bg-white/[4%] hover:text-black dark:hover:text-white hover:border-black/10 dark:hover:border-white/10 hover:no-underline">
              <Activity className="w-3.5 h-3.5" strokeWidth={1.8} />
              Agent Score
              <ArrowRight className="w-3.5 h-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

function ConfigSection() {
  return (
    <section className="relative z-10 bg-white dark:bg-black border-t border-black/[8%] dark:border-white/[8%]">
      <div className="w-full px-4 py-16 sm:px-0 sm:py-24">
        <div className="mb-10 sm:mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/30 dark:text-white/30 mb-4 block">
            Configuration
          </span>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter text-black dark:text-white">
            One file. Full control.
          </h2>
        </div>

        <CodeBlock
          maxHeight="700px"
          title="Full Example"
          filename="docs.config.ts"
          code={`import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";
import { Rocket, BookOpen, Code } from "lucide-react";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder({
    ui: {
      colors: { primary: "oklch(0.72 0.19 149)" },
      typography: {
        font: {
          h1: { size: "2.25rem", weight: 700 },
          body: { size: "0.975rem", lineHeight: "1.8" },
        },
      },
    },
  }),

  nav: {
    title: <div style={{ display: "flex", gap: 8 }}>
      <Rocket size={14} /> My Docs
    </div>,
  },

  icons: {
    rocket: <Rocket size={16} />,
    book: <BookOpen size={16} />,
    code: <Code size={16} />,
  },
  sidebar: {
    banner: (
      <div>
        <h2>Welcome to the docs</h2>
        <p>This is a banner</p>
      </div>
    ),
    flat: false,
    collapsible: true,  
    footer: (
      <div>
        <p>This is a footer</p>
      </div>
    ),
  },
  components: { MyCustomCallout },

  breadcrumb: { enabled: true },
  themeToggle: { enabled: false, default: "dark" },
  ai: {
    enabled: true,
    mode: "floating",
    floatingStyle: "full-modal",
    apiKey: process.env.OPENAI_API_KEY,
    maxResults: 5,
    aiLabel: "DocsBot",
    suggestedQuestions: [
      "How do I get started?",
      "What themes are available?",
      "How do I create a custom component?",
      "How do I configure the sidebar?",
    ],
    model: {
      models: [
        { id: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
        { id: "gpt-4o", label: "GPT-4o (quality)" },
      ],
      defaultModel: "gpt-4o-mini",
    },
  },
  pageActions: {
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      target: "markdown",
      providers: ["chatgpt", "claude", "cursor"],
    },
  },

  metadata: {
    titleTemplate: "%s – Docs",
    description: "My documentation site",
  },
});`}
        />
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="relative z-10 bg-white dark:bg-black">
      <div className="absolute bottom-11 left-0 w-full h-px bg-black/[8%] dark:bg-white/[8%]" />
      <div className="absolute bottom-23 left-0 w-full h-px bg-black/[8%] dark:bg-white/[8%]" />
      <div className="w-full px-4 py-12 sm:px-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full">
            <span className="font-mono text-xs tracking-tighter text-black/40 dark:text-white/40 uppercase">
              <Link
                href="https://github.com/farming-labs/docs"
                target="_blank"
                className="text-black/30 dark:text-white/30 hover:underline hover:underline-offset-2 hover:decoration-black/30 dark:hover:decoration-white/30 hover:decoration-dotted hover:text-black/50 dark:hover:text-white/50 transition-colors no-underline lowercase font-mono"
              >
                @farming-labs/docs
              </Link>
            </span>
            <p className="text-[10px] uppercase font-mono text-black/30 dark:text-white/30 mt-1">
              Built by{" "}
              <Link
                href="https://github.com/farming-labs"
                target="_blank"
                className="text-black/30 dark:text-white/30 underline underline-offset-2 decoration-black/30 dark:decoration-white/30 decoration-dotted hover:text-black/50 dark:hover:text-white/50 transition-colors hover:no-underline uppercase font-mono"
              >
                farming-labs
              </Link>
            </p>
          </div>
          <div className="flex max-w-full w-full flex-wrap justify-end items-center gap-x-6 gap-y-3">
            <Link
              href="/docs"
              className="text-xs uppercase font-mono text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors hover:no-underline"
            >
              Documentation
            </Link>
            <Link
              href="https://status.farming-labs.dev"
              target="_blank"
              className="text-xs uppercase font-mono text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors hover:no-underline"
            >
              Status
            </Link>
            <Link
              href="https://github.com/farming-labs/docs"
              target="_blank"
              className="text-xs uppercase font-mono text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors hover:no-underline"
            >
              GitHub
            </Link>
            <Link
              href="https://www.npmjs.com/package/@farming-labs/docs"
              target="_blank"
              className="text-xs uppercase font-mono text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors hover:no-underline"
            >
              npm
            </Link>
            <div className="relative hidden sm:flex sm:items-center sm:pl-4 sm:pr-3">
              <span
                aria-hidden
                className="absolute -inset-y-4 left-0 w-px bg-black/10 dark:bg-white/10"
              />
              <SidebarThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen w-full overflow-y-hidden relative bg-white dark:bg-black">
      <div className="absolute top-14 w-full right-0 z-[999] h-px bg-black/[8%] dark:bg-white/[8%]" />
      <div className="pointer-events-none fixed inset-0 z-[999]">
        <div className="mx-auto max-w-[90%] h-full relative">
          <div className="absolute left-0 top-0 h-full w-px bg-black/[8%] dark:bg-white/[8%]" />
          <div className="absolute right-0 top-0 h-full w-px bg-black/[8%] dark:bg-white/[8%]" />
        </div>
      </div>
      <div className="max-w-[90%] mx-auto">
        <HeroSection />
        <InstallSection />
        <MigrationCalloutSection />
        <AgentFeaturesSection />
        <AgentScoreCalloutSection />
        <ThemesSection />
        <ConfigSection />
        <FooterSection />
      </div>
    </div>
  );
}
