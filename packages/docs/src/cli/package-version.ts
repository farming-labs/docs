import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  type Framework,
  type PackageManager,
  detectFramework,
  detectPackageManagerFromProject,
  formatPackageManagerDetection,
  installCommand,
} from "./utils.js";

export const PRESETS = ["next", "tanstack-start", "nuxt", "sveltekit", "astro"] as const;
export type PresetName = (typeof PRESETS)[number];
export type UpgradeFramework = Framework;

export const PACKAGES_BY_FRAMEWORK: Record<UpgradeFramework, string[]> = {
  nextjs: ["@farming-labs/docs", "@farming-labs/theme", "@farming-labs/next"],
  "tanstack-start": ["@farming-labs/docs", "@farming-labs/theme", "@farming-labs/tanstack-start"],
  nuxt: ["@farming-labs/docs", "@farming-labs/nuxt", "@farming-labs/nuxt-theme"],
  sveltekit: ["@farming-labs/docs", "@farming-labs/svelte", "@farming-labs/svelte-theme"],
  astro: ["@farming-labs/docs", "@farming-labs/astro", "@farming-labs/astro-theme"],
};

export function presetFromFramework(fw: UpgradeFramework): PresetName {
  return fw === "nextjs" ? "next" : fw;
}

export function frameworkFromPreset(preset: PresetName): UpgradeFramework {
  return preset === "next" ? "nextjs" : preset;
}

export function getPackagesForFramework(framework: UpgradeFramework): string[] {
  return PACKAGES_BY_FRAMEWORK[framework];
}

const exactSemverPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function validateUpgradeVersion(version: string): string {
  const normalized = version.trim();
  if (!exactSemverPattern.test(normalized)) {
    throw new Error(`Invalid version "${version}". Use an exact semver version like 0.1.104.`);
  }
  return normalized;
}

export function buildDocsPackageInstallCommand(
  framework: UpgradeFramework,
  target: string,
  pm: PackageManager,
): string {
  const packages = getPackagesForFramework(framework);
  const packagesWithTarget = packages.map((name) => `${name}@${target}`);
  return `${installCommand(pm)} ${packagesWithTarget.join(" ")}`;
}

export function resolveDocsPackageFramework(
  cwd: string,
  rawFramework?: string,
): {
  framework: UpgradeFramework;
  preset: PresetName;
} {
  if (rawFramework) {
    const raw = rawFramework.toLowerCase().trim();
    const normalized = raw === "nextjs" ? "next" : raw;
    if (!PRESETS.includes(normalized as PresetName)) {
      p.log.error(
        `Invalid framework ${pc.cyan(rawFramework)}. Use one of: ${PRESETS.map((t) => pc.cyan(t)).join(", ")}`,
      );
      process.exit(1);
    }

    const preset = normalized as PresetName;
    return {
      framework: frameworkFromPreset(preset),
      preset,
    };
  }

  const detected = detectFramework(cwd);
  if (!detected) {
    p.log.error(
      "Could not detect a supported framework (Next.js, TanStack Start, Nuxt, SvelteKit, Astro). Use " +
        pc.cyan("--framework <next|tanstack-start|nuxt|sveltekit|astro>") +
        " to specify.",
    );
    process.exit(1);
  }

  return {
    framework: detected,
    preset: presetFromFramework(detected),
  };
}

export async function resolveDocsPackageManager(
  cwd: string,
  command: "upgrade" | "downgrade",
): Promise<PackageManager> {
  const detected = detectPackageManagerFromProject(cwd);
  if (detected) {
    p.log.info(
      `Detected ${pc.cyan(detected.packageManager)} from ${formatPackageManagerDetection(cwd, detected)}`,
    );
    return detected.packageManager;
  }

  const pmAnswer = await p.select({
    message: `Which package manager do you want to use for this ${command}?`,
    options: [
      { value: "pnpm", label: "pnpm", hint: "Use pnpm add" },
      { value: "npm", label: "npm", hint: "Use npm add" },
      { value: "yarn", label: "yarn", hint: "Use yarn add" },
      { value: "bun", label: "bun", hint: "Use bun add" },
    ] as const,
  });

  if (p.isCancel(pmAnswer)) {
    const label = command === "upgrade" ? "Upgrade" : "Downgrade";
    p.outro(pc.red(`${label} cancelled.`));
    process.exit(0);
  }

  const pm = pmAnswer as PackageManager;
  p.log.info(`Using ${pc.cyan(pm)} as package manager`);
  return pm;
}
