import { test, expect } from "@playwright/test";

// Smoke test: verifies a fresh deploy serves the app shell.
// Extend with user journeys; target elements via data-testid, not CSS classes.
test("home page renders the app shell", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("h1")).toBeVisible();
});
