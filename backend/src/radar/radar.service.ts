import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  atipico,
  cubre,
  finMes,
  mediana,
  mesesCompletos,
  montos,
  periodo,
  razon,
  REGLAS,
  validarFecha,
  variacion,
} from './radar.math.js';
import type {
  Cobertura,
  Compra,
  Distrito,
  Electores,
  Fuente,
  Incidentes,
  Periodo,
  Pronae,
  Radar,
  Senal,
} from './radar.types.js';

export const LIMITACIONES = {
  OIJ: 'OIJ contiene incidentes registrados, no todos los delitos ocurridos.',
  TSE: 'TSE representa electores inscritos, no población total, votos ni participación. Los distritos electorales no siempre equivalen a distritos administrativos.',
  SICOP:
    'SICOP usa la sede de la institución compradora y tiene geolocalización parcial; no identifica necesariamente el lugar de entrega. Hasta 24 h de desfase; el reporte de proveedores puede excluir registros de los últimos siete días.',
  PRONAE:
    'PRONAE es nacional y corresponde a 2021–2024; no está desagregado por cantón.',
};
const PROXY =
  'Cobertura temporal aproximada por fechas mínima/máxima y presencia nacional en cada mes. Las tablas no certifican ingestas completas; ausencia cantonal no prueba cero hechos.';
const URLS = [
  'https://datosabiertospj.poder-judicial.go.cr/dataset/estadisticas-policiales',
  'https://www.sicop.go.cr/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp',
  'https://www.tse.go.cr/descarga_padron.html',
  'https://datosabiertos.gob.go.cr/dataset/mtss-personas-beneficiarias-pronae-2021-2024',
];
export interface DatosRadar {
  oij: { cobertura: Cobertura; filas: Incidentes[] } | null;
  sicop: { cobertura: Cobertura; filas: Compra[] } | null;
  tse: { filas: Electores[]; distritos: Distrito[] } | null;
  pronae: Pronae[] | null;
}
const sum = <T>(rows: T[], f: (r: T) => number) =>
  rows.reduce((s, r) => s + f(r), 0);
const total = (rows: Incidentes[]) => sum(rows, (r) => r.total);

@Injectable()
export class RadarService {
  constructor(private readonly db: DataSource) {}

  async canton(codigo: string, desde?: string, hasta?: string): Promise<Radar> {
    if (!/^[1-7]\d{2}$/.test(codigo))
      throw new BadRequestException('Código de cantón inválido.');
    validarFecha(desde);
    validarFecha(hasta);
    if (desde && hasta && desde > hasta)
      throw new BadRequestException('desde debe ser anterior o igual a hasta.');
    const [canton] = await this.db.query<Radar['canton'][]>(
      'SELECT codigo, nombre, provincia FROM cantones WHERE codigo = $1',
      [codigo],
    );
    if (!canton) throw new NotFoundException('Cantón inexistente.');
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const coberturas = await Promise.allSettled([
      this.cobertura('estadisticas_policiales', 'fecha'),
      this.cobertura('sicop_ordenes_pedido', 'fecha_elaboracion'),
    ]);
    const oc =
      coberturas[0].status === 'fulfilled' ? coberturas[0].value : null;
    const sc =
      coberturas[1].status === 'fulfilled' ? coberturas[1].value : null;
    const p = periodo(desde, hasta, oc?.hasta ?? sc?.hasta ?? null, hoy);
    const resultados = await Promise.allSettled([
      oc
        ? this.db.query<Incidentes[]>(
            `SELECT canton_codigo AS canton, fecha::text, delito, COUNT(*)::int AS total
        FROM estadisticas_policiales WHERE fecha BETWEEN $1 AND $2 GROUP BY canton_codigo, fecha, delito`,
            [p.desde, p.hasta],
          )
        : Promise.reject(new Error('OIJ no disponible')),
      sc
        ? this.db.query<Compra[]>(
            `SELECT canton_codigo AS canton, TO_CHAR(fecha_elaboracion, 'YYYY-MM') AS mes,
        NULLIF(UPPER(TRIM(moneda)), '') AS moneda,
        COALESCE(NULLIF(proveedor_cedula, ''), NULLIF(proveedor, '')) AS proveedor,
        COALESCE(NULLIF(institucion_cedula, ''), NULLIF(institucion, '')) AS institucion,
        COUNT(*)::int AS ordenes,
        SUM(monto_orden) FILTER (WHERE monto_orden >= 0)::float AS monto,
        COUNT(*) FILTER (WHERE monto_orden >= 0)::int AS validos
        FROM sicop_ordenes_pedido WHERE fecha_elaboracion BETWEEN $1 AND $2
        GROUP BY 1, 2, 3, 4, 5`,
            [p.desde, p.hasta],
          )
        : Promise.reject(new Error('SICOP no disponible')),
      this.db.query<
        Electores[]
      >(`SELECT "cantonCodigo" AS canton, total, "fechaCorte"::text, "sincronizadoEn"::text
        FROM tse_padron_cantonal WHERE "fechaCorte" = (SELECT MAX("fechaCorte") FROM tse_padron_cantonal)`),
      this.db.query<Pronae[]>(
        'SELECT anio, modalidad, beneficiarios, es_total AS "esTotal" FROM pronae_beneficiarios ORDER BY anio',
      ),
    ]);
    const oij =
      resultados[0].status === 'fulfilled'
        ? { cobertura: oc!, filas: resultados[0].value }
        : null;
    const sicop =
      resultados[1].status === 'fulfilled'
        ? { cobertura: sc!, filas: resultados[1].value }
        : null;
    const electores =
      resultados[2].status === 'fulfilled' ? resultados[2].value : null;
    let distritos: Distrito[] = [];
    let errorDistritos = false;
    if (electores?.length) {
      try {
        distritos = await this.db.query<Distrito[]>(
          `SELECT distrito, total FROM tse_padron_distrital WHERE "cantonCodigo" = $1 AND "fechaCorte" = $2 ORDER BY total DESC, "distritoCodigo"`,
          [codigo, electores[0].fechaCorte],
        );
      } catch {
        errorDistritos = true;
      }
    }
    const radar = construirRadar(canton, p, hoy, {
      oij,
      sicop,
      tse: electores ? { filas: electores, distritos } : null,
      pronae: resultados[3].status === 'fulfilled' ? resultados[3].value : null,
    });
    if (errorDistritos)
      radar.metadatos.advertencias.push(
        'No se pudieron consultar los distritos TSE; se conserva el total cantonal.',
      );
    return radar;
  }

  private async cobertura(
    tabla: 'estadisticas_policiales' | 'sicop_ordenes_pedido',
    fecha: 'fecha' | 'fecha_elaboracion',
  ): Promise<Cobertura> {
    // Identificadores cerrados en código, nunca provienen del request.
    const [c] = await this.db.query<
      Cobertura[]
    >(`SELECT MIN(${fecha})::text AS desde, MAX(${fecha})::text AS hasta,
      COALESCE(ARRAY_AGG(DISTINCT TO_CHAR(${fecha}, 'YYYY-MM')) FILTER (WHERE ${fecha} IS NOT NULL), '{}') AS meses,
      COUNT(*)::int AS registros FROM ${tabla}`);
    return c;
  }
}

export function construirRadar(
  canton: Radar['canton'],
  p: Periodo,
  hoy: string,
  data: DatosRadar,
): Radar {
  const { oij, sicop, tse, pronae } = data;
  const meses = mesesCompletos(p.desde, p.hasta, hoy);
  const oi = oij?.filas.filter((r) => r.canton === canton.codigo) ?? [];
  const compras = sicop?.filas.filter((r) => r.canton === canton.codigo) ?? [];
  const elector = tse?.filas.find((r) => r.canton === canton.codigo);
  const electores = elector?.total ?? null;
  const suficiente = cubre(oij?.cobertura ?? null, p);
  // Conteos vacíos cantonales se dejan desconocidos: no hay manifiesto de cobertura territorial.
  const incidentes = oi.length ? total(oi) : null;
  const mesesOij = meses.filter((m) =>
    cubre(oij?.cobertura ?? null, {
      desde: m + '-01',
      hasta: finMes(m + '-01'),
      mesesCompletos: 1,
    }),
  );
  const ultimos = mesesOij.slice(-2);
  const consecutivos =
    ultimos.length === 2 &&
    meses.indexOf(ultimos[1]) - meses.indexOf(ultimos[0]) === 1;
  const mensual = (m: string | undefined) => {
    const rows = oi.filter((r) => r.fecha.startsWith(m ?? 'no-mes'));
    // Un mes vacío dentro de una serie cantonal observada se cuenta como cero registros, sujeto al proxy nacional.
    return m && oi.length ? total(rows) : null;
  };
  const anterior = consecutivos ? mensual(ultimos[0]) : null;
  const actual = consecutivos ? mensual(ultimos[1]) : null;
  const cambio = variacion(actual, anterior);
  const ratio = suficiente ? razon(incidentes, electores) : null;
  const delitos = new Map<string, number>();
  oi.forEach((r) =>
    delitos.set(r.delito, (delitos.get(r.delito) ?? 0) + r.total),
  );
  const nacional = sum(tse?.filas ?? [], (r) => r.total);
  const monedas = montos(compras);
  const ordenesNacionales = sum(sicop?.filas ?? [], (r) => r.ordenes);
  const coberturaGeo = ordenesNacionales
    ? (sum(
        sicop!.filas.filter((r) => r.canton),
        (r) => r.ordenes,
      ) /
        ordenesNacionales) *
      100
    : null;
  const sicopSuficiente =
    cubre(sicop?.cobertura ?? null, p) &&
    coberturaGeo !== null &&
    coberturaGeo >= REGLAS.coberturaPct;
  const ratios = suficiente
    ? (tse?.filas ?? []).flatMap((e) => {
        const rows = oij!.filas.filter((r) => r.canton === e.canton);
        const n = rows.length ? razon(total(rows), e.total) : null;
        return n === null ? [] : [n];
      })
    : [];
  const med = ratios.length >= REGLAS.minCantones ? mediana(ratios) : null;
  const medianasSicop: Radar['comparacion']['medianasSicopPorMoneda'] = [];
  if (sicopSuficiente) {
    const porCanton = [
      ...new Set(sicop!.filas.flatMap((r) => (r.canton ? [r.canton] : []))),
    ].map((c) => montos(sicop!.filas.filter((r) => r.canton === c)));
    for (const moneda of monedas) {
      const valores = porCanton.flatMap((ms) =>
        ms
          .filter(
            (m) =>
              m.moneda === moneda.moneda &&
              m.monto !== null &&
              m.ordenesConMonto === m.ordenes,
          )
          .map((m) => m.monto!),
      );
      if (valores.length >= REGLAS.minCantones)
        medianasSicop.push({
          moneda: moneda.moneda,
          mediana: mediana(valores)!,
          cantones: valores.length,
        });
    }
  }
  const evolucion = (pronae ?? [])
    .filter((r) => r.esTotal)
    .sort((a, b) => a.anio - b.anio)
    .map((r) => ({ anio: r.anio, total: r.beneficiarios }));
  const ultimoPronae = evolucion.at(-1);
  const modalidad = (pronae ?? [])
    .filter(
      (r) =>
        !r.esTotal && r.anio === ultimoPronae?.anio && r.beneficiarios !== null,
    )
    .sort((a, b) => b.beneficiarios! - a.beneficiarios!)[0];
  const distritos = (tse?.distritos ?? []).map((d) => ({
    ...d,
    porcentaje: electores && electores > 0 ? (d.total / electores) * 100 : null,
  }));
  const fuentes: Fuente[] = [
    {
      nombre: 'Poder Judicial / OIJ — Estadísticas Policiales',
      alcance: 'Cantonal',
      url: URLS[0],
      registrosUsados: oij ? total(oi) : null,
      cobertura: oij?.cobertura ?? null,
      fechaCorte: null,
      sincronizadoEn: null,
      estado: !oij
        ? 'error'
        : oij.cobertura.registros
          ? 'disponible'
          : 'sin-datos',
      advertencias: [
        LIMITACIONES.OIJ,
        PROXY,
        'No hay fecha de sincronización persistida.',
      ],
    },
    {
      nombre: 'SICOP — Órdenes de pedido / Observatorio de Compra Pública',
      alcance: 'Sede institucional; cobertura territorial nacional del período',
      url: URLS[1],
      registrosUsados: sicop ? sum(compras, (r) => r.ordenes) : null,
      cobertura: sicop?.cobertura ?? null,
      fechaCorte: null,
      sincronizadoEn: null,
      estado: !sicop
        ? 'error'
        : sicop.cobertura.registros
          ? 'disponible'
          : 'sin-datos',
      advertencias: [
        LIMITACIONES.SICOP,
        PROXY,
        'No hay fecha de sincronización persistida. Montos no negativos por moneda original; sin moneda o monto quedan fuera de indicadores monetarios.',
      ],
    },
    {
      nombre: 'Tribunal Supremo de Elecciones — Padrón Electoral',
      alcance: '84 cantones; excluye electores en el extranjero',
      url: URLS[2],
      registrosUsados: electores,
      cobertura: null,
      fechaCorte: elector?.fechaCorte ?? tse?.filas[0]?.fechaCorte ?? null,
      sincronizadoEn: elector?.sincronizadoEn ?? null,
      estado: !tse ? 'error' : tse.filas.length ? 'disponible' : 'sin-datos',
      advertencias: [
        LIMITACIONES.TSE,
        'Se utiliza el último corte disponible, incluso si no coincide con el período analizado.',
      ],
    },
    {
      nombre: 'MTSS — PRONAE / Portal Nacional de Datos Abiertos',
      alcance: 'Nacional, 2021–2024',
      url: URLS[3],
      registrosUsados: pronae?.length ?? null,
      cobertura: null,
      fechaCorte: null,
      sincronizadoEn: null,
      estado: !pronae ? 'error' : pronae.length ? 'disponible' : 'sin-datos',
      advertencias: [
        LIMITACIONES.PRONAE,
        'Sin fecha de sincronización persistida. No participa en indicadores ni señales cantonales.',
      ],
    },
  ];
  const radar: Radar = {
    canton,
    periodo: p,
    seguridad: {
      incidentes,
      mesAnterior: anterior,
      ultimoMesCompleto: actual,
      mesesComparados: consecutivos ? ultimos : [],
      variacionMensualPorcentaje: cambio,
      explicacionVariacion:
        cambio !== null
          ? 'Variación entre dos meses completos consecutivos con cobertura nacional observada.'
          : anterior === 0
            ? 'El mes anterior tiene cero registros: porcentaje indefinido.'
            : 'No hay dos meses completos consecutivos con datos suficientes.',
      incidentesPorMilElectores: ratio,
      coberturaSuficiente: suficiente,
      topDelitos: [...delitos]
        .map(([delito, total]) => ({ delito, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    },
    electorado: {
      fechaCorte: elector?.fechaCorte ?? null,
      electores,
      porcentajeNacional:
        electores !== null && nacional > 0
          ? (electores / nacional) * 100
          : null,
      distritosPrincipales: distritos.slice(0, 5),
    },
    contratacion: {
      ordenes:
        sicop && ordenesNacionales > 0 ? sum(compras, (r) => r.ordenes) : null,
      instituciones: compras.length
        ? new Set(
            compras.flatMap((r) => (r.institucion ? [r.institucion] : [])),
          ).size
        : null,
      proveedores: compras.length
        ? new Set(compras.flatMap((r) => (r.proveedor ? [r.proveedor] : [])))
            .size
        : null,
      montosPorMoneda: monedas,
      coberturaGeografica: coberturaGeo,
      coberturaSuficiente: sicopSuficiente,
    },
    comparacion: {
      cantonesComparables: ratios.length,
      medianaIncidentesPorMilElectores: med,
      posicionRelativaIncidentes:
        med !== null && ratio !== null
          ? (ratios.filter((n) => n <= ratio).length / ratios.length) * 100
          : null,
      medianasSicopPorMoneda: medianasSicop,
    },
    contextoNacional: {
      pronae: {
        anioMasReciente: ultimoPronae?.anio ?? null,
        totalBeneficiarios: ultimoPronae?.total ?? null,
        modalidadPrincipal: modalidad?.modalidad ?? null,
        evolucion,
      },
    },
    senales: [],
    metadatos: {
      fuentes,
      advertencias: [
        'Correlación o coincidencia temporal no implica causalidad.',
        'Las señales orientan preguntas; no califican cantones ni prueban irregularidades.',
        'Las sumas monetarias se presentan por moneda; la concentración requiere monto y proveedor identificados en todas las órdenes de esa moneda.',
        ...(!suficiente
          ? [
              'Cobertura OIJ insuficiente para comparar el período completo; el conteo mostrado, si existe, es parcial.',
            ]
          : []),
        ...(!sicopSuficiente
          ? ['Cobertura SICOP insuficiente para comparaciones territoriales.']
          : []),
        ...fuentes
          .filter((f) => f.estado === 'error')
          .map((f) => `${f.nombre}: consulta no disponible; ficha parcial.`),
      ],
    },
  };
  const agregar = (
    codigo: string,
    titulo: string,
    descripcion: string,
    valores: [string, number][],
    metodologia: string,
    fuentes: (keyof typeof LIMITACIONES)[],
    preguntaSugerida: string,
    nivel: Senal['nivel'] = 'atencion',
  ) =>
    radar.senales.push({
      codigo,
      nivel,
      titulo,
      descripcion,
      evidencia: valores.map(([etiqueta, valor]) => ({
        etiqueta,
        valor: valor.toLocaleString('es-CR', { maximumFractionDigits: 2 }),
      })),
      metodologia,
      fuentes,
      limitaciones: fuentes.map((f) => LIMITACIONES[f]),
      preguntaSugerida,
    });
  if (
    cambio !== null &&
    anterior !== null &&
    actual !== null &&
    anterior >= REGLAS.minAnterior &&
    actual - anterior >= REGLAS.incrementoAbsoluto &&
    cambio >= REGLAS.incrementoPct
  )
    agregar(
      'incremento-incidentes',
      'Aumento reciente de incidentes registrados',
      'La variación supera los criterios exploratorios publicados.',
      [
        ['Mes anterior', anterior],
        ['Último mes completo', actual],
        ['Variación (%)', cambio],
      ],
      `Dos meses completos consecutivos: anterior ≥ ${REGLAS.minAnterior}, aumento ≥ ${REGLAS.incrementoAbsoluto} registros y ≥ ${REGLAS.incrementoPct}%.`,
      ['OIJ'],
      '¿Qué tipos de incidentes explican el cambio y hubo cambios en el registro?',
    );
  if (ratio !== null && med !== null && ratio > med)
    agregar(
      'razon-sobre-mediana',
      'Razón por electores superior a la mediana',
      'Diferencia descriptiva entre cantones observados; no es una medida de riesgo individual.',
      [
        ['Razón por 1.000 electores', ratio],
        ['Mediana', med],
        ['Cantones comparables', ratios.length],
      ],
      `Incidentes / electores × 1.000; mínimo ${REGLAS.minCantones} cantones con cobertura temporal y denominador positivo.`,
      ['OIJ', 'TSE'],
      '¿Cómo influyen la movilidad, el tamaño del padrón y la cobertura de registro?',
      'informativa',
    );
  for (const m of monedas) {
    const np = new Set(
      compras
        .filter((r) => r.moneda === m.moneda)
        .flatMap((r) => (r.proveedor ? [r.proveedor] : [])),
    ).size;
    if (
      m.ordenes >= REGLAS.minOrdenes &&
      m.principal !== null &&
      (m.principal >= REGLAS.principalPct ||
        (np >= REGLAS.minProveedoresTop && m.topCinco! >= REGLAS.topCincoPct))
    )
      agregar(
        'concentracion-' + m.moneda,
        `Concentración de proveedores en ${m.moneda}`,
        'Participación del monto observado en proveedores identificados; no demuestra irregularidades.',
        [
          ['Principal (%)', m.principal],
          ['Top cinco (%)', m.topCinco!],
          ['Órdenes', m.ordenes],
        ],
        `Por moneda, monto y proveedor completos: ≥ ${REGLAS.minOrdenes} órdenes; principal ≥ ${REGLAS.principalPct}% o top cinco ≥ ${REGLAS.topCincoPct}% con ≥ ${REGLAS.minProveedoresTop} proveedores.`,
        ['SICOP'],
        '¿Qué bienes o servicios y modalidades de compra explican esta concentración?',
      );
  }
  const mesesSicop = meses.filter((m) =>
    cubre(sicop?.cobertura ?? null, {
      desde: m + '-01',
      hasta: finMes(m + '-01'),
      mesesCompletos: 1,
    }),
  );
  const serie = mesesSicop.map((m) =>
    sum(
      compras.filter((r) => r.mes === m),
      (r) => r.ordenes,
    ),
  );
  // No se conectan huecos temporales como si fueran una serie continua.
  if (
    sicopSuficiente &&
    mesesSicop.length === meses.length &&
    serie.length > REGLAS.historiaMeses &&
    atipico(serie.at(-1)!, serie.slice(0, -1))
  )
    agregar(
      'cambio-ordenes',
      'Cambio mensual atípico en órdenes identificadas',
      'El último mes supera la referencia robusta de su historia disponible.',
      [
        ['Último mes', serie.at(-1)!],
        ['Mediana histórica', mediana(serie.slice(0, -1))!],
      ],
      `≥ ${REGLAS.historiaMeses} meses previos completos; actual > mediana + ${REGLAS.madFactor} × 1,4826 × MAD y aumento ≥ ${REGLAS.minCambioOrdenes} órdenes. MAD cero: sin señal.`,
      ['SICOP'],
      '¿Hubo compras estacionales, cambios de cobertura o proyectos específicos?',
    );
  const topTres = sum(distritos.slice(0, 3), (d) => d.porcentaje ?? 0);
  if (
    distritos.length >= REGLAS.minDistritos &&
    electores !== null &&
    sum(distritos, (d) => d.total) === electores &&
    topTres >= REGLAS.electoresTopTresPct
  )
    agregar(
      'concentracion-electoral',
      'Electores concentrados en tres distritos electorales',
      'Describe la distribución del padrón cantonal.',
      [['Tres distritos (%)', topTres]],
      `Tres principales / padrón × 100 ≥ ${REGLAS.electoresTopTresPct}%, con ≥ ${REGLAS.minDistritos} distritos y suma coincidente con el total cantonal.`,
      ['TSE'],
      '¿Cómo se distribuyen los servicios y la organización comunitaria entre estos distritos?',
      'informativa',
    );
  if (!sicopSuficiente)
    agregar(
      'cobertura-sicop',
      'Cobertura SICOP insuficiente',
      'No se puede interpretar la ausencia de órdenes identificadas como ausencia de contratación.',
      coberturaGeo === null
        ? []
        : [['Órdenes nacionales geolocalizadas (%)', coberturaGeo]],
      `Se requiere cobertura temporal del período y ≥ ${REGLAS.coberturaPct}% de órdenes nacionales geolocalizadas para comparar cantones.`,
      ['SICOP'],
      '¿Qué instituciones u órdenes faltan por localizar en la fuente?',
      'informativa',
    );
  return radar;
}
