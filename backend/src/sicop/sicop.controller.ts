import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SicopService } from './sicop.service.js';

@Controller('api/sicop')
export class SicopController {
  constructor(private readonly sicopService: SicopService) {}

  /**
   * GET /api/sicop/status
   * Health check — conteo total de órdenes y cuántas tienen cantón resuelto.
   */
  @Get('status')
  async status() {
    const { registros, conCanton } = await this.sicopService.resumenGeneral();
    return {
      fuente: 'SICOP — Órdenes de pedido (vía Observatorio de Compra Pública)',
      registros,
      conCanton,
    };
  }

  /**
   * GET /api/sicop/proveedores
   * Ranking de proveedores por monto. Query: q, desde, hasta, limit, canton
   */
  @Get('proveedores')
  proveedores(
    @Query('q') q?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
    @Query('canton') canton?: string,
  ) {
    return this.sicopService.topProveedores({
      q,
      desde,
      hasta,
      cantonCodigo: canton,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/sicop/instituciones
   * Ranking de instituciones compradoras por monto. Query: desde, hasta, limit, canton
   */
  @Get('instituciones')
  instituciones(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
    @Query('canton') canton?: string,
  ) {
    return this.sicopService.topInstituciones({
      desde,
      hasta,
      cantonCodigo: canton,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /api/sicop/mensual
   * Gasto agregado por mes. Query: desde, hasta, canton
   */
  @Get('mensual')
  mensual(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('canton') canton?: string,
  ) {
    return this.sicopService.gastoMensual({ desde, hasta, cantonCodigo: canton });
  }

  /**
   * GET /api/sicop/canton/:codigo
   * Órdenes de pedido de instituciones de un cantón.
   * Query: desde, hasta, limit, offset
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

  /** GET /api/sicop/canton/:codigo/mensual — gasto por mes del cantón */
  @Get('canton/:codigo/mensual')
  mensualPorCanton(@Param('codigo') codigo: string) {
    return this.sicopService.gastoMensual({ cantonCodigo: codigo });
  }

  /** GET /api/sicop/canton/:codigo/instituciones — compradoras del cantón */
  @Get('canton/:codigo/instituciones')
  institucionesPorCanton(@Param('codigo') codigo: string, @Query('limit') limit?: string) {
    return this.sicopService.topInstituciones({
      cantonCodigo: codigo,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * POST /api/sicop/sync
   * Ingesta manual. Query: meses=202601,202512 para cargar meses puntuales.
   */
  @Post('sync')
  async sync(@Query('meses') meses?: string) {
    const lista = meses?.split(',').map((m) => m.trim()).filter(Boolean);
    const r = await this.sicopService.descargarYProcesar(lista);
    return { mensaje: 'Sincronización completada', ...r };
  }
}
