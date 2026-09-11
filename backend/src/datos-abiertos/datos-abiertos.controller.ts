import { Controller, Get, Post, Query } from '@nestjs/common';
import { DatosAbiertosService } from './datos-abiertos.services.js';


@Controller('api/datos-abiertos')
export class DatosAbiertosController {
    constructor(private readonly datosAbiertosService: DatosAbiertosService) {}

    /**
     * GET /api/datos-abiertos/pronae
     * Registros por modalidad (excluye la fila "Total").
     * Query param opcional: anio
     */
    @Get('pronae')
    porModalidad(@Query('anio') anio?: string) {
        return this.datosAbiertosService.porModalidad(anio ? parseInt(anio, 10) : undefined);
    }

    /**
     * GET /api/datos-abiertos/pronae/anual
     * Evolución del total de beneficiarios por año.
     */
    @Get('pronae/anual')
    porAnio() {
        return this.datosAbiertosService.porAnio();
    }

    /**
     * GET /api/datos-abiertos/pronae/resumen
     * Indicadores agregados para las tarjetas KPI del dashboard.
     */
    @Get('pronae/resumen')
    resumen() {
        return this.datosAbiertosService.resumen();
    }

    /**
     * GET /api/datos-abiertos/status
     * Health check — conteo total de registros en la base.
     */
    @Get('status')
    async status() {
        const total = await this.datosAbiertosService.conteoTotal();
        return {
        fuente: 'MTSS — Personas beneficiarias del PRONAE (Portal Nacional de Datos Abiertos)',
        registros: total,
        };
    }

    /**
     * POST /api/datos-abiertos/sync
     * Dispara manualmente la descarga e ingesta de datos.
     * Útil para la primera carga y para demos.
     */
    @Post('sync')
    async sync() {
        const resultado = await this.datosAbiertosService.descargarYProcesar();
        return {
        mensaje: 'Sincronización completada',
        ...resultado,
        };
    }
}