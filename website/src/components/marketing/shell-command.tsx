import { cn } from "@/lib/utils";

const SUBCOMMANDS = new Set(["dlx", "exec", "add", "create", "run", "x", "-s", "install", "i"]);
const BINARIES = new Set(["pnpm", "npm", "npx", "yarn", "bun", "bunx", "curl", "docs", "pnpx"]);

type Token = { text: string; kind: "bin" | "sub" | "scope" | "pkg" | "flag" | "url" | "word" };

function tokenize(command: string): Token[] {
  const words = command.split(" ");
  return words.flatMap((word, index): Token[] => {
    if (index === 0 || (BINARIES.has(word) && index < 2)) return [{ text: word, kind: "bin" }];
    if (SUBCOMMANDS.has(word)) return [{ text: word, kind: "sub" }];
    if (word.startsWith("-")) return [{ text: word, kind: "flag" }];
    if (word.startsWith("@") && word.includes("/")) {
      const slash = word.indexOf("/");
      return [
        { text: word.slice(0, slash + 1), kind: "scope" },
        { text: word.slice(slash + 1), kind: "pkg" },
      ];
    }
    if (word.includes(".") && word.includes("/")) return [{ text: word, kind: "url" }];
    return [{ text: word, kind: "word" }];
  });
}

const tone: Record<Token["kind"], string> = {
  bin: "text-mk-fg",
  sub: "text-mk-fg/45",
  scope: "text-mk-fg/55",
  pkg: "text-mk-fg/90",
  flag: "text-mk-fg/45",
  url: "text-mk-fg/75 underline decoration-mk-fg/20 underline-offset-2",
  word: "text-mk-fg",
};

/**
 * A shell command coloured the way farm.js prints its terminals: the binary and the
 * verb bright, subcommands and flags dim, the package scope a step below its name.
 */
export function ShellCommand({
  command,
  prompt = true,
  className,
}: {
  command: string;
  prompt?: boolean;
  className?: string;
}) {
  const tokens = tokenize(command);
  return (
    <span className={cn("font-mono", className)}>
      {prompt ? (
        <span aria-hidden className="mr-2.5 select-none text-mk-fg/30">
          $
        </span>
      ) : null}
      {tokens.map((token, index) => {
        const joined = token.kind === "pkg";
        return (
          <span key={`${token.text}-${index}`}>
            {index > 0 && !joined ? " " : null}
            <span className={tone[token.kind]}>{token.text}</span>
          </span>
        );
      })}
    </span>
  );
}
