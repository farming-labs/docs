import { expect, test } from "@playwright/test";

test.describe("Changelog UI", () => {
  test("index shows timeline rail, tags, and MDX", async ({ page }) => {
    await page.goto("/docs/changelogs");
    const visibleTimelineLine = page
      .locator('[data-testid="changelog-timeline-line"]:visible')
      .first();
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

    await expect(
      page.getByRole("heading", { name: "What shipped", level: 2 }).first(),
    ).toBeVisible();
  });

  test("entry page shows rail and prose", async ({ page }) => {
    await page.goto("/docs/changelogs/2026-04-15");
    await expect(page.getByTestId("changelog-rail")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What shipped", level: 2 }).first(),
    ).toBeVisible();
  });

  test("release rail follows scrolling after hash navigation", async ({ page }) => {
    await page.goto("/docs/changelogs");

    const rail = page.locator('[data-fd-changelog-toc][data-variant="releases"]');
    const middleRelease = rail.locator('a[href="#2026-04-03"]');
    const oldestRelease = rail.locator('a[href="#2026-03-18"]');

    await middleRelease.click();
    await expect(page).toHaveURL(/#2026-04-03$/);
    await expect(middleRelease).toHaveAttribute("data-active", "true");

    await page.locator('[id="2026-03-18"]').evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });

    await expect(oldestRelease).toHaveAttribute("data-active", "true");
    await expect(page).toHaveURL(/#2026-04-03$/);
  });

  test("release rail highlights deep-link hash then follows scroll", async ({ page }) => {
    await page.goto("/docs/changelogs#2026-04-03");

    const rail = page.locator('[data-fd-changelog-toc][data-variant="releases"]');
    const middleRelease = rail.locator('a[href="#2026-04-03"]');
    const oldestRelease = rail.locator('a[href="#2026-03-18"]');

    await expect(page).toHaveURL(/#2026-04-03$/);
    await expect(middleRelease).toHaveAttribute("data-active", "true");

    await page.locator('[id="2026-03-18"]').evaluate((element) => {
      element.scrollIntoView({ block: "start" });
    });

    await expect(oldestRelease).toHaveAttribute("data-active", "true");
    await expect(page).toHaveURL(/#2026-04-03$/);
  });
});
