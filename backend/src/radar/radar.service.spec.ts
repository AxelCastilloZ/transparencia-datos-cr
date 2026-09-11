import { describe, it, expect, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import {
  atipico,
  cubre,
  mediana,
  mesesCompletos,
  montos,
  periodo,
  razon,
  variacion,
} from './radar.math.js';
import {
  construirRadar,
  RadarService,
  type DatosRadar,
} from './radar.service.js';
import type { Compra, Periodo } from './radar.types.js';

const canton = { codigo: '101', nombre: 'San José', provincia: 'San José' };
const p: Periodo = {
  desde: '2026-03-01',
  hasta: '2026-08-31',
  mesesCompletos: 6,
};
function fixture(): DatosRadar {
  const cobertura = {
    desde: p.desde,
    hasta: p.hasta,
    meses: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
    registros: 100,
  };
  return {
    oij: {
      cobertura,
      filas: Array.from({ length: 6 }, (_, i) => ({
        canton: String(101 + i),
        fecha: '2026-07-01',
        delito: 'HURTO',
        total: 30 + i * 10,
      })).concat([
        { canton: '101', fecha: '2026-08-20', delito: 'HURTO', total: 60 },
      ]),
    },
    sicop: {
      cobertura,
      filas: [compra('CRC', 100, 'A'), compra('USD', 200, 'B')],
    },
    tse: {
      filas: Array.from({ length: 6 }, (_, i) => ({
        canton: String(101 + i),
        total: 1000,
        fechaCorte: '2026-08-31',
        sincronizadoEn: '2026-09-01',
      })),
      distritos: [
        { distrito: 'A', total: 500 },
        { distrito: 'B', total: 200 },
        { distrito: 'C', total: 200 },
        { distrito: 'D', total: 100 },
      ],
    },
    pronae: [
      { anio: 2024, modalidad: 'Total', beneficiarios: 100, esTotal: true },
      {
        anio: 2024,
        modalidad: 'Obra comunal',
        beneficiarios: 60,
        esTotal: false,
      },
    ],
  };
}
function compra(
  moneda: string | null,
  monto: number | null,
  proveedor: string | null,
): Compra {
  return {
    canton: '101',
    mes: '2026-08',
    moneda,
    monto,
    proveedor,
    institucion: 'I',
    ordenes: 20,
    validos: monto === null ? 0 : 20,
  };
}
const radar = (d = fixture(), periodo = p) =>
  construirRadar(canton, periodo, '2026-09-11', d);

describe('Metodología radar', () => {
  it('calcula la razón y excluye denominadores inválidos', () => {
    expect(razon(25, 5000)).toBe(5);
    expect(razon(0, 5000)).toBe(0);
    for (const d of [0, -1, null]) expect(razon(25, d)).toBeNull();
    expect(razon(null, 100)).toBeNull();
  });
  it('calcula variación sin infinitos y conserva cero real', () => {
    expect(variacion(60, 30)).toBe(100);
    expect(variacion(0, 30)).toBe(-100);
    expect(variacion(5, 0)).toBeNull();
    expect(variacion(null, 1)).toBeNull();
  });
  it('calcula medianas pares, impares y vacías', () => {
    expect(mediana([9, 1, 5])).toBe(5);
    expect(mediana([100, 1, 2, 3])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
  it('excluye el mes actual y el mes terminal incompleto', () => {
    expect(periodo(undefined, undefined, '2026-09-08', '2026-09-11')).toEqual(
      p,
    );
    expect(
      periodo(undefined, undefined, '2026-08-20', '2026-09-11').hasta,
    ).toBe('2026-07-31');
    expect(periodo(undefined, undefined, '2026-08-31', '2026-09-11')).toEqual(
      p,
    );
    expect(mesesCompletos('2026-07-15', '2026-09-11', '2026-09-11')).toEqual([
      '2026-08',
    ]);
    expect(mesesCompletos('2024-02-01', '2024-02-29', '2024-03-01')).toEqual([
      '2024-02',
    ]);
  });
  it('respeta rangos explícitos y rechaza fechas imposibles, arrays y rangos inversos', () => {
    expect(periodo('2026-07-10', '2026-08-20', null, '2026-09-11')).toEqual({
      desde: '2026-07-10',
      hasta: '2026-08-20',
      mesesCompletos: 0,
    });
    for (const fecha of ['2026-02-30', '2026-2-01', 'no', '', '1800-01-01'])
      expect(() => periodo(fecha, undefined, null, '2026-09-11')).toThrow();
    expect(() =>
      periodo(
        ['2026-01-01'] as unknown as string,
        undefined,
        null,
        '2026-09-11',
      ),
    ).toThrow();
    expect(() =>
      periodo('2026-09-01', '2026-08-01', null, '2026-09-11'),
    ).toThrow();
  });
  it('no conecta meses sin cobertura', () => {
    const d = fixture();
    d.oij!.cobertura.meses = ['2026-03', '2026-08'];
    expect(cubre(d.oij!.cobertura, p)).toBe(false);
    expect(radar(d).seguridad.variacionMensualPorcentaje).toBeNull();
    expect(radar(d).comparacion.medianaIncidentesPorMilElectores).toBeNull();
  });
  it('separa CRC y USD en monto y concentración', () => {
    const result = montos([
      compra('CRC', 80, 'A'),
      compra('CRC', 20, 'B'),
      compra('USD', 900, 'B'),
    ]);
    expect(result[0]).toMatchObject({
      moneda: 'CRC',
      monto: 100,
      principal: 80,
      topCinco: 100,
    });
    expect(result[1]).toMatchObject({
      moneda: 'USD',
      monto: 900,
      principal: 100,
    });
  });
  it('no inventa montos ni concentra sobre identidades desconocidas', () => {
    expect(montos([compra('CRC', null, 'A')])[0]).toMatchObject({
      monto: null,
      principal: null,
    });
    expect(montos([compra('CRC', 100, null)])[0].principal).toBeNull();
    expect(montos([compra(null, 100, 'A')])).toEqual([]);
    expect(
      montos([compra('CRC', 100, 'A'), compra('CRC', null, 'B')])[0].principal,
    ).toBeNull();
  });
  it('exige historia y dispersión suficientes para el criterio robusto', () => {
    expect(atipico(100, [9, 10, 11, 12, 13, 14])).toBe(true);
    expect(atipico(15, [9, 10, 11, 12, 13, 14])).toBe(false);
    expect(atipico(100, [9, 10])).toBe(false);
    expect(atipico(100, [10, 10, 10, 10, 10, 10])).toBe(false);
  });
});
describe('Ficha integrada', () => {
  it('genera cambio atípico solo con siete meses completos y cobertura suficiente', () => {
    const d = fixture();
    const meses = [
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
    ];
    d.sicop!.cobertura = {
      desde: '2026-02-01',
      hasta: '2026-08-31',
      meses,
      registros: 169,
    };
    d.sicop!.filas = [9, 10, 11, 12, 13, 14, 100].map((ordenes, i) => ({
      ...compra('CRC', ordenes * 10, 'A'),
      mes: meses[i],
      ordenes,
      validos: ordenes,
    }));
    const amplio = {
      desde: '2026-02-01',
      hasta: '2026-08-31',
      mesesCompletos: 7,
    };
    expect(
      radar(d, amplio).senales.some((s) => s.codigo === 'cambio-ordenes'),
    ).toBe(true);
    expect(radar(d).senales.some((s) => s.codigo === 'cambio-ordenes')).toBe(
      false,
    );
    d.sicop!.cobertura.meses = meses.filter((m) => m !== '2026-04');
    expect(
      radar(d, amplio).senales.some((s) => s.codigo === 'cambio-ordenes'),
    ).toBe(false);
  });
  it('el top cinco no activa señal automáticamente con cinco o menos proveedores', () => {
    const d = fixture();
    d.sicop!.filas = ['A', 'B', 'C', 'D', 'E'].map((proveedor) =>
      compra('CRC', 20, proveedor),
    );
    expect(radar(d).senales.some((s) => s.codigo === 'concentracion-CRC')).toBe(
      false,
    );
    d.sicop!.filas.push(compra('CRC', 1, 'F'));
    expect(radar(d).senales.some((s) => s.codigo === 'concentracion-CRC')).toBe(
      true,
    );
  });
  it('combina fuentes y señales con evidencia sin incluir PRONAE en ellas', () => {
    const r = radar();
    expect(r.seguridad.incidentesPorMilElectores).toBe(90);
    expect(r.senales.map((s) => s.codigo)).toEqual(
      expect.arrayContaining([
        'incremento-incidentes',
        'concentracion-CRC',
        'concentracion-electoral',
      ]),
    );
    expect(r.contextoNacional.pronae).toMatchObject({
      totalBeneficiarios: 100,
      modalidadPrincipal: 'Obra comunal',
    });
    for (const s of r.senales) {
      expect(s.metodologia).toBeTruthy();
      expect(s.preguntaSugerida).toBeTruthy();
      expect(s.fuentes).not.toContain('PRONAE');
    }
    expect(r.metadatos.fuentes).toHaveLength(4);
    expect(JSON.stringify(r)).not.toContain('proveedorCedula');
  });
  it('no alerta por pasar de uno a dos registros', () => {
    const d = fixture();
    d.oij!.filas = [
      { canton: '101', fecha: '2026-07-01', delito: 'X', total: 1 },
      { canton: '101', fecha: '2026-08-01', delito: 'X', total: 2 },
    ];
    expect(
      radar(d).senales.some((s) => s.codigo === 'incremento-incidentes'),
    ).toBe(false);
  });
  it('explica mes anterior cero y menos de dos meses', () => {
    const d = fixture();
    d.oij!.filas = d.oij!.filas.filter((r) => r.fecha.startsWith('2026-08'));
    expect(radar(d).seguridad).toMatchObject({
      mesAnterior: 0,
      variacionMensualPorcentaje: null,
    });
    expect(radar(d).seguridad.explicacionVariacion).toContain('cero');
    expect(
      radar(d, { desde: '2026-08-01', hasta: '2026-08-31', mesesCompletos: 1 })
        .seguridad.variacionMensualPorcentaje,
    ).toBeNull();
  });
  it('no muestra mediana con menos de cinco denominadores válidos', () => {
    const d = fixture();
    d.tse!.filas[0].total = 0;
    d.tse!.filas[1].total = 0;
    const r = radar(d);
    expect(r.seguridad.incidentesPorMilElectores).toBeNull();
    expect(r.comparacion.cantonesComparables).toBe(4);
    expect(r.comparacion.medianaIncidentesPorMilElectores).toBeNull();
  });
  it('excluye cantones sin OIJ, no los convierte en cero', () => {
    const d = fixture();
    d.oij!.filas = d.oij!.filas.filter((r) => r.canton !== '101');
    expect(radar(d).seguridad.incidentes).toBeNull();
    expect(radar(d).comparacion.cantonesComparables).toBe(5);
  });
  it('distingue fuentes vacías de errores y no fabrica ceros', () => {
    const d: DatosRadar = {
      oij: null,
      sicop: null,
      tse: { filas: [], distritos: [] },
      pronae: [],
    };
    const r = radar(d);
    expect(r.seguridad.incidentes).toBeNull();
    expect(r.electorado.electores).toBeNull();
    expect(r.contratacion.ordenes).toBeNull();
    expect(r.contextoNacional.pronae.anioMasReciente).toBeNull();
    expect(r.metadatos.fuentes.map((f) => f.estado)).toEqual([
      'error',
      'error',
      'sin-datos',
      'sin-datos',
    ]);
  });
  it('sirve caché histórica y señala coberturas diferentes', () => {
    const d = fixture();
    d.sicop!.cobertura = { ...d.sicop!.cobertura, hasta: '2026-04-30' };
    expect(radar(d).seguridad.incidentes).toBe(90);
    expect(radar(d).contratacion.coberturaSuficiente).toBe(false);
    expect(radar(d).senales.some((s) => s.codigo === 'cobertura-sicop')).toBe(
      true,
    );
  });
  it('cero órdenes identificadas no equivale a cero contratación', () => {
    const d = fixture();
    d.sicop!.filas.forEach((r) => {
      r.canton = null;
    });
    const r = radar(d);
    expect(r.contratacion.ordenes).toBe(0);
    expect(r.contratacion.coberturaGeografica).toBe(0);
    expect(r.comparacion.medianasSicopPorMoneda).toEqual([]);
    expect(
      r.senales.find((s) => s.codigo === 'cobertura-sicop')?.descripcion,
    ).toContain('ausencia');
  });
  it('calcula medianas SICOP por moneda sin mezclar montos', () => {
    const d = fixture();
    d.sicop!.filas = Array.from({ length: 5 }, (_, i) => ({
      ...compra('CRC', (i + 1) * 100, 'P'),
      canton: String(101 + i),
    })).concat(
      Array.from({ length: 5 }, (_, i) => ({
        ...compra('USD', (i + 1) * 10, 'P'),
        canton: String(101 + i),
      })),
    );
    expect(radar(d).comparacion.medianasSicopPorMoneda).toEqual([
      { moneda: 'CRC', mediana: 300, cantones: 5 },
      { moneda: 'USD', mediana: 30, cantones: 5 },
    ]);
  });
});
describe('Servicio de lectura y validación', () => {
  it('valida antes de consultar y devuelve 404 para cantón inexistente', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const service = new RadarService({ query } as unknown as DataSource);
    await expect(service.canton('abc')).rejects.toMatchObject({ status: 400 });
    await expect(service.canton('101', '2026-02-30')).rejects.toMatchObject({
      status: 400,
    });
    expect(query).not.toHaveBeenCalled();
    await expect(service.canton('199')).rejects.toMatchObject({ status: 404 });
  });
  it('consulta solo tablas locales y permite fallo parcial', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM cantones')) return [canton];
      if (
        sql.includes('estadisticas_policiales') ||
        sql.includes('sicop_ordenes_pedido')
      )
        throw new Error('detalle privado de conexión');
      return [];
    });
    const r = await new RadarService({ query } as unknown as DataSource).canton(
      '101',
      p.desde,
      p.hasta,
    );
    expect(r.canton.codigo).toBe('101');
    expect(r.metadatos.fuentes[0].estado).toBe('error');
    expect(JSON.stringify(r)).not.toContain('detalle privado');
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true,
    );
  });
});
