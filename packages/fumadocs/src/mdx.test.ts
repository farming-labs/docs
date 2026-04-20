import { describe, expect, it } from "vitest";
import { getMDXComponents } from "./mdx.js";

describe("getMDXComponents", () => {
  it("includes the Agent primitive by default without user registration", () => {
    const components = getMDXComponents();

    expect(typeof components.Agent).toBe("function");

    const AgentComponent = components.Agent as (props: { children?: unknown }) => unknown;
    expect(AgentComponent({ children: "hidden agent-only context" })).toBeNull();
  });
});
