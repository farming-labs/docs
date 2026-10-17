import docsPackage from "../../packages/docs/package.json";

const REPO = "farming-labs/docs";
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const STABLE_TAG = /^v\d+\.\d+\.\d+$/;

export type LatestRelease = {
  version: string;
  /** What the release is about, or null when GitHub has nothing better than the tag. */
  title: string | null;
  href: string;
};

type GitHubRelease = { tag_name: string; name: string | null; html_url: string };
type GitHubTag = { name: string };
type GitHubCompare = { commits: { commit: { message: string } }[] };

async function github<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** `feat(api): configure renderer options (#544)` → `Configure renderer options`. */
function headline(message: string) {
  const subject = message
    .split("\n")[0]!
    .replace(/^\w+(\([^)]*\))?!?:\s*/, "")
    .replace(/\s*\(#\d+\)$/, "")
    .trim();
  return subject ? subject[0]!.toUpperCase() + subject.slice(1) : null;
}

/**
 * The newest release for the site banner, refreshed hourly. A published GitHub
 * release wins; otherwise the newest stable tag, titled by the feature it shipped;
 * offline, the version in this checkout.
 */
export async function getLatestRelease(): Promise<LatestRelease> {
  const release = await github<GitHubRelease>("releases/latest");
  if (release) {
    const title = release.name
      ?.replace(release.tag_name, "")
      .replace(/^[\s·:–—-]+/, "")
      .trim();
    return { version: release.tag_name, title: title || null, href: release.html_url };
  }

  const [latest, previous] = ((await github<GitHubTag[]>("tags?per_page=30")) ?? []).filter((tag) =>
    STABLE_TAG.test(tag.name),
  );
  if (latest) {
    const compare = previous
      ? await github<GitHubCompare>(`compare/${previous.name}...${latest.name}`)
      : null;
    const messages = (compare?.commits ?? []).map(({ commit }) => commit.message).reverse();
    const shipped =
      messages.find((message) => message.startsWith("feat")) ??
      messages.find((message) => /^(fix|perf)\b/.test(message));
    return {
      version: latest.name,
      title: shipped ? headline(shipped) : null,
      href: `${RELEASES_URL}/tag/${latest.name}`,
    };
  }

  const version = `v${docsPackage.version}`;
  return { version, title: null, href: `${RELEASES_URL}/tag/${version}` };
}
