import { test, expect } from "@playwright/test";
test("landing walkthrough and mobile layout", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Find the conversations/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Run example scan/ }).click();
  await expect(page.getByText("Match detected", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("unauthenticated workspace is protected", async ({ page }) => {
  await page.goto("/overview");
  await expect(page).toHaveURL(/\/login/);
});
test("configured account can create, scan, inspect, pause and resume a radar", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Requires a confirmed test account in an isolated mock environment.",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/overview/);
  await page.goto("/radars/new");
  await page.getByLabel("Radar name").fill("E2E monitoring");
  await page.getByLabel("X search query").fill("deployment -is:retweet");
  await page.getByRole("button", { name: "Activate radar" }).click();
  await expect(
    page.getByRole("heading", { name: "E2E monitoring" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View matches" }).last().click();
  await expect(
    page.getByText("Looking for a better way", { exact: false }),
  ).toBeVisible({ timeout: 30000 });
  await page.goto("/radars");
  await page.getByRole("button", { name: "Pause", exact: true }).last().click();
  await expect(page.getByText("Paused", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Resume", exact: true })
    .last()
    .click();
});
