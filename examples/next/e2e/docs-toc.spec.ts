import { expect, test } from "@playwright/test";

test("TOC shows heading text while keeping anchor copying and client navigation", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  const toc = page.locator("#nd-toc");
  await expect(toc.locator('a[href="#features"]')).toHaveText("Features");
  await expect(toc.locator('a[href="#quick-start"]')).toHaveText("Quick Start");
  await expect(toc).not.toContainText("Copy Anchor Link");

  const heading = page.locator("h2#features");
  await heading.hover();
  await heading.getByRole("button", { name: "Copy Anchor Link" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toMatch(/#features$/);

  await toc.locator('a[href="#quick-start"]').click();
  await expect(page).toHaveURL(/#quick-start$/);

  await page.evaluate(() => {
    document.documentElement.dataset.tocNavigation = "preserved";
  });
  await page.locator('a[href="/docs/getting-started"]').first().click();
  await expect(toc.locator('a[href="#create-the-auth-client"]')).toHaveText(
    "Create the Auth Client",
  );
  await expect(toc.locator('a[href="#features"]')).toHaveCount(0);
  await expect(toc).not.toContainText("Copy Anchor Link");
  await expect(page.locator("html")).toHaveAttribute("data-toc-navigation", "preserved");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("[data-toc-popover-trigger]").click();
  const mobileToc = page.locator("[data-toc-popover-content]");
  await expect(mobileToc.locator('a[href="#create-the-auth-client"]')).toHaveText(
    "Create the Auth Client",
  );
  await expect(mobileToc).not.toContainText("Copy Anchor Link");
  expect(errors).toEqual([]);
});

test("TOC preserves inline code in authored headings", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/docs/concepts/database", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h3#user code")).toHaveText("user");
  await expect(page.locator('#nd-toc a[href="#user"]')).toHaveText("user");
  await expect(page.locator('#nd-toc a[href="#session"]')).toHaveText("session");
});

test("page metadata follows client navigation and browser history", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const schema = () => page.locator('script[type="application/ld+json"]').textContent();
  await page.goto("/docs", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".fd-page-description")).toHaveText(
    "A comprehensive authentication and authorization framework for TypeScript.",
  );
  await expect.poll(async () => JSON.parse((await schema())!).headline).toBe("Introduction");
  await expect(page.locator(".fd-last-updated-inline")).toContainText("Last updated");
  await page.evaluate(() => {
    document.documentElement.dataset.metadataNavigation = "preserved";
  });
  await page.locator('a[href="/docs/getting-started"]').first().click();
  await expect(page.locator(".fd-page-description")).toHaveText(
    "Build your first authentication flow with Better Auth.",
  );
  await expect.poll(async () => JSON.parse((await schema())!).headline).toBe("Get Started");
  await expect(page.locator("html")).toHaveAttribute("data-metadata-navigation", "preserved");
  await page.goBack();
  await expect.poll(async () => JSON.parse((await schema())!).headline).toBe("Introduction");
  await expect(page.locator(".fd-page-description")).toHaveText(
    "A comprehensive authentication and authorization framework for TypeScript.",
  );
  expect(errors).toEqual([]);
});
