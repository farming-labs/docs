// Wraps @next/mdx's real loader and appends one JSON line per compiled file: the
// worker pid, start/end epoch milliseconds, and the CPU time that worker spent on it.
const { appendFileSync } = require("node:fs");

module.exports = function mdxTimingLoader(source) {
  const { log, inner, innerOptions } = this.getOptions();
  const done = this.async();
  const start = Date.now();
  const t0 = performance.now();
  const c0 = process.cpuUsage();
  const file = this.resourcePath;
  const proxy = new Proxy(this, {
    get(target, prop, receiver) {
      if (prop === "getOptions") return () => innerOptions;
      if (prop === "async")
        return () => (error, code, map) => {
          const cpu = process.cpuUsage(c0);
          appendFileSync(
            log,
            JSON.stringify({
              pid: process.pid,
              file,
              start,
              end: Date.now(),
              wallMs: performance.now() - t0,
              cpuMs: (cpu.user + cpu.system) / 1000,
              ok: !error,
            }) + "\n",
          );
          done(error, code, map);
        };
      return Reflect.get(target, prop, receiver);
    },
  });
  require(inner).call(proxy, source);
};
