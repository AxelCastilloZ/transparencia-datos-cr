import { Controller, Get, Param, Post } from '@nestjs/common';
import { TseService } from './tse.service.js';

@Controller('api/tse')
export class TseController {
  constructor(private readonly service: TseService) {}
  @Get('status') status() {
    return this.service.status();
  }
  @Get('resumen') resumen() {
    return this.service.resumen();
  }
  @Get('canton/:codigo') canton(@Param('codigo') codigo: string) {
    return this.service.resumen(codigo);
  }
  @Get('canton/:codigo/historico') historico(@Param('codigo') codigo: string) {
    return this.service.historico(codigo);
  }
  @Get('canton/:codigo/distritos') distritos(@Param('codigo') codigo: string) {
    return this.service.distritos(codigo);
  }
  @Post('sync') sync() {
    return this.service.sincronizar();
  }
}
