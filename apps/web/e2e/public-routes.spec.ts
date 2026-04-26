import { expect, test } from "@playwright/test";

test.describe("public routing", () => {
  test("renders public routes and redirects protected routes", async ({
    page,
  }) => {
    for (const route of ["/", "/explore", "/leaderboard", "/launch", "/docs"]) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
    }

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/signin\?next=%2Fdashboard$/);
  });
});
