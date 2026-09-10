import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';
import { Contratacion } from './contratacion.entity.js';

/**
 * ─── INVESTIGACIÓN PENDIENTE (persona responsable de SICOP) ───────────────
 *
 * Antes de terminar este service hay que decidir y documentar en el README:
 *
 *  1. ¿Qué reporte de SICOP se consume?
 *     Portal: https://www.sicop.go.cr/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp
 *     (o el nuevo módulo: https://www.sicop.go.cr/app/module/pcont/public/ce-open-data)
 *     Candidatos: solicitudes de contratación, pliegos, aclaraciones, recursos,
 *     ofertas, adjudicaciones, contratos, órdenes de pedido, instituciones
 *     compradoras, proveedores. Para el cruce por cantón conviene el que traiga
 *     institución + monto + fecha + alguna ubicación.
 *
 *  2. ¿Cómo se descarga? SICOP permite exportar en JSON / CSV / Excel tras
 *     aplicar filtros (fecha, institución, provincia/cantón). Hay que capturar
 *     la request real (DevTools → Network al pulsar "Exportar") y ver si el
 *     endpoint acepta parámetros por querystring/body para automatizarlo.
 *     Alternativa conocida: ZIPs mensuales del Observatorio de Compra Pública
 *     ( https://dlsaobservatorioprod.blob.core.windows.net/fs-synapse-observatorio-produccion/Zip/AAAAMM.zip ),
 *     que republica los datos de SICOP en CSV — evaluar si sirve y citar la fuente.
 *
 *  3. Mapear columnas del archivo → campos de la entidad Contratacion.
 *     Rellenar SICOP_SOURCE_URL y parsearReporte() según el formato elegido.
 *
 * El resto del módulo (entidad, controller, cron, manejo de errores) ya sigue
 * el patrón de AGENTS.md sección 5 y no debería necesitar cambios grandes.
 * ─────────────────────────────────────────────────────────────────────────
 */
const SICOP_SOURCE_URL: string = ''; // TODO(investigación): endpoint / archivo real

/** Años a cargar. Ajustar según lo que exponga la fuente. */
const ANIOS = [2024, 2025, 2026];

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
   * Cron: los datos abiertos de SICOP se actualizan a diario (con ~24 h de
   * desfase), así que refrescamos una vez por día.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async refrescarDatos(): Promise<void> {
    this.logger.log('Iniciando descarga de contrataciones de SICOP...');
    try {
      const resultado = await this.descargarYProcesar();
      this.logger.log(
        `Datos de SICOP actualizados: ${resultado.insertados} registros de ${resultado.filasLeidas} filas.`,
      );
    } catch (error) {
      this.logger.error(
        'Error al refrescar datos de SICOP — se mantiene el último dato cacheado.',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Descarga el reporte de SICOP, lo parsea, normaliza y guarda en la base.
   * Full refresh: reemplaza todos los datos existentes.
   */
  async descargarYProcesar(): Promise<{ filasLeidas: number; insertados: number }> {
    if (!SICOP_SOURCE_URL) {
      throw new Error(
        'SICOP_SOURCE_URL no está configurado todavía — ver el bloque INVESTIGACIÓN PENDIENTE en sicop.service.ts',
      );
    }

    const cantones = await this.cantonRepo.find();
    const cantonMap = this.construirMapaCantones(cantones);

    let todos: Partial<Contratacion>[] = [];
    let filasLeidas = 0;

    for (const anio of ANIOS) {
      try {
        // TODO(investigación): ajustar la forma de pedir cada año/mes
        const url = SICOP_SOURCE_URL.replace('{anio}', String(anio));
        this.logger.log(`Descargando ${url}...`);
        const response = await axios.get<unknown>(url, { timeout: 120_000 });
        const registros = this.parsearReporte(response.data, cantonMap);
        filasLeidas += Array.isArray(response.data) ? response.data.length : 0;
        todos = todos.concat(registros);
        this.logger.log(`  ${anio}: ${registros.length} registros válidos`);
      } catch {
        this.logger.warn(`  ${anio}: no disponible o error, se omite.`);
      }
    }

    if (todos.length === 0) {
      this.logger.warn('No se obtuvieron registros. Se conservan datos previos.');
      return { filasLeidas, insertados: 0 };
    }

    await this.contratacionRepo.clear();

    const BATCH = 500;
    let insertados = 0;
    for (let i = 0; i < todos.length; i += BATCH) {
      await this.contratacionRepo.save(todos.slice(i, i + BATCH));
      insertados += Math.min(BATCH, todos.length - i);
    }
    return { filasLeidas, insertados };
  }

  /**
   * TODO(investigación): parsear el formato real que devuelva SICOP
   * (JSON array, CSV, filas de Excel) y mapear a la entidad Contratacion.
   */
  private parsearReporte(
    _data: unknown,
    _cantonMap: Map<string, string>,
  ): Partial<Contratacion>[] {
    return [];
  }

  /** Mapa "provincia|canton" normalizado → código de cantón. */
  private construirMapaCantones(cantones: Canton[]): Map<string, string> {
    const mapa = new Map<string, string>();
    for (const c of cantones) {
      mapa.set(this.normalizar(`${c.provincia}|${c.nombre}`), c.codigo);
    }
    return mapa;
  }

  /** Quita tildes y pasa a minúsculas para comparar nombres. */
  private normalizar(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
  }

  // ─── Consultas para el controller ────────────────────────────────────

  /** Contrataciones de un cantón, con paginación y rango de fechas. */
  async porCanton(
    cantonCodigo: string,
    opciones?: { desde?: string; hasta?: string; limit?: number; offset?: number },
  ): Promise<Contratacion[]> {
    const qb = this.contratacionRepo
      .createQueryBuilder('c')
      .where('c.canton_codigo = :cantonCodigo', { cantonCodigo });

    if (opciones?.desde) qb.andWhere('c.fecha >= :desde', { desde: opciones.desde });
    if (opciones?.hasta) qb.andWhere('c.fecha <= :hasta', { hasta: opciones.hasta });

    qb.orderBy('c.fecha', 'DESC').limit(opciones?.limit ?? 100);
    if (opciones?.offset) qb.offset(opciones.offset);
    return qb.getMany();
  }

  /** Resumen: monto total contratado por institución en un cantón. */
  async resumenPorCanton(
    cantonCodigo: string,
  ): Promise<{ institucion: string; total: number; contratos: number }[]> {
    return this.contratacionRepo
      .createQueryBuilder('c')
      .select('c.institucion', 'institucion')
      .addSelect('COALESCE(SUM(c.monto), 0)::float', 'total')
      .addSelect('COUNT(*)::int', 'contratos')
      .where('c.canton_codigo = :cantonCodigo', { cantonCodigo })
      .groupBy('c.institucion')
      .orderBy('total', 'DESC')
      .getRawMany();
  }

  /** Monto contratado por mes para un cantón (para el timeline). */
  async porCantonMensual(
    cantonCodigo: string,
  ): Promise<{ mes: string; monto: number; contratos: number }[]> {
    return this.contratacionRepo
      .createQueryBuilder('c')
      .select("TO_CHAR(c.fecha, 'YYYY-MM')", 'mes')
      .addSelect('COALESCE(SUM(c.monto), 0)::float', 'monto')
      .addSelect('COUNT(*)::int', 'contratos')
      .where('c.canton_codigo = :cantonCodigo', { cantonCodigo })
      .groupBy('mes')
      .orderBy('mes', 'ASC')
      .getRawMany();
  }

  async conteoTotal(): Promise<number> {
    return this.contratacionRepo.count();
  }
}
