import { expect, test } from "@playwright/test";

test.describe("Agent markdown fallback", () => {
  test("hides Agent blocks in the page UI and includes them in the .md fallback", async ({
    page,
    request,
  }) => {
    await page.goto("/docs/quickstart");

    await expect(page.getByRole("heading", { name: "Quickstart", level: 1 })).toBeVisible();
    await expect(page.getByText("You are an implementation agent.")).toHaveCount(0);

    const response = await request.get("/docs/quickstart.md");
    expect(response.ok()).toBeTruthy();

    const markdown = await response.text();
    expect(markdown).toContain("# Quickstart");
    expect(markdown).toContain("You are an implementation agent.");
    expect(markdown).not.toContain("<Agent>");
  });
});
