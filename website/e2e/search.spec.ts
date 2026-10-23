import { expect, test, type Page, type Route } from "playwright/test";

const results = (label: string) => [
  { id: label, content: label, type: "page", url: "/docs/configuration" },
];

async function openSearch(page: Page) {
  await page.goto("/");
  await expect(page.locator("#root")).toHaveAttribute("data-farm-island-hydrated", "true");
  const input = page.getByRole("combobox");
  // Farm marks hydration before React's passive effects attach the global trigger.
  await expect(async () => {
    await page
      .getByRole("button", { name: /search/i })
      .first()
      .click();
    await expect(input).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
  return input;
}

test("shows only loading until the current request finishes, on desktop and mobile", async ({
  page,
}, testInfo) => {
  let respond!: (route: Route) => void;
  const requested = new Promise<Route>((resolve) => {
    respond = resolve;
  });
  await page.route("**/api/docs?query=*", respond);
  const input = await openSearch(page);
  await input.fill("inte");
  const route = await requested;
  await expect(page.getByRole("listbox").getByRole("status")).toHaveText("Fetching results…");
  await expect(page.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText(/No (results|matches)/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("search-loading-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toBeVisible();
  await expect(page.getByText(/No (results|matches)/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("search-loading-mobile.png") });
  await route.fulfill({ json: results("Internationalization") });
  await expect(page.getByRole("option")).toContainText("Internationalization");
  await expect(page.getByRole("listbox").getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("listbox")).toHaveAttribute("aria-busy", "false");
});

test("an obsolete request cannot finish the newer query's loading state", async ({ page }) => {
  const pending = new Map<string, Route>();
  await page.route("**/api/docs?query=*", (route) => {
    pending.set(new URL(route.request().url()).searchParams.get("query")!, route);
  });
  const input = await openSearch(page);
  await input.fill("first");
  await expect.poll(() => pending.has("first")).toBe(true);
  await input.fill("second");
  await expect.poll(() => pending.has("second")).toBe(true);
  await pending
    .get("first")!
    .fulfill({ json: results("Obsolete result") })
    .catch(() => {});
  await expect(page.getByRole("listbox").getByRole("status")).toBeVisible();
  await expect(page.getByText("Obsolete result")).toHaveCount(0);
  await expect(page.getByText(/No (results|matches)/)).toHaveCount(0);
  await pending.get("second")!.fulfill({ json: results("Current result") });
  await expect(page.getByRole("option")).toContainText("Current result");
});

test("shows an actionable error and retries instead of claiming there are no matches", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/docs?query=*", (route) => {
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.fulfill({ json: results("Recovered result") });
  });
  const input = await openSearch(page);
  await input.fill("inte");
  await expect(page.getByRole("alert")).toContainText("Could not search Documentation");
  await expect(page.getByText(/No (results|matches)/)).toHaveCount(0);
  await page.getByRole("button", { name: "Retry search" }).click();
  await expect(page.getByRole("option")).toContainText("Recovered result");
  expect(attempts).toBe(2);
});

test("shows a single empty state only after a successful empty response", async ({ page }) => {
  await page.route("**/api/docs?query=*", (route) => route.fulfill({ json: [] }));
  const input = await openSearch(page);
  await input.fill("no-such-page");
  await expect(page.getByText("No results found. Try a different query.")).toHaveCount(1);
  await expect(page.getByText(/No matches/)).toHaveCount(0);
  await expect(page.getByRole("listbox").getByRole("status")).toHaveCount(0);
});

test("reuses recent successful queries without another network request", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/docs?query=*", (route) => {
    const query = new URL(route.request().url()).searchParams.get("query")!;
    requests.push(query);
    return route.fulfill({ json: results(query) });
  });
  const input = await openSearch(page);
  await input.fill("installation");
  await expect(page.getByRole("option")).toContainText("installation");
  await input.fill("configuration");
  await expect(page.getByRole("option")).toContainText("configuration");
  await input.fill("installation");
  await expect(page.getByRole("option")).toContainText("installation");
  await expect(page.getByRole("listbox").getByRole("status")).toHaveCount(0);
  await input.press("Escape");
  await expect(input).not.toBeVisible();
  expect(requests).toEqual(["installation", "configuration"]);
});

test("real docs search returns matches that can be selected with the keyboard", async ({
  page,
}) => {
  const input = await openSearch(page);
  await input.fill("inte");
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("listbox").getByRole("status")).toHaveCount(0);
  await input.press("ArrowDown");
  const destination = await page
    .getByRole("option", { selected: true })
    .locator("a")
    .getAttribute("href");
  expect(destination).toBeTruthy();
  await input.press("Enter");
  await expect(page).toHaveURL(new URL(destination!, page.url()).href, { timeout: 20_000 });
});
