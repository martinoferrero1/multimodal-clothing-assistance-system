import { test, expect } from "@playwright/test";

// Browser checks cover native-component layout and local state only.
// SecureStore, native gestures, camera and authenticated API flows need a device.
test("home fits a narrow phone and keeps all five navigation destinations accessible", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.getByText("Imaginalo.", { exact: false })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(5);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "test-results/home-320.png" });
  expect(errors).toEqual([]);
});
test("style builder layers a garment, removes it, and resets rotation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Crear estilo/ }).click();
  await expect(
    page.getByText("Creá tu estilo.", { exact: true }),
  ).toBeVisible();
  await page.getByText("Turtle Check Shirt", { exact: true }).click();
  await expect(
    page.getByText("Turtle Check Shirt", { exact: true }),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "×", exact: true }).click();
  await expect(
    page.getByText("Turtle Check Shirt", { exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "↷", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "15");
  await page.getByRole("button", { name: "Centrar", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuenow", "0");
});
test("language selection persists and updates navigation", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByText("Application language", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: /Home/ })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeVisible();
});
test("registration form validates required inputs without sending credentials", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Más/ }).click();
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Crear mi cuenta", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Nombre", exact: true })
    .fill("Example");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("example@example.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("example-password");
  await expect(
    page.getByRole("button", { name: "Crear mi cuenta", exact: true }),
  ).toBeEnabled();
});
