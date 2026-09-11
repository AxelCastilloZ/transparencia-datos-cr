import { Controller, Get, Param, Query } from '@nestjs/common';
import { RadarService } from './radar.service.js';
@Controller('api/radar')
export class RadarController {
  constructor(private readonly service: RadarService) {}
  @Get('canton/:codigo')
  canton(
    @Param('codigo') codigo: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.canton(codigo, desde, hasta);
  }
}
