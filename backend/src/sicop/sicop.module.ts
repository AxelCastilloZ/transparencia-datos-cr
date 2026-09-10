import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Canton } from '../cantones/canton.entity.js';
import { Contratacion } from './contratacion.entity.js';
import { SicopController } from './sicop.controller.js';
import { SicopService } from './sicop.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Contratacion, Canton])],
  controllers: [SicopController],
  providers: [SicopService],
})
export class SicopModule {}
