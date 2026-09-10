import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SicopService } from './sicop.service.js';

@Controller('api/sicop')
export class SicopController {
  constructor(private readonly sicopService: SicopService) {}

  /**
   * GET /api/sicop/canton/:codigo
   * Contrataciones públicas de un cantón.
   * Query params opcionales: desde, hasta, limit, offset
   */
  @Get('canton/:codigo')
  porCanton(
    @Param('codigo') codigo: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.sicopService.porCanton(codigo, {
      desde,
      hasta,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  /**
   * GET /api/sicop/canton/:codigo/resumen
   * Monto total contratado agrupado por institución.
   */
  @Get('canton/:codigo/resumen')
  resumen(@Param('codigo') codigo: string) {
    return this.sicopService.resumenPorCanton(codigo);
  }

  /**
   * GET /api/sicop/canton/:codigo/mensual
   * Monto contratado por mes (para el timeline).
   */
  @Get('canton/:codigo/mensual')
  mensual(@Param('codigo') codigo: string) {
    return this.sicopService.porCantonMensual(codigo);
  }

  /**
   * GET /api/sicop/status
   * Health check — conteo total de registros en la base.
   */
  @Get('status')
  async status() {
    const total = await this.sicopService.conteoTotal();
    return { fuente: 'SICOP — Contratación Pública', registros: total };
  }

  /**
   * POST /api/sicop/sync
   * Dispara manualmente la descarga e ingesta de datos.
   */
  @Post('sync')
  async sync() {
    const resultado = await this.sicopService.descargarYProcesar();
    return { mensaje: 'Sincronización completada', ...resultado };
  }
}
