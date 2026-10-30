import { test, expect } from '@playwright/test';

test.describe('Radar Cantonal — Flujo principal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('muestra el título y el selector de cantón', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Radar cantonal de señales públicas' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Cantón' })).toBeVisible();
  });

  test('muestra mensaje de selección cuando no hay cantón', async ({ page }) => {
    await expect(
      page.getByText('Seleccioná un cantón para reunir su ficha integrada.'),
    ).toBeVisible();
  });

  test('carga ficha al seleccionar un cantón', async ({ page }) => {
    const select = page.getByRole('combobox', { name: 'Cantón' });
    await select.waitFor({ state: 'visible' });

    // Esperar a que se carguen los cantones
    await expect(select).toBeEnabled();
    await select.selectOption({ index: 1 });

    // Debe mostrar el indicador de carga o la ficha
    await expect(
      page.getByText('Cargando ficha del cantón…').or(
        page.locator('[aria-labelledby="dimensiones"]'),
      ),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('sección de contexto nacional siempre visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', {
        name: 'Contexto nacional de empleo y apoyo social',
      }),
    ).toBeVisible();
  });

  test('filtros de fecha funcionan', async ({ page }) => {
    const desde = page.getByLabel('Desde');
    const hasta = page.getByLabel('Hasta');
    await expect(desde).toBeVisible();
    await expect(hasta).toBeVisible();

    await desde.fill('2025-01-01');
    await hasta.fill('2025-06-30');
    await expect(desde).toHaveValue('2025-01-01');
    await expect(hasta).toHaveValue('2025-06-30');
  });
});
