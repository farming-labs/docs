import { expect, test } from "@playwright/test";

test.describe("Changelog UI", () => {
  test("index shows timeline rail, tags, and MDX", async ({ page }) => {
    await page.goto("/docs/changelogs");
    const visibleTimelineLine = page.locator('[data-testid="changelog-timeline-line"]:visible').first();
    const visibleTag = page.locator('[data-testid="changelog-tag"]:visible').first();

    await expect(page.getByRole("heading", { name: "Changelog", level: 1 })).toBeVisible();

    await expect(page.getByTestId("changelog-rail").first()).toBeVisible();
    await expect(visibleTimelineLine).toBeVisible();
    const lineBox = await visibleTimelineLine.boundingBox();
    expect(lineBox).not.toBeNull();
    expect(lineBox!.height).toBeGreaterThan(24);

    await expect(visibleTag).toBeVisible();
    const borderWidth = await visibleTag.evaluate((el) => {
      return window.getComputedStyle(el).borderWidth;
    });
    expect(borderWidth).not.toBe("0px");

    await expect(page.getByRole("heading", { name: "What shipped", level: 2 }).first()).toBeVisible();
  });

  test("entry page shows rail and prose", async ({ page }) => {
    await page.goto("/docs/changelogs/2026-04-15");
    await expect(page.getByTestId("changelog-rail")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What shipped", level: 2 }).first()).toBeVisible();
  });
});
