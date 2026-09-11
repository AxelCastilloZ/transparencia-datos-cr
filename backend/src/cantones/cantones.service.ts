import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Canton } from './canton.entity.js';
import { CANTONES_CR } from './cantones-seed.js';

@Injectable()
export class CantonesService implements OnModuleInit {
  private readonly logger = new Logger(CantonesService.name);

  constructor(
    @InjectRepository(Canton)
    private readonly cantonRepo: Repository<Canton>,
  ) {}

  /**
   * Reconcilia los 84 cantones también en instalaciones existentes.
   */
  async onModuleInit(): Promise<void> {
    await this.cantonRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(840612)');
      const legacy = await manager.findOneBy(Canton, { codigo: '612' });
      await manager.upsert(
        Canton,
        CANTONES_CR.filter((c) => c.codigo === '613'),
        ['codigo'],
      );
      if (legacy?.nombre === 'Puerto Jiménez') {
        // Preservar las referencias existentes antes de asignar 612 a Monteverde.
        for (const meta of manager.connection.entityMetadatas) {
          for (const fk of meta.foreignKeys) {
            if (
              fk.referencedEntityMetadata.target === Canton &&
              fk.columns.length === 1
            ) {
              const column = fk.columns[0].propertyName;
              await manager
                .createQueryBuilder()
                .update(meta.target)
                .set({ [column]: '613' })
                .where({ [column]: '612' })
                .execute();
            }
          }
        }
      }
      await manager.upsert(Canton, CANTONES_CR, ['codigo']);
    });
    this.logger.log('Seed de cantones completado.');
  }

  async findAll(): Promise<Canton[]> {
    return this.cantonRepo.find({ order: { codigo: 'ASC' } });
  }

  async findByCodigo(codigo: string): Promise<Canton | null> {
    return this.cantonRepo.findOneBy({ codigo });
  }

  async findByProvincia(provincia: string): Promise<Canton[]> {
    return this.cantonRepo.find({
      where: { provincia },
      order: { codigo: 'ASC' },
    });
  }
}
