import { expect, test } from "@playwright/test";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const e2eDataFile = resolve(process.cwd(), "data", "e2e-recallia.json");

test.beforeEach(async () => {
  await mkdir(resolve(process.cwd(), "data"), { recursive: true });
  await rm(e2eDataFile, { force: true });
});

test.afterEach(async () => {
  await rm(e2eDataFile, { force: true });
});

test("full Loom path persists the accepted AI suggestion", async ({ page }) => {
  await page.goto("/login");

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/timeline$/);

  await expect(page.getByRole("heading", { name: "Memory timeline" })).toBeVisible();
  await expect(page.locator(".timeline-rail")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Owned beige VW Golf 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lived in Frankfurt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attended evening school" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Owned red Opel Corsa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Worked at logistics warehouse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lived in Zurich" })).toBeVisible();

  const sidebar = page.locator(".timeline-side");
  await expect(sidebar.getByRole("button", { name: "Add Memory" })).toBeVisible();
  await expect(sidebar.getByRole("heading", { name: "Capture the uncertain Frank memory" })).toBeHidden();
  await expect(sidebar.getByRole("heading", { name: "Suggestion" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Met Frank in Frankfurt" })).toBeHidden();

  await sidebar.getByRole("button", { name: "Add Memory" }).click();
  await expect(sidebar.getByRole("heading", { name: "Capture the uncertain Frank memory" })).toBeVisible();
  await expect(sidebar.locator('input[name="title"]')).toHaveValue("Met Frank in Frankfurt");
  await expect(sidebar.getByRole("heading", { name: "Suggestion" })).toBeHidden();

  await page.getByRole("button", { name: "Ask Recallia AI" }).click();
  await expect(page).toHaveURL(/\/timeline\?run=ai-run-/);

  const suggestionPanel = page.locator(".ai-panel");
  const suggestedRange = suggestionPanel
    .locator(".suggestion-list div")
    .filter({ hasText: "Suggested range" })
    .locator("dd");
  const suggestedLinks = suggestionPanel
    .locator(".suggestion-list div")
    .filter({ hasText: "Suggested links" })
    .locator("dd");
  await expect(suggestionPanel.getByRole("heading", { name: "Suggestion" })).toBeVisible();
  await expect(suggestedRange).toHaveText("1995-1999");
  await expect(suggestedLinks).toHaveText("Lived in Frankfurt, Owned beige VW Golf 1");
  await expect(page.getByText("AI memory")).toBeVisible();
  await expect(page.getByText("AI link")).toHaveCount(2);

  await suggestionPanel
    .locator("label")
    .filter({ hasText: "Attended evening school" })
    .locator("input")
    .check();
  await suggestionPanel
    .locator("label")
    .filter({ hasText: "Worked at logistics warehouse" })
    .locator("input")
    .check();
  await suggestionPanel.getByRole("button", { name: "Refine suggestion" }).click();

  await expect(suggestedRange).toHaveText("1997-1998");
  await expect(suggestedLinks).toHaveText(
    "Lived in Frankfurt, Owned beige VW Golf 1, Attended evening school, Worked at logistics warehouse"
  );
  await expect(page.getByText("AI link")).toHaveCount(4);

  const trace = page.locator("details.ai-trace");
  await expect(trace).toBeVisible();
  await expect(trace).not.toHaveAttribute("open", "");

  await page.getByRole("button", { name: "Accept suggestions" }).click();
  await expect(page).toHaveURL(/\/timeline$/);
  await expect(sidebar.getByRole("button", { name: "Add Memory" })).toBeVisible();
  await expect(sidebar.getByRole("heading", { name: "Suggestion" })).toBeHidden();
  await expect(page.getByText("Accepted range")).toBeHidden();
  await expect(page.getByText("AI memory")).toBeHidden();
  await expect(page.getByText("AI link")).toBeHidden();

  await page.reload();

  await expect(page.getByRole("heading", { name: "Met Frank in Frankfurt" })).toBeVisible();
  await expect(page.getByText("Accepted range")).toBeHidden();
  await expect(sidebar.getByRole("button", { name: "Add Memory" })).toBeVisible();
  await expect(page.locator(".ai-panel")).toBeHidden();
});
