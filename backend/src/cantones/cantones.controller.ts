import { Controller, Get, Param } from '@nestjs/common';
import { CantonesService } from './cantones.service.js';

@Controller('api/cantones')
export class CantonesController {
  constructor(private readonly cantonesService: CantonesService) {}

  /** GET /api/cantones — lista los 84 cantones */
  @Get()
  findAll() {
    return this.cantonesService.findAll();
  }

  /** GET /api/cantones/:codigo — un cantón por código */
  @Get(':codigo')
  findOne(@Param('codigo') codigo: string) {
    return this.cantonesService.findByCodigo(codigo);
  }
}
