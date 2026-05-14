import { describe, expect, it } from "vitest";
import {
  createDocsRobotsResponse,
  renderDocsRobotsTxt,
  resolveDocsRobotsRequest,
} from "./robots.js";

describe("docs robots helpers", () => {
  it("serves a default robots.txt response with agent routes and sitemap hints", async () => {
    const response = createDocsRobotsResponse({
      request: new Request("https://docs.example.com/robots.txt"),
      entry: "docs",
      baseUrl: "https://docs.example.com",
    });

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/plain");

    const content = await response?.text();
    expect(content).toContain("Allow: /llms.txt");
    expect(content).toContain("Allow: /sitemap.xml");
    expect(content).toContain("Allow: /.well-known/agent.json");
    expect(content).toContain("User-agent: GPTBot");
    expect(content).toContain("Sitemap: https://docs.example.com/sitemap.xml");
  });

  it("honors robots opt-out for public and API robots requests", () => {
    expect(resolveDocsRobotsRequest(new URL("https://example.com/robots.txt"), false)).toBeNull();
    expect(
      createDocsRobotsResponse({
        request: new Request("https://example.com/api/docs?format=robots"),
        robots: false,
      }),
    ).toBeNull();
    expect(renderDocsRobotsTxt({ robots: false })).toBe("");
  });
});
