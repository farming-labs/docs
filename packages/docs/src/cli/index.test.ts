import { describe, it, expect } from "vitest";
import { parseFlags } from "./index.js";

describe("parseFlags", () => {
  it("parses --key=value form", () => {
    expect(parseFlags(["--template=next", "--name=my-docs"])).toEqual({
      template: "next",
      name: "my-docs",
    });
  });

  it("parses --key value form", () => {
    expect(parseFlags(["--template", "next", "--name", "my-docs"])).toEqual({
      template: "next",
      name: "my-docs",
    });
  });

  it("parses init options: template, name, theme, entry", () => {
    const flags = parseFlags([
      "--template",
      "astro",
      "--name",
      "my-app",
      "--theme",
      "darksharp",
      "--entry",
      "docs",
    ]);
    expect(flags.template).toBe("astro");
    expect(flags.name).toBe("my-app");
    expect(flags.theme).toBe("darksharp");
    expect(flags.entry).toBe("docs");
  });

  it("parses api reference flags", () => {
    const flags = parseFlags(["--api-reference", "--api-route-root", "internal-api", "--no-other"]);
    expect(flags["api-reference"]).toBe(true);
    expect(flags["api-route-root"]).toBe("internal-api");
    expect(flags.other).toBe(false);
  });

  it("parses boolean values in --key=value form", () => {
    const flags = parseFlags(["--api-reference=false", "--theme=colorful"]);
    expect(flags["api-reference"]).toBe(false);
    expect(flags.theme).toBe("colorful");
  });

  it("keeps string-valued flags as strings even when they look boolean", () => {
    const flags = parseFlags(["--name=true", "--entry=false"]);
    expect(flags.name).toBe("true");
    expect(flags.entry).toBe("false");
  });

  it("parses upgrade option: framework", () => {
    expect(parseFlags(["upgrade", "--framework", "nuxt"]).framework).toBe("nuxt");
    expect(parseFlags(["--framework=sveltekit"]).framework).toBe("sveltekit");
  });

  it("returns empty object for empty argv", () => {
    expect(parseFlags([])).toEqual({});
  });

  it("ignores standalone values that are not next to a flag", () => {
    const flags = parseFlags(["init", "--theme", "greentree"]);
    expect(flags.theme).toBe("greentree");
    expect(flags.name).toBeUndefined();
  });

  it("does not use next flag as value when flag follows flag", () => {
    const flags = parseFlags(["--template", "--name", "foo"]);
    expect(flags.template).toBeUndefined();
    expect(flags.name).toBe("foo");
  });
});
