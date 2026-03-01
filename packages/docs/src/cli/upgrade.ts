/**
 * Upgrade @farming-labs/* packages to latest.
 * Detects framework from package.json by default, or use --framework (next, nuxt, sveltekit, astro).
 */
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  type Framework,
  detectFramework,
  detectPackageManager,
  installCommand,
  exec,
  fileExists,
} from "./utils.js";

const PRESETS = ["next", "nuxt", "sveltekit", "astro"] as const;
type PresetName = (typeof PRESETS)[number];

const PACKAGES_BY_FRAMEWORK: Record<Framework, string[]> = {
  nextjs: ["@farming-labs/docs", "@farming-labs/theme", "@farming-labs/next"],
  nuxt: ["@farming-labs/docs", "@farming-labs/nuxt", "@farming-labs/nuxt-theme"],
  sveltekit: ["@farming-labs/docs", "@farming-labs/svelte", "@farming-labs/svelte-theme"],
  astro: ["@farming-labs/docs", "@farming-labs/astro", "@farming-labs/astro-theme"],
};

function presetFromFramework(fw: Framework): PresetName {
  return fw === "nextjs" ? "next" : fw;
}

function frameworkFromPreset(preset: PresetName): Framework {
  return preset === "next" ? "nextjs" : preset;
}

export type UpgradeTag = "latest" | "beta";

export interface UpgradeOptions {
  /** Explicit framework: next, nuxt, sveltekit, astro. If not set, framework is auto-detected. */
  framework?: string;
  /** npm dist-tag to install: "latest" (default) or "beta". */
  tag?: UpgradeTag;
}

export async function upgrade(options: UpgradeOptions = {}) {
  const cwd = process.cwd();
  const tag = options.tag ?? "latest";

  p.intro(pc.bgCyan(pc.black(" @farming-labs/docs upgrade ")));

  const packageJsonPath = path.join(cwd, "package.json");
  if (!fileExists(packageJsonPath)) {
    p.log.error("No package.json found in the current directory. Run this from your project root.");
    process.exit(1);
  }

  let framework: Framework | null = null;
  let preset: PresetName;

  if (options.framework) {
    const raw = options.framework.toLowerCase().trim();
    const normalized = raw === "nextjs" ? "next" : raw;
    if (!PRESETS.includes(normalized as PresetName)) {
      p.log.error(
        `Invalid framework ${pc.cyan(options.framework)}. Use one of: ${PRESETS.map((t) => pc.cyan(t)).join(", ")}`,
      );
      process.exit(1);
    }
    preset = normalized as PresetName;
    framework = frameworkFromPreset(preset);
  } else {
    framework = detectFramework(cwd);
    if (!framework) {
      p.log.error(
        "Could not detect a supported framework (Next.js, Nuxt, SvelteKit, Astro). Use " +
          pc.cyan("--framework <next|nuxt|sveltekit|astro>") +
          " to specify.",
      );
      process.exit(1);
    }
    preset = presetFromFramework(framework);
  }

  const packages = PACKAGES_BY_FRAMEWORK[framework];
  const packagesWithTag = packages.map((name) => `${name}@${tag}`);
  const pm = detectPackageManager(cwd);
  const cmd = `${installCommand(pm)} ${packagesWithTag.join(" ")}`;

  p.log.step(`Upgrading ${preset} docs packages to ${tag}...`);
  p.log.message(pc.dim(packages.join(", ")));

  try {
    exec(cmd, cwd);
    p.log.success(`Packages upgraded to ${tag}.`);
    p.outro(pc.green("Done. Run your dev server to confirm everything works."));
  } catch {
    p.log.error("Upgrade failed. Try running manually:\n  " + pc.cyan(cmd));
    process.exit(1);
  }
}
