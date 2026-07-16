import { expect, test } from "@playwright/test";

test.describe("Changelog UI", () => {
  test("index shows timeline rail, tags, and MDX", async ({ page }) => {
    await page.goto("/docs/changelogs");
    const visibleTimelineLine = page.locator(".fd-changelog-directory-line:visible").first();
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

  test("release rail keeps scroll state when search rerenders its items", async ({ page }) => {
    await page.goto("/docs/changelogs#2026-04-03");
    await page.waitForTimeout(300);

    const rail = page.locator('[data-fd-changelog-toc][data-variant="releases"]');
    const latestRelease = rail.locator('a[href="#2026-04-15"]');
    const search = page.getByPlaceholder("Search changelog entries");

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(latestRelease).toHaveAttribute("data-active", "true");

    const releaseLinks = rail.locator("a");
    await search.fill("OpenAPI");
    await expect(releaseLinks).toHaveCount(1);
    await search.fill("");
    await expect(releaseLinks).toHaveCount(3);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        }),
    );

    const activeRelease = rail.locator('a[data-active="true"]');
    expect(await activeRelease.count()).toBe(1);
    expect(await activeRelease.getAttribute("href")).toBe("#2026-04-15");
    expect(await activeRelease.getAttribute("aria-current")).toBe("location");
    await expect(page).toHaveURL(/#2026-04-03$/);
  });

  test("release rail ignores delayed hash updates after scroll takes over", async ({ page }) => {
    await page.goto("/docs/changelogs#2026-04-03");
    await page.waitForTimeout(300);

    const rail = page.locator('[data-fd-changelog-toc][data-variant="releases"]');
    const releaseLinks = rail.locator("a");
    const search = page.getByPlaceholder("Search changelog entries");
    const clockTime = new Date("2026-01-01T00:00:00Z");

    await page.clock.install({ time: clockTime });
    await page.clock.pauseAt(new Date(clockTime.getTime() + 1_000));

    await search.fill("OpenAPI");
    await page.clock.runFor(1);
    expect(await releaseLinks.count()).toBe(1);

    await search.fill("");
    await page.clock.runFor(1);
    expect(await releaseLinks.count()).toBe(3);

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      window.dispatchEvent(new Event("scroll"));
    });
    await page.clock.runFor(32);

    let activeRelease = rail.locator('a[data-active="true"]');
    expect(await activeRelease.count()).toBe(1);
    expect(await activeRelease.getAttribute("href")).toBe("#2026-04-15");

    await page.clock.runFor(300);

    activeRelease = rail.locator('a[data-active="true"]');
    expect(await activeRelease.count()).toBe(1);
    expect(await activeRelease.getAttribute("href")).toBe("#2026-04-15");
    expect(await activeRelease.getAttribute("aria-current")).toBe("location");
    await expect(page).toHaveURL(/#2026-04-03$/);
  });

  test("release rail activates a short final release at the document end", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/docs/changelogs");

    const rail = page.locator('[data-fd-changelog-toc][data-variant="releases"]');
    const oldestRelease = rail.locator('a[href="#2026-03-18"]');

    await expect(oldestRelease).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        }),
    );

    await page.locator('[id="2026-03-18"]').evaluate((element) => {
      const target = element as HTMLElement;
      target.style.height = "4rem";
      target.style.overflow = "hidden";
    });

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, document.documentElement.scrollHeight);
      window.dispatchEvent(new Event("scroll"));
    });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const scrollingElement = document.scrollingElement ?? document.documentElement;
          return (
            scrollingElement.scrollHeight -
            scrollingElement.scrollTop -
            scrollingElement.clientHeight
          );
        }),
      )
      .toBeLessThanOrEqual(2);

    const targetPosition = await page.locator('[id="2026-03-18"]').evaluate((element) => ({
      threshold: Math.max(140, window.innerHeight * 0.18),
      top: element.getBoundingClientRect().top,
    }));
    expect(targetPosition.top).toBeGreaterThan(targetPosition.threshold);

    const activeRelease = rail.locator('a[data-active="true"]');
    await expect(activeRelease).toHaveCount(1);
    await expect(activeRelease).toHaveAttribute("href", "#2026-03-18");
    await expect(oldestRelease).toHaveAttribute("aria-current", "location");
  });
});
