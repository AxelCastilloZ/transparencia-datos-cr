import { test, expect, type Page } from '@playwright/test';
import { ficha, MONTO_CRC, MONTO_USD } from './ficha-radar';

/**
 * Flujos E2E de SICOP, TSE y recuperación ante errores.
 *
 * La API se simula con page.route(), así que estos tests no necesitan backend
 * ni base de datos y corren igual en CI. Verifican el comportamiento del
 * frontend; no prueban la integración real con la base.
 */

test.describe.configure({ timeout: 60_000 });

type Respuesta = { status: number; json: unknown };
type Manejador = (url: URL) => Respuesta;

const ok = (json: unknown): Manejador => () => ({ status: 200, json });
const falla: Manejador = () => ({
  status: 503,
  json: { message: 'Servicio no disponible' },
});

/**
 * API caída hasta llamar a restablecer(). No se cuentan llamadas porque
 * StrictMode duplica las peticiones al montar un componente en desarrollo.
 */
function apiCaida(json: unknown) {
  let disponible = false;
  const manejador: Manejador = (url) => (disponible ? { status: 200, json } : falla(url));
  return { manejador, restablecer: () => { disponible = true; } };
}

const proveedores = [
  { proveedor: 'Constructora Alfa', total: 600, ordenes: 12 },
  { proveedor: 'Suministros Beta', total: 300, ordenes: 8 },
];

const rutasBase: Record<string, Manejador> = {
  '/cantones': ok([{ codigo: '101', nombre: 'San José', provincia: 'San José' }]),
  '/radar/canton/101': ok(ficha),
  '/sicop/proveedores': ok(proveedores),
  '/sicop/instituciones': ok([{ institucion: 'Municipalidad de San José', total: 900, ordenes: 20 }]),
  '/sicop/mensual': ok([
    { mes: '2026-07', monto: 300, ordenes: 7 },
    { mes: '2026-08', monto: 600, ordenes: 13 },
  ]),
  '/tse/canton/101': ok({
    fuente: 'TSE',
    fechaCorte: '2026-08-31',
    cantonCodigo: '101',
    total: 850,
    totalNacional: 68000,
    porcentajeNacional: 1.25,
    alcance: 'Electores inscritos en el cantón',
  }),
  '/tse/canton/101/distritos': ok([
    { fechaCorte: '2026-08-31', cantonCodigo: '101', distritoCodigo: '10101', distrito: 'Carmen', total: 500 },
    { fechaCorte: '2026-08-31', cantonCodigo: '101', distritoCodigo: '10102', distrito: 'Merced', total: 350 },
  ]),
  '/tse/canton/101/historico': ok([
    { fechaCorte: '2026-08-31', cantonCodigo: '101', total: 850 },
  ]),
};

/** Cualquier ruta sin simular responde 503: ningún test llega al backend real. */
async function simularApi(page: Page, cambios: Record<string, Manejador> = {}) {
  const rutas = { ...rutasBase, ...cambios };
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const manejador = rutas[url.pathname.replace(/^\/api/, '')] ?? falla;
    return route.fulfill(manejador(url));
  });
}

async function seleccionarCanton(page: Page) {
  await page.goto('/');
  const selector = page.getByRole('combobox', { name: 'Cantón' });
  // La primera carga es lenta: Vite compila la página al arrancar en frío.
  await expect(selector).toBeEnabled({ timeout: 45_000 });
  await selector.selectOption('101');
}

async function abrirFicha(page: Page) {
  await seleccionarCanton(page);
  await expect(page.getByRole('heading', { name: 'San José · San José' })).toBeVisible();
}

async function abrirDetalle(page: Page, titulo: string) {
  const detalle = page.locator('details').filter({ hasText: titulo });
  await detalle.locator('summary').first().click();
  return detalle;
}

const DETALLE_SICOP = 'Contratación · detalle SICOP en CRC';
const DETALLE_TSE = 'Electorado · detalle TSE';

test.describe('Radar — recuperación ante errores', () => {
  test('muestra el error y se recupera al reintentar', async ({ page }) => {
    const radar = apiCaida(ficha);
    await simularApi(page, { '/radar/canton/101': radar.manejador });
    await seleccionarCanton(page);

    const alerta = page.getByRole('alert').filter({ hasText: 'No se pudo cargar el radar' });
    await expect(alerta).toBeVisible();

    radar.restablecer();
    await alerta.getByRole('button', { name: 'Reintentar' }).click();

    await expect(alerta).toBeHidden();
    await expect(page.getByRole('heading', { name: 'San José · San José' })).toBeVisible();
  });
});

test.describe('SICOP — contratación pública', () => {
  test('el radar separa los montos por moneda y nunca los suma', async ({ page }) => {
    await simularApi(page);
    await abrirFicha(page);

    const tarjeta = page
      .getByRole('heading', { name: 'Montos observados por moneda' })
      .locator('..');
    await expect(tarjeta).toContainText(`CRC ${MONTO_CRC} · USD ${MONTO_USD}`);
    await expect(tarjeta).not.toContainText(new RegExp(String(MONTO_CRC + MONTO_USD)));

    const tabla = page.getByRole('table', { name: /Participación del monto/ });
    await expect(tabla.locator('tbody tr')).toHaveCount(2);
    await expect(tabla.getByRole('row', { name: /^CRC/ })).toContainText(String(MONTO_CRC));
    await expect(tabla.getByRole('row', { name: /^USD/ })).toContainText(String(MONTO_USD));
  });

  test('el detalle pide los datos del cantón y período seleccionados', async ({ page }) => {
    const consultas: URL[] = [];
    await simularApi(page, {
      '/sicop/proveedores': (url) => {
        consultas.push(url);
        return { status: 200, json: proveedores };
      },
    });
    await abrirFicha(page);
    const detalle = await abrirDetalle(page, DETALLE_SICOP);

    await expect(detalle.getByRole('cell', { name: 'Constructora Alfa' })).toBeVisible();
    await expect(detalle.getByRole('cell', { name: 'Municipalidad de San José' })).toBeVisible();
    await expect(
      detalle.getByText('Órdenes del cantón en CRC con monto').locator('..'),
    ).toContainText('20');

    const parametros = consultas[0].searchParams;
    expect(parametros.get('canton')).toBe('101');
    expect(parametros.get('desde')).toBe('2026-03-01');
    expect(parametros.get('hasta')).toBe('2026-08-31');
  });

  test('el buscador filtra los proveedores', async ({ page }) => {
    await simularApi(page, {
      '/sicop/proveedores': (url) => {
        const q = url.searchParams.get('q')?.toLowerCase();
        return {
          status: 200,
          json: q ? proveedores.filter((p) => p.proveedor.toLowerCase().includes(q)) : proveedores,
        };
      },
    });
    await abrirFicha(page);
    const detalle = await abrirDetalle(page, DETALLE_SICOP);
    await expect(detalle.getByRole('cell', { name: 'Suministros Beta' })).toBeVisible();

    await detalle.getByRole('textbox', { name: 'Buscar proveedor' }).fill('alfa');
    await detalle.getByRole('button', { name: 'Buscar', exact: true }).click();

    await expect(detalle.getByRole('cell', { name: 'Suministros Beta' })).toHaveCount(0);
    await expect(detalle.getByRole('cell', { name: 'Constructora Alfa' })).toBeVisible();
  });

  test('una búsqueda con HTML malicioso se muestra como texto (XSS)', async ({ page }) => {
    const carga = '<img src=x onerror="window.__xss=1">';
    await simularApi(page, {
      '/sicop/proveedores': (url) => ({
        status: 200,
        json: url.searchParams.get('q') ? [] : proveedores,
      }),
    });
    await abrirFicha(page);
    const detalle = await abrirDetalle(page, DETALLE_SICOP);

    await detalle.getByRole('textbox', { name: 'Buscar proveedor' }).fill(carga);
    await detalle.getByRole('button', { name: 'Buscar', exact: true }).click();

    await expect(detalle.getByText(`Sin resultados para “${carga}”`)).toBeVisible();
    await expect(detalle.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => '__xss' in window)).toBe(false);
  });

  test('avisa cuando la API de SICOP falla', async ({ page }) => {
    await simularApi(page, { '/sicop/mensual': falla });
    await abrirFicha(page);
    const detalle = await abrirDetalle(page, DETALLE_SICOP);

    await expect(detalle.getByText('No se pudieron cargar los datos de SICOP.')).toBeVisible();
  });
});

test.describe('TSE — padrón electoral', () => {
  test('muestra conteos agregados y aclara qué mide el padrón', async ({ page }) => {
    await simularApi(page);
    await abrirFicha(page);
    const detalle = await abrirDetalle(page, DETALLE_TSE);

    await expect(detalle.getByText('Electores inscritos en el cantón').first()).toBeVisible();
    await expect(detalle.getByText('850', { exact: true })).toBeVisible();
    await expect(detalle.getByText('1.25%')).toBeVisible();
    await expect(detalle.getByRole('cell', { name: 'Carmen' })).toBeVisible();
    await expect(detalle.getByRole('cell', { name: 'Merced' })).toBeVisible();
    await expect(detalle.getByText(/no equivale a\s+participación/)).toBeVisible();
    await expect(detalle.getByText(/al menos\s+dos snapshots/)).toBeVisible();
  });

  test('se recupera al reintentar después de un error', async ({ page }) => {
    const resumen = rutasBase['/tse/canton/101'](new URL('http://x')).json;
    const tse = apiCaida(resumen);
    await simularApi(page, { '/tse/canton/101': tse.manejador });
    await abrirFicha(page);
    const detalle = await abrirDetalle(page, DETALLE_TSE);

    const alerta = detalle.getByRole('alert').filter({ hasText: 'No se pudieron cargar los datos del TSE.' });
    await expect(alerta).toBeVisible();

    tse.restablecer();
    await alerta.getByRole('button', { name: 'Reintentar' }).click();

    await expect(alerta).toBeHidden();
    await expect(detalle.getByRole('cell', { name: 'Carmen' })).toBeVisible();
  });
});
