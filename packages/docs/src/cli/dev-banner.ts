import os from "node:os";
import pc from "picocolors";

type DevBannerOptions = {
  name?: string;
  version?: string;
  port: number;
  host?: string | boolean;
  protocol?: "http" | "https";
  startTime: number;
  localUrl?: string;
  networkUrl?: string;
};

export function createDevLogger() {
  return {
    info(msg: string) {
      if (
        msg.includes("VITE") ||
        msg.includes("vite") ||
        msg.includes("ready in") ||
        msg.includes("Local:") ||
        msg.includes("Network:") ||
        msg.includes("➜") ||
        msg.includes("Port") ||
        msg.includes("trying another")
      ) {
        return;
      }

      console.log(msg);
    },
    warn(msg: string) {
      console.warn(pc.yellow(msg));
    },
    warnOnce(msg: string) {
      console.warn(pc.yellow(msg));
    },
    error(msg: string) {
      console.error(pc.red(msg));
    },
    clearScreen() {},
    hasErrorLogged() {
      return false;
    },
    hasWarned: false,
  };
}

function resolveLocalUrl(protocol: "http" | "https", port: number, localUrl?: string): string {
  const resolved = localUrl ?? `${protocol}://localhost:${port}/`;
  return resolved.endsWith("/") ? resolved : `${resolved}/`;
}

function resolveNetworkUrl(options: {
  protocol: "http" | "https";
  port: number;
  host?: string | boolean;
  networkUrl?: string;
}): string | null {
  const isExposed =
    options.host === true ||
    options.host === "0.0.0.0" ||
    (typeof options.host === "string" &&
      options.host !== "localhost" &&
      options.host !== "127.0.0.1");

  if (!isExposed) return null;

  if (options.networkUrl) {
    return options.networkUrl.endsWith("/") ? options.networkUrl : `${options.networkUrl}/`;
  }

  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const iface of entries ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return `${options.protocol}://${iface.address}:${options.port}/`;
      }
    }
  }

  return "";
}

export function printDevBanner({
  name = "@farming-labs/docs",
  version = "v0.0.0",
  port,
  host,
  protocol = "http",
  startTime,
  localUrl,
  networkUrl,
}: DevBannerOptions) {
  const elapsed = Date.now() - startTime;
  const resolvedLocalUrl = resolveLocalUrl(protocol, port, localUrl);
  const resolvedNetworkUrl = resolveNetworkUrl({
    protocol,
    port,
    host,
    networkUrl,
  });

  console.log("");
  console.log(`  ${pc.bold(pc.green(name))} ${pc.dim(version)} ${pc.dim(`ready in ${elapsed}ms`)}`);
  console.log("");
  console.log(`  ${pc.dim("➜")}  ${pc.bold("Local:")}   ${pc.cyan(resolvedLocalUrl)}`);

  if (resolvedNetworkUrl === null) {
    console.log(`  ${pc.dim("➜")}  ${pc.bold("Network:")} ${pc.dim("use --host to expose")}`);
  } else if (resolvedNetworkUrl === "") {
    console.log(
      `  ${pc.dim("➜")}  ${pc.bold("Network:")} ${pc.dim("no external interface found")}`,
    );
  } else {
    console.log(`  ${pc.dim("➜")}  ${pc.bold("Network:")} ${pc.cyan(resolvedNetworkUrl)}`);
  }

  console.log("");
}
