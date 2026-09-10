import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { unzipSync, strFromU8 } from 'fflate';
import Papa from 'papaparse';
import type { SelectQueryBuilder } from 'typeorm';
import { Repository } from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';
import { Contratacion } from './contratacion.entity.js';
import {
  normalizarTexto,
  parseFecha,
  parseMonto,
  partirZonaGeo,
  texto,
  ultimosMeses,
} from './sicop.parsers.js';

/**
 * Fuente OSINT (AGENTS.md §6.2): SICOP — Datos Abiertos de Contratación Pública.
 * Vía de acceso: "Zona de descarga masiva" del Observatorio de Compra Pública
 * (Ministerio de Hacienda), que replica los datos de SICOP en ZIP mensual de CSV.
 *
 *   https://dlsaobservatorioprod.blob.core.windows.net/fs-synapse-observatorio-produccion/Zip/AAAAMM.zip
 *
 * Cada ZIP trae ~25 CSV. Este módulo usa:
 *   - OrdenPedido.csv           → hechos (compra ejecutada: proveedor, monto, fecha)
 *   - InstitucionesRegistradas  → institución compradora + ubicación (ZONA_GEO_INST)
 *   - Sistemas / DetalleCarteles / Contratos → puente NRO_SICOP → cédula institución
 *
 * Con eso se resuelve el cantón de la institución compradora y se habilita el
 * cruce geográfico con las demás fuentes. Ver DATOS.md.
 */
const ZIP_URL = (aaaamm: string) =>
  `https://dlsaobservatorioprod.blob.core.windows.net/fs-synapse-observatorio-produccion/Zip/${aaaamm}.zip`;

const CSV_ORDENES = 'OrdenPedido.csv';
const CSV_INSTITUCIONES = 'InstitucionesRegistradas.csv';
/** CSVs que enlazan NRO_SICOP → CEDULA_INSTITUCION. */
const CSV_PUENTES = ['Sistemas.csv', 'DetalleCarteles.csv', 'Contratos.csv'];
const CSV_TODOS = [CSV_ORDENES, CSV_INSTITUCIONES, ...CSV_PUENTES];

/** Cuántos meses hacia atrás descargar en cada refresco. */
const MESES_HISTORICO = 6;

interface FilaOrdenPedido {
  NRO_ORDEN: string;
  NRO_SICOP: string;
  NUMERO_PROCEDIMIENTO: string;
  NRO_CONTRATO: string;
  CONTRACT_NO: string;
  DESC_PROCEDIMIENTO: string;
  CEDULAPROVEEDOR: string;
  NOMBRE_PROVEEDOR: string;
  TOTAL_ORDEN: string;
  TOTALESTIMADO: string;
  USD_MONT: string;
  MONEDA_ORDEN: string;
  ESTADO_ORDEN: string;
  FECHA_ELABORACION_ORDEN: string;
  FECHA_NOTIFICACION_ORDEN: string;
}

interface GeoInstitucion {
  cedula: string;
  nombre: string | null;
  provincia: string | null;
  cantonCodigo: string | null;
}

type ZipCsvs = Record<string, Record<string, string>[]>;

@Injectable()
export class SicopService {
  private readonly logger = new Logger(SicopService.name);

  constructor(
    @InjectRepository(Contratacion)
    private readonly contratacionRepo: Repository<Contratacion>,
    @InjectRepository(Canton)
    private readonly cantonRepo: Repository<Canton>,
  ) {}

  /**
   * Cron: los datos abiertos de SICOP se refrescan a diario (con ~24 h de
   * desfase respecto al sistema en vivo).
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async refrescarDatos(): Promise<void> {
    this.logger.log('Iniciando descarga de órdenes de pedido de SICOP...');
    try {
      const r = await this.descargarYProcesar();
      this.logger.log(
        `SICOP actualizado: ${r.insertados} órdenes (${r.conCanton} con cantón, ${r.coberturaCanton}). ${r.mesesOk}/${r.mesesIntentados} meses.`,
      );
    } catch (error) {
      this.logger.error(
        'Error al refrescar SICOP — se mantiene el último dato cacheado.',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Descarga los últimos MESES_HISTORICO ZIP del Observatorio, normaliza las
   * órdenes de pedido, les resuelve la institución/cantón y reemplaza los
   * datos (full refresh).
   *
   * @param meses  lista explícita de "AAAAMM" (para pruebas / primera carga).
   */
  async descargarYProcesar(meses?: string[]): Promise<{
    filasLeidas: number;
    insertados: number;
    conCanton: number;
    coberturaCanton: string;
    mesesOk: number;
    mesesIntentados: number;
  }> {
    const objetivo = meses?.length ? meses : ultimosMeses(MESES_HISTORICO);

    const ordenes: FilaOrdenPedido[] = [];
    const filasInstituciones: Record<string, string>[] = [];
    const filasPuente: Record<string, string>[] = [];
    let mesesOk = 0;

    for (const aaaamm of objetivo) {
      try {
        const zip = await this.descargarMes(aaaamm);
        ordenes.push(...((zip[CSV_ORDENES] ?? []) as unknown as FilaOrdenPedido[]));
        filasInstituciones.push(...(zip[CSV_INSTITUCIONES] ?? []));
        for (const nombre of CSV_PUENTES) filasPuente.push(...(zip[nombre] ?? []));
        mesesOk++;
        this.logger.log(`  ${aaaamm}: ${(zip[CSV_ORDENES] ?? []).length} órdenes`);
      } catch {
        this.logger.warn(`  ${aaaamm}: ZIP no disponible o error, se omite.`);
      }
    }

    if (ordenes.length === 0) {
      this.logger.warn('SICOP: no se obtuvieron registros. Se conservan datos previos.');
      return {
        filasLeidas: 0,
        insertados: 0,
        conCanton: 0,
        coberturaCanton: '0%',
        mesesOk,
        mesesIntentados: objetivo.length,
      };
    }

    // Índices para resolver institución → cantón
    const geoPorCedula = await this.construirGeoInstituciones(filasInstituciones);
    const cedulaPorSicop = this.construirPuenteSicopInstitucion(filasPuente);

    // Normalizar + resolver cantón, deduplicando por NRO_ORDEN
    const porOrden = new Map<string, Contratacion>();
    for (const f of ordenes) {
      const c = this.parsearFila(f, geoPorCedula, cedulaPorSicop);
      if (c) porOrden.set(c.nroOrden, c);
    }
    const unicos = [...porOrden.values()];
    const conCanton = unicos.filter((c) => c.cantonCodigo).length;
    const cobertura = `${((conCanton / unicos.length) * 100).toFixed(1)}%`;

    await this.contratacionRepo.clear();
    const BATCH = 500;
    for (let i = 0; i < unicos.length; i += BATCH) {
      await this.contratacionRepo.save(unicos.slice(i, i + BATCH));
    }

    return {
      filasLeidas: ordenes.length,
      insertados: unicos.length,
      conCanton,
      coberturaCanton: cobertura,
      mesesOk,
      mesesIntentados: objetivo.length,
    };
  }

  /** Descarga un ZIP mensual y devuelve los CSV que usamos, ya parseados. */
  private async descargarMes(aaaamm: string): Promise<ZipCsvs> {
    const resp = await axios.get<ArrayBuffer>(ZIP_URL(aaaamm), {
      responseType: 'arraybuffer',
      timeout: 180_000,
    });
    const zip = unzipSync(new Uint8Array(resp.data), {
      filter: (file) => CSV_TODOS.includes(file.name),
    });

    const out: ZipCsvs = {};
    for (const nombre of CSV_TODOS) {
      const bytes = zip[nombre];
      out[nombre] = bytes
        ? Papa.parse<Record<string, string>>(strFromU8(bytes), {
            header: true,
            delimiter: ';',
            skipEmptyLines: true,
          }).data
        : [];
    }
    return out;
  }

  /**
   * Mapa CEDULA institución → {nombre, provincia, cantón}, resolviendo el
   * cantón contra la tabla `cantones` a partir de ZONA_GEO_INST
   * ("distrito, cantón, provincia", sin tildes).
   */
  private async construirGeoInstituciones(
    filas: Record<string, string>[],
  ): Promise<Map<string, GeoInstitucion>> {
    const cantones = await this.cantonRepo.find();
    const porNombreProv = new Map<string, string>();
    const porNombre = new Map<string, string | null>(); // null = ambiguo
    for (const c of cantones) {
      porNombreProv.set(normalizarTexto(`${c.nombre}|${c.provincia}`), c.codigo);
      const k = normalizarTexto(c.nombre);
      porNombre.set(k, porNombre.has(k) ? null : c.codigo);
    }

    const geo = new Map<string, GeoInstitucion>();
    for (const f of filas) {
      const cedula = (f.CEDULA ?? '').trim();
      if (!cedula) continue;
      const zg = partirZonaGeo(f.ZONA_GEO_INST);
      let cantonCodigo: string | null = null;
      if (zg) {
        cantonCodigo =
          porNombreProv.get(normalizarTexto(`${zg.canton}|${zg.provincia}`)) ??
          porNombre.get(normalizarTexto(zg.canton)) ??
          null;
      }
      geo.set(cedula, {
        cedula,
        nombre: (f.NOMBRE_INSTITUCION ?? '').trim() || null,
        provincia: zg?.provincia ?? null,
        cantonCodigo,
      });
    }
    return geo;
  }

  /** Mapa NRO_SICOP → CEDULA institución compradora (de los CSV puente). */
  private construirPuenteSicopInstitucion(
    filas: Record<string, string>[],
  ): Map<string, string> {
    const m = new Map<string, string>();
    for (const f of filas) {
      const sicop = (f.NRO_SICOP ?? '').trim();
      const cedula = (f.CEDULA_INSTITUCION ?? '').trim();
      if (sicop && cedula) m.set(sicop, cedula);
    }
    return m;
  }

  /** Normaliza una fila de OrdenPedido a la entidad. null si no es usable. */
  private parsearFila(
    f: FilaOrdenPedido,
    geoPorCedula: Map<string, GeoInstitucion>,
    cedulaPorSicop: Map<string, string>,
  ): Contratacion | null {
    const nroOrden = f.NRO_ORDEN?.trim();
    if (!nroOrden) return null;

    const c = new Contratacion();
    c.nroOrden = nroOrden.substring(0, 40);
    c.nroSicop = texto(f.NRO_SICOP, 40);
    c.numeroProcedimiento = texto(f.NUMERO_PROCEDIMIENTO, 40);
    c.nroContrato = texto(f.CONTRACT_NO ?? f.NRO_CONTRATO, 30);
    c.descripcion = texto(f.DESC_PROCEDIMIENTO, 4000);
    c.proveedorCedula = texto(f.CEDULAPROVEEDOR, 20);
    c.proveedor = texto(f.NOMBRE_PROVEEDOR, 250);
    c.montoOrden = parseMonto(f.TOTAL_ORDEN);
    c.montoEstimado = parseMonto(f.TOTALESTIMADO);
    c.montoUsd = parseMonto(f.USD_MONT);
    c.moneda = texto(f.MONEDA_ORDEN, 3);
    c.estado = texto(f.ESTADO_ORDEN, 80);
    c.fechaElaboracion = parseFecha(f.FECHA_ELABORACION_ORDEN);
    c.fechaNotificacion = parseFecha(f.FECHA_NOTIFICACION_ORDEN);

    // Cruce: NRO_SICOP → cédula institución → geo
    const cedula = c.nroSicop ? cedulaPorSicop.get(c.nroSicop) : undefined;
    const g = cedula ? geoPorCedula.get(cedula) : undefined;
    c.institucionCedula = cedula ?? null;
    c.institucion = g?.nombre ?? null;
    c.provincia = g?.provincia ?? null;
    c.cantonCodigo = g?.cantonCodigo ?? null;
    return c;
  }

  // ─── Consultas para el controller ────────────────────────────────────

  /** Órdenes de un cantón. */
  async porCanton(
    cantonCodigo: string,
    opciones?: { desde?: string; hasta?: string; limit?: number; offset?: number },
  ): Promise<Contratacion[]> {
    const qb = this.contratacionRepo
      .createQueryBuilder('c')
      .where('c.canton_codigo = :cantonCodigo', { cantonCodigo });
    this.rango(qb, opciones);
    qb.orderBy('c.fecha_elaboracion', 'DESC').limit(opciones?.limit ?? 100);
    if (opciones?.offset) qb.offset(opciones.offset);
    return qb.getMany();
  }

  /** Ranking de proveedores por monto total contratado. */
  async topProveedores(opciones?: {
    desde?: string;
    hasta?: string;
    limit?: number;
    q?: string;
    cantonCodigo?: string;
  }): Promise<{ proveedor: string; total: number; ordenes: number }[]> {
    const qb = this.contratacionRepo
      .createQueryBuilder('c')
      .select('c.proveedor', 'proveedor')
      .addSelect('COALESCE(SUM(c.monto_orden), 0)::float', 'total')
      .addSelect('COUNT(*)::int', 'ordenes')
      .where('c.proveedor IS NOT NULL');
    this.rango(qb, opciones);
    if (opciones?.q) qb.andWhere('c.proveedor ILIKE :q', { q: `%${opciones.q}%` });
    if (opciones?.cantonCodigo)
      qb.andWhere('c.canton_codigo = :cc', { cc: opciones.cantonCodigo });
    qb.groupBy('c.proveedor').orderBy('total', 'DESC').limit(opciones?.limit ?? 20);
    return qb.getRawMany();
  }

  /** Ranking de instituciones compradoras por monto. */
  async topInstituciones(opciones?: {
    desde?: string;
    hasta?: string;
    limit?: number;
    cantonCodigo?: string;
  }): Promise<{ institucion: string; total: number; ordenes: number }[]> {
    const qb = this.contratacionRepo
      .createQueryBuilder('c')
      .select('c.institucion', 'institucion')
      .addSelect('COALESCE(SUM(c.monto_orden), 0)::float', 'total')
      .addSelect('COUNT(*)::int', 'ordenes')
      .where('c.institucion IS NOT NULL');
    this.rango(qb, opciones);
    if (opciones?.cantonCodigo)
      qb.andWhere('c.canton_codigo = :cc', { cc: opciones.cantonCodigo });
    qb.groupBy('c.institucion').orderBy('total', 'DESC').limit(opciones?.limit ?? 20);
    return qb.getRawMany();
  }

  /** Gasto agregado por mes (para el timeline). */
  async gastoMensual(opciones?: {
    desde?: string;
    hasta?: string;
    cantonCodigo?: string;
  }): Promise<{ mes: string; monto: number; ordenes: number }[]> {
    const qb = this.contratacionRepo
      .createQueryBuilder('c')
      .select("TO_CHAR(c.fecha_elaboracion, 'YYYY-MM')", 'mes')
      .addSelect('COALESCE(SUM(c.monto_orden), 0)::float', 'monto')
      .addSelect('COUNT(*)::int', 'ordenes')
      .where('c.fecha_elaboracion IS NOT NULL');
    this.rango(qb, opciones);
    if (opciones?.cantonCodigo)
      qb.andWhere('c.canton_codigo = :cc', { cc: opciones.cantonCodigo });
    qb.groupBy('mes').orderBy('mes', 'ASC');
    return qb.getRawMany();
  }

  /** Totales generales (health check + cobertura del cruce por cantón). */
  async resumenGeneral(): Promise<{ registros: number; conCanton: number }> {
    const registros = await this.contratacionRepo.count();
    const conCanton = await this.contratacionRepo
      .createQueryBuilder('c')
      .where('c.canton_codigo IS NOT NULL')
      .getCount();
    return { registros, conCanton };
  }

  private rango(qb: SelectQueryBuilder<Contratacion>, o?: { desde?: string; hasta?: string }): void {
    if (o?.desde) qb.andWhere('c.fecha_elaboracion >= :desde', { desde: o.desde });
    if (o?.hasta) qb.andWhere('c.fecha_elaboracion <= :hasta', { hasta: o.hasta });
  }
}
