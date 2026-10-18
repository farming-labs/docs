import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { hasUnserializableValues, restoreUnserializableValues } from "./config-values.js";

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("docs config values JSON cannot carry", () => {
  const onFeedback = () => undefined;
  const config = {
    entry: "docs",
    icons: { book: createElement("svg", { viewBox: "0 0 24 24" }) },
    feedback: { enabled: true, onFeedback },
    components: { Callout: () => null },
    pageActions: { openDocs: { providers: [{ name: "Claude", icon: createElement("svg") }] } },
  };

  it("finds elements, components, and callbacks anywhere in the config", () => {
    expect(hasUnserializableValues(config)).toBe(true);
    expect(hasUnserializableValues(roundTrip({ entry: "docs", icons: { book: "<svg/>" } }))).toBe(
      false,
    );
  });

  it("restores them from the module over the server's JSON copy", () => {
    // The server's copy: JSON, with a route Farm derived and no API key.
    const server = { ...roundTrip(config), docsPath: "/docs" };
    const module = { ...config, ai: { apiKey: "secret" } };

    const restored = restoreUnserializableValues(server, module) as any;

    expect(restored.icons.book).toBe(config.icons.book);
    expect(restored.feedback).toEqual({ enabled: true, onFeedback });
    expect(restored.components.Callout).toBe(config.components.Callout);
    expect(restored.pageActions.openDocs.providers[0]).toEqual({
      name: "Claude",
      icon: config.pageActions.openDocs.providers[0].icon,
    });
    expect(restored.docsPath).toBe("/docs");
    expect(restored).not.toHaveProperty("ai");
  });
});
