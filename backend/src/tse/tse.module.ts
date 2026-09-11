import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CantonesModule } from '../cantones/cantones.module.js';
import { TsePadronCantonal } from './tse-padron-cantonal.entity.js';
import { TsePadronDistrital } from './tse-padron-distrital.entity.js';
import { TseService } from './tse.service.js';
import { TseController } from './tse.controller.js';

@Module({
  imports: [
    CantonesModule,
    TypeOrmModule.forFeature([TsePadronCantonal, TsePadronDistrital]),
  ],
  providers: [TseService],
  controllers: [TseController],
})
export class TseModule {}
