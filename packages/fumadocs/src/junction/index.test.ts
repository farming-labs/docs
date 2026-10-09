import { describe, expect, it } from "vitest";
import { junction } from "./index.js";

describe("junction theme", () => {
  it("uses the compact cross-framework layout contract", () => {
    expect(junction()).toMatchObject({
      name: "junction",
      ui: {
        radius: "0.125rem",
        layout: {
          contentWidth: 840,
          sidebarWidth: 248,
          tocWidth: 224,
          header: { height: 56, sticky: true },
        },
        sidebar: { style: "bordered" },
      },
    });
  });

  it("allows consumers to override individual theme values", () => {
    expect(
      junction({
        ui: {
          colors: { primary: "#7c3aed" },
          layout: { contentWidth: 900 },
        },
      }).ui,
    ).toMatchObject({
      colors: { primary: "#7c3aed", background: "#fbfbf8" },
      layout: { contentWidth: 900, sidebarWidth: 248 },
    });
  });
});
