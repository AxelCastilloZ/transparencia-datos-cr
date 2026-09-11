import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatosAbiertosController } from './datos-abiertos.controller.js';
import { PronaeBeneficiario } from './datos-abiertos.entity.js';
import { DatosAbiertosService } from './datos-abiertos.services.js';


@Module({
    imports: [TypeOrmModule.forFeature([PronaeBeneficiario])],
    controllers: [DatosAbiertosController],
    providers: [DatosAbiertosService],
})
export class DatosAbiertosModule {}