import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { Canton } from './cantones/canton.entity.js';
import { CantonesModule } from './cantones/cantones.module.js';
import { EstadisticaPolicial } from './judicial/estadistica-policial.entity.js';
import { JudicialModule } from './judicial/judicial.module.js';
import { Contratacion } from './sicop/contratacion.entity.js';
import { SicopModule } from './sicop/sicop.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CantonesModule,
    JudicialModule,
    SicopModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false },
        entities: [Canton, EstadisticaPolicial, Contratacion],
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
