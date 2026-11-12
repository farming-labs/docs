// Wraps @next/mdx's loader. "record" runs the real loader and stores its output.
// "replay" returns the stored output without any MDX work and fails on a cache miss.
const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

module.exports = function mdxReplayLoader(source) {
  const { mode, dir, inner, innerOptions } = this.getOptions();
  const key = createHash("sha256")
    .update(this.resourcePath)
    .update("\0")
    .update(source)
    .digest("hex");
  const file = join(dir, `${key}.js`);

  if (mode === "replay") {
    let code;
    try {
      code = readFileSync(file, "utf8");
    } catch {
      this.callback(
        new Error(`MDX replay cache miss for ${this.resourcePath}. Run a record build first.`),
      );
      return;
    }
    this.callback(null, code);
    return;
  }
  if (mode !== "record") {
    this.callback(new Error(`Unknown MDX replay mode "${mode}". Use "record" or "replay".`));
    return;
  }

  mkdirSync(dir, { recursive: true });
  const done = this.async();
  const proxy = new Proxy(this, {
    get(target, prop, receiver) {
      if (prop === "getOptions") return () => innerOptions;
      if (prop === "async")
        return () => (error, code, map) => {
          if (!error) writeFileSync(file, String(code));
          done(error, code, map);
        };
      return Reflect.get(target, prop, receiver);
    },
  });
  require(inner).call(proxy, source);
};
