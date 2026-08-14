import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ADVISORY_URL = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const SEVERITY_ORDER = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

export function collectVersions(tree) {
  const versionsByName = new Map();
  const seen = new Set();

  function add(name, version) {
    if (!name || !version) return;
    const text = String(version);
    if (text.startsWith("link:") || text.startsWith("file:") || text.startsWith("workspace:")) {
      return;
    }
    const versions = versionsByName.get(name) ?? new Set();
    versions.add(text);
    versionsByName.set(name, versions);
  }

  function visit(record) {
    if (!record || typeof record !== "object") return;
    for (const [name, dependency] of Object.entries(record)) {
      if (!dependency || typeof dependency !== "object") continue;
      add(name, dependency.version);
      const key = dependency.path ?? `${name}@${dependency.version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      visit(dependency.dependencies);
      visit(dependency.devDependencies);
      visit(dependency.optionalDependencies);
      visit(dependency.peerDependencies);
    }
  }

  for (const workspace of tree) {
    add(workspace.name, workspace.version);
    visit(workspace.dependencies);
    visit(workspace.devDependencies);
    visit(workspace.optionalDependencies);
    visit(workspace.peerDependencies);
  }
  return [...versionsByName.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function advisoryId(advisory) {
  return (
    String(advisory.url ?? "")
      .split("/")
      .at(-1) ?? ""
  );
}

export function classifyFindings(advisoriesByName, allowlist, today) {
  if (allowlist.version !== 1 || !Array.isArray(allowlist.exceptions)) {
    throw new Error("Security audit allowlist must use version 1 with an exceptions array.");
  }
  const exceptions = new Map();
  for (const entry of allowlist.exceptions) {
    if (
      !entry ||
      typeof entry.advisory !== "string" ||
      typeof entry.package !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? "") ||
      typeof entry.reason !== "string" ||
      !entry.reason.trim()
    ) {
      throw new Error(
        "Every security audit exception needs advisory, package, expires, and reason.",
      );
    }
    exceptions.set(`${entry.package}:${entry.advisory}`, entry);
  }

  const blocked = [];
  const allowed = [];
  for (const [name, advisories] of Object.entries(advisoriesByName)) {
    if (!Array.isArray(advisories)) continue;
    for (const advisory of advisories) {
      const severity = advisory.severity ?? "info";
      if ((SEVERITY_ORDER[severity] ?? -1) < SEVERITY_ORDER.high) continue;
      const finding = {
        name,
        advisory: advisoryId(advisory),
        severity,
        title: advisory.title,
        vulnerableVersions: advisory.vulnerable_versions,
        url: advisory.url,
      };
      const exception = exceptions.get(`${name}:${finding.advisory}`);
      if (exception && exception.expires >= today) allowed.push({ ...finding, exception });
      else blocked.push({ ...finding, ...(exception ? { expiredException: exception } : {}) });
    }
  }
  return { blocked, allowed };
}

export async function runSecurityAudit(tree, allowlist, options = {}) {
  const entries = collectVersions(tree);
  const blocked = [];
  const allowed = [];
  const request = options.fetch ?? fetch;
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  for (let index = 0; index < entries.length; index += 250) {
    const payload = Object.fromEntries(
      entries.slice(index, index + 250).map(([name, versions]) => [name, [...versions].sort()]),
    );
    const response = await request(ADVISORY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(
        `npm bulk advisory request failed with ${response.status}: ${await response.text()}`,
      );
    }
    const classified = classifyFindings(await response.json(), allowlist, today);
    blocked.push(...classified.blocked);
    allowed.push(...classified.allowed);
  }
  return { packageCount: entries.length, blocked, allowed };
}

function printFinding(finding) {
  console.error(
    `- [${finding.severity}] ${finding.name}: ${finding.title} (${finding.vulnerableVersions})`,
  );
  console.error(`  ${finding.url}`);
}

async function main() {
  const [treeFile, allowlistFile] = process.argv.slice(2);
  if (!treeFile || !allowlistFile) {
    throw new Error(
      "Usage: node scripts/security-audit.mjs <dependency-tree.json> <allowlist.json>",
    );
  }
  const [tree, allowlist] = await Promise.all(
    [treeFile, allowlistFile].map(async (file) => JSON.parse(await fs.readFile(file, "utf8"))),
  );
  const result = await runSecurityAudit(tree, allowlist);
  console.log(`Scanned ${result.packageCount} package names using npm bulk advisories.`);
  for (const finding of result.allowed) {
    console.warn(
      `⚠️ Allowed ${finding.advisory} for ${finding.name} until ${finding.exception.expires}: ${finding.exception.reason}`,
    );
  }
  if (result.blocked.length === 0) {
    console.log("✅ No unapproved high or critical vulnerabilities found");
    return;
  }
  result.blocked.sort((left, right) => {
    const severityDelta = SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity];
    return severityDelta || left.name.localeCompare(right.name);
  });
  console.error(
    `❌ Found ${result.blocked.length} unapproved high/critical vulnerabilit${result.blocked.length === 1 ? "y" : "ies"}`,
  );
  for (const finding of result.blocked) {
    if (finding.expiredException) {
      console.error(
        `  Exception for ${finding.advisory} expired on ${finding.expiredException.expires}.`,
      );
    }
    printFinding(finding);
  }
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
