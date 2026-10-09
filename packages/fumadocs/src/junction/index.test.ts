import { describe, expect, it } from "vitest";
import { junction } from "./index.js";

describe("junction theme", () => {
  it("uses the blueprint cross-framework layout contract", () => {
    expect(junction()).toMatchObject({
      name: "junction",
      ui: {
        radius: "0px",
        layout: {
          contentWidth: 920,
          sidebarWidth: 264,
          tocWidth: 240,
          header: { height: 60, sticky: true },
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
      colors: { primary: "#7c3aed", background: "#edf4ff" },
      layout: { contentWidth: 900, sidebarWidth: 264 },
    });
  });
});
