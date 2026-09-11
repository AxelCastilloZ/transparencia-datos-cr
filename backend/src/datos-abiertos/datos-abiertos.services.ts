import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { Repository } from 'typeorm';
import { PronaeBeneficiario } from './datos-abiertos.entity.js';


/**
 * Recurso XLSX oficial del "cuadro 1.4" — Personas beneficiarias del
 * PRONAE según modalidad de proyecto, 2021-2024. MTSS, vía el Portal
 * Nacional de Datos Abiertos de Costa Rica.
 *
 * @see https://datosabiertos.gob.go.cr/dataset/mtss-personas-beneficiarias-pronae-2021-2024
 */
const URL_DATASET =
    'https://datos.go.cr/dataset/0fbc63ce-6c11-4d4b-857a-0bf4dda4fe61/' +
    'resource/81d5cb32-1ffd-480a-98b5-261102995bb2/download/' +
    'cuadro-1.4-hannia-hernandez-gonzalez.xlsx';

    /**
     * El portal responde con timeout/bloqueo a peticiones sin encabezados de
     * navegador — no es una API pensada para consumo automatizado. Un
     * User-Agent realista es necesario, no cosmético.
     */
    const HTTP_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept: '*/*',
    };

    @Injectable()
    export class DatosAbiertosService {
    private readonly logger = new Logger(DatosAbiertosService.name);

    constructor(
        @InjectRepository(PronaeBeneficiario)
        private readonly pronaeRepo: Repository<PronaeBeneficiario>,
    ) {}

    /**
     * Cron: refresca el primer día de cada mes a las 3 AM.
     * La fuente es un reporte oficial que se actualiza con muy poca
     * frecuencia (a diferencia de OIJ/SICOP); mensual es más que suficiente.
     */
    @Cron('0 3 1 * *')
    async refrescarDatos(): Promise<void> {
        this.logger.log('Iniciando descarga de datos de PRONAE...');
        try {
        const resultado = await this.descargarYProcesar();
        this.logger.log(
            `Datos de PRONAE actualizados: ${resultado.insertados} registros.`,
        );
        } catch (error) {
        this.logger.error(
            'Error al refrescar datos de PRONAE — se mantiene el último dato cacheado.',
            error instanceof Error ? error.stack : error,
        );
        }
    }

    /**
     * Descarga el XLSX del PRONAE, lo aplana de formato cruzado
     * (modalidad x año) a una fila por (modalidad, año), y reemplaza
     * los datos existentes (full refresh — el dataset es pequeño).
     */
    async descargarYProcesar(): Promise<{ filasLeidas: number; insertados: number }> {
        const respuesta = await axios.get<ArrayBuffer>(URL_DATASET, {
        responseType: 'arraybuffer',
        timeout: 20_000,
        headers: HTTP_HEADERS,
        });

        const libro = XLSX.read(respuesta.data, { type: 'buffer' });
        const primeraHoja = libro.SheetNames[0];
        const filas: unknown[][] = XLSX.utils.sheet_to_json(libro.Sheets[primeraHoja], {
        header: 1,
        });

        const registros = this.aplanarTablaCruzada(filas);

        if (registros.length === 0) {
        this.logger.warn('No se obtuvieron registros del archivo. Se conservan datos previos.');
        return { filasLeidas: filas.length, insertados: 0 };
        }

        await this.pronaeRepo.clear();
        await this.pronaeRepo.save(registros);

        return { filasLeidas: filas.length, insertados: registros.length };
    }

    /**
     * Convierte la tabla cruzada (fila 0 = ["Modalidad", año1, año2, ...],
     * filas siguientes = [modalidad, valor1, valor2, ...]) a un arreglo de
     * entidades, una por cada combinación (modalidad, año).
     */
    private aplanarTablaCruzada(filas: unknown[][]): Partial<PronaeBeneficiario>[] {
        if (filas.length < 2) return [];

        const encabezado = filas[0];
        // Columnas 1..n del encabezado son los años, e.g. [2021, 2022, 2023, 2024]
        const anios = encabezado.slice(1).map((valor) => Number(valor));

        const registros: Partial<PronaeBeneficiario>[] = [];

        for (const fila of filas.slice(1)) {
        const modalidad = String(fila[0] ?? '').trim();
        if (!modalidad) continue;

        const esTotal = modalidad.toLowerCase() === 'total';

        anios.forEach((anio, indice) => {
            if (!Number.isFinite(anio)) return;
            const celda = fila[indice + 1];
            // La fuente usa "-" para "sin dato" — se guarda como null, no 0.
            const beneficiarios =
            celda === '-' || celda === undefined || celda === ''
                ? null
                : Number(celda);

            registros.push({
            modalidad,
            anio,
            beneficiarios: beneficiarios !== null && Number.isFinite(beneficiarios) ? beneficiarios : null,
            esTotal,
            });
        });
        }

        return registros;
    }

    // ─── Métodos de consulta para el controller ───────────────────────

    /** Todas las modalidades reales (excluye la fila "Total"), opcionalmente filtradas por año. */
    async porModalidad(anio?: number): Promise<PronaeBeneficiario[]> {
        const qb = this.pronaeRepo
        .createQueryBuilder('p')
        .where('p.es_total = false')
        .orderBy('p.beneficiarios', 'DESC', 'NULLS LAST');

        if (anio) qb.andWhere('p.anio = :anio', { anio });

        return qb.getMany();
    }

    /** Evolución anual usando la fila oficial "Total" (no recalculada). */
    async porAnio(): Promise<{ anio: number; total: number | null }[]> {
        const filas = await this.pronaeRepo.find({
        where: { esTotal: true },
        order: { anio: 'ASC' },
        });
        return filas.map((f) => ({ anio: f.anio, total: f.beneficiarios }));
    }

    /** Indicadores para las tarjetas KPI del dashboard. */
    async resumen(): Promise<{
        totalUltimoAnio: number | null;
        anioMasReciente: number | null;
        anioConMayorTotal: number | null;
        modalidadPrincipalUltimoAnio: string | null;
    }> {
        const totales = await this.porAnio();
        if (totales.length === 0) {
        return {
            totalUltimoAnio: null,
            anioMasReciente: null,
            anioConMayorTotal: null,
            modalidadPrincipalUltimoAnio: null,
        };
        }

        const ultimo = totales[totales.length - 1];
        const mayor = totales.reduce((a, b) => ((b.total ?? -1) > (a.total ?? -1) ? b : a));
        const modalidadesUltimoAnio = await this.porModalidad(ultimo.anio);

        return {
        totalUltimoAnio: ultimo.total,
        anioMasReciente: ultimo.anio,
        anioConMayorTotal: mayor.anio,
        modalidadPrincipalUltimoAnio: modalidadesUltimoAnio[0]?.modalidad ?? null,
        };
    }

    /** Conteo total de registros (para health check). */
    async conteoTotal(): Promise<number> {
        return this.pronaeRepo.count();
    }
}