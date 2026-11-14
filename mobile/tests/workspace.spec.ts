import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures/api";

test("catalog keeps results above filters and favorites can be removed directly", async ({
  page,
}) => {
  await mockApi(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("tab", { name: /Catálogo/ }).click();
  await expect(
    page.getByRole("button", { name: "Camisa de lino", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/catalog-320.png",
  });
  await page
    .getByRole("button", { name: "Filtros y orden", exact: true })
    .click();
  await page.getByRole("button", { name: "Apparel", exact: true }).click();
  await page.getByRole("button", { name: "Topwear", exact: true }).click();
  await page.getByRole("button", { name: "Shirts", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver resultados", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Camisa de lino", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar en favoritos", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Mis favoritos", exact: true })
    .click();
  await expect(page.getByText("Camisa de lino", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Quitar de favoritos", exact: true })
    .click();
  await expect(
    page.getByText("Tu colección empieza con un favorito", { exact: true }),
  ).toBeVisible();
});

test("Around searches accented places across countries and preserves regional content", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByRole("tab", { name: /Más/ }).click();
  await page
    .getByRole("button", { name: "Lookeate Around", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buscar provincia o estado", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Provincia, estado o país" })
    .fill("cordoba");
  await page
    .getByRole("button", { name: "Córdoba · Argentina", exact: true })
    .click();
  await expect(
    page.getByText("Estructura cotidiana y calce relajado", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Estados Unidos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buscar provincia o estado", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Provincia, estado o país" })
    .fill("California");
  await page
    .getByRole("button", { name: "California · Estados Unidos", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cerrar", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Frescura costera y básicos con textura", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/around-390.png",
  });
});

test("community search, filters and subscriptions share the same list", async ({
  page,
}) => {
  const writes = await mockApi(page);
  await page.goto("/");
  await page.getByRole("tab", { name: /Más/ }).click();
  await page.getByRole("button", { name: "Comunidad", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar en comunidad" })
    .fill("Córdoba");
  await expect(
    page.getByText("Encuentro de diseño", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Lino para todos los días", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Suscribirme", exact: true }).click();
  await page
    .getByRole("button", { name: "Mis suscripciones", exact: true })
    .click();
  await expect(
    page.getByText("Encuentro de diseño", { exact: true }),
  ).toBeVisible();
  expect(
    writes.some((write) => write.path.endsWith("listing-2/subscribe")),
  ).toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/community-390.png",
  });
});

test("chat preserves recommendation alternatives and saved conversation preferences", async ({
  page,
}) => {
  const writes = await mockApi(page);
  await page.goto("/");
  await page.getByRole("tab", { name: /Assistant/ }).click();
  await page.getByText("Looks de verano", { exact: true }).click();
  await expect(
    page.getByText("Camisa alternativa", { exact: true }),
  ).toBeAttached();
  await page
    .getByRole("button", {
      name: "Preferencias de esta conversación",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Notas temporales" })
    .fill("Tonos neutros para viajar");
  await page
    .getByRole("button", { name: "Guardar para este chat", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Preferencias de esta conversación",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Notas temporales" }),
  ).toHaveValue("Tonos neutros para viajar");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  expect(
    writes.some(
      (write) =>
        write.body?.temporary?.freeform_notes === "Tonos neutros para viajar",
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Look de verano", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Camisa alternativa", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/outfit-390.png",
  });
});

test("collapsed recommendations remain accessible and settings fit a narrow phone", async ({
  page,
}) => {
  await mockApi(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() =>
    localStorage.setItem(
      "lookeate.preferences",
      JSON.stringify({ language: "es", showRecommendations: false }),
    ),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: /Assistant/ }).click();
  await page.getByText("Looks de verano", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Look de verano", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Camisa alternativa", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ver productos recomendados", exact: true })
    .click();
  await expect(
    page.getByText("Camisa alternativa", { exact: true }),
  ).toBeAttached();
  await page.reload();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/settings-320.png",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
});

test("store edits inventory in a separate form and retains all sections", async ({
  page,
}) => {
  const writes = await mockApi(page, "store");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("tab", { name: /Más/ }).click();
  await page.getByRole("button", { name: "Mi tienda", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar producto", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "SKU / ID externo", exact: true })
    .fill("SKU-01");
  await page
    .getByRole("textbox", { name: "Nombre del producto", exact: true })
    .fill("Chaqueta nueva");
  await page.getByRole("textbox", { name: "Precio", exact: true }).fill("150");
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(page.getByText("Chaqueta nueva", { exact: true })).toBeVisible();
  expect(
    writes.find((write) => write.path === "api/store/inventory/items")?.body
      .price,
  ).toBe(150);
  await page.getByRole("button", { name: "Comunidad", exact: true }).click();
  await page
    .getByRole("button", { name: "Crear publicación", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Título", exact: true })
    .fill("Nuestra colección");
  await page
    .getByRole("button", { name: "Guardar publicación", exact: true })
    .click();
  await expect(
    page.getByText("Nuestra colección", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Seguridad", exact: true }).click();
  await expect(
    page.getByText("Autenticación de dos factores", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/store-320.png",
  });
});

test("successful login and logout reset navigation without stale back actions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockApi(page, "anonymous");
  await page.goto("/");
  await page.getByRole("tab", { name: /Más/ }).click();
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("alex@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("test-only-password");
  await page
    .getByRole("button", { name: "Entrar a Lookeate", exact: true })
    .click();
  await expect(page.getByRole("tab", { name: /Inicio/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  await page.getByRole("button", { name: "Cuenta", exact: true }).click();
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.getByRole("tab", { name: /Assistant/ }).click();
  await expect(
    page.getByRole("button", { name: "Ingresar o crear cuenta", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("news filters categories and opens the selected home story", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "La Semana de la Moda de Tokio mira más allá de sus fronteras para SS27",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Pasarelas", exact: true }).click();
  await expect(
    page.getByText("La moda vintage entra en una etapa más exigente", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.screenshot({
    animations: "disabled",
    path: "test-results/news-390.png",
  });
});

test("catalog error retries and an empty search can be cleared", async ({
  page,
}) => {
  await mockApi(page);
  let fail = true;
  await page.route("**/__fixtures__/api/catalog/products?*", async (route) => {
    if (fail) await route.fulfill({ status: 503, body: "{}" });
    else await route.fallback();
  });
  await page.goto("/");
  await page.getByRole("tab", { name: /Catálogo/ }).click();
  await expect(
    page.getByText("No pudimos cargar el catálogo", { exact: true }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Camisa de lino", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Buscar prendas o marcas", exact: true })
    .fill("inexistente");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByText("No encontramos prendas", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Limpiar filtros", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Camisa de lino", exact: true }),
  ).toBeVisible();
});

test("expired session removes the protected chat", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByRole("tab", { name: /Assistant/ }).click();
  await page.route(
    "**/__fixtures__/api/conversations/chat-1/messages",
    (route) => route.fulfill({ status: 401, body: "{}" }),
  );
  await page.getByText("Looks de verano", { exact: true }).click();
  await expect(page.getByRole("tab", { name: /Inicio/ })).toBeVisible();
  await expect(
    page.getByText("Estas prendas van bien juntas.", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /Assistant/ }).click();
  await expect(
    page.getByRole("button", { name: "Ingresar o crear cuenta", exact: true }),
  ).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 740 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
]) {
  test(`main sections fit ${viewport.width}x${viewport.height} in English`, async ({
    page,
  }) => {
    await mockApi(page);
    await page.setViewportSize(viewport);
    await page.addInitScript(() =>
      localStorage.setItem(
        "lookeate.preferences",
        JSON.stringify({ language: "en" }),
      ),
    );
    await page.goto("/");
    for (const section of [/Home/, /Assistant/, /Style/, /Catalog/, /More/]) {
      await page.getByRole("tab", { name: section }).click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
    }
    await page.screenshot({
      animations: "disabled",
      path: `test-results/more-${viewport.width}.png`,
    });
    await page
      .getByRole("button", { name: "Settings", exact: true })
      .first()
      .click();
    await expect(
      page.getByText("Application language", { exact: true }),
    ).toBeVisible();
  });
}
