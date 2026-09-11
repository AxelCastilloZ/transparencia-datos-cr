import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { Canton } from './canton.entity.js';
import { CANTONES_CR } from './cantones-seed.js';
import { CantonesService } from './cantones.service.js';

describe('Seed cantones', () => {
  it('contiene 84 códigos únicos y los cantones nuevos correctos', () => {
    expect(CANTONES_CR).toHaveLength(84);
    expect(new Set(CANTONES_CR.map((c) => c.codigo)).size).toBe(84);
    expect(CANTONES_CR.find((c) => c.codigo === '612')?.nombre).toBe(
      'Monteverde',
    );
    expect(CANTONES_CR.find((c) => c.codigo === '613')?.nombre).toBe(
      'Puerto Jiménez',
    );
    expect(new Set(CANTONES_CR.map((c) => c.provincia)).size).toBe(7);
  });
  it.each([null, { nombre: 'Puerto Jiménez' }, { nombre: 'Monteverde' }])(
    'reconcilia tabla vacía o existente: %j',
    async (legacy) => {
      const builder = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn(),
      };
      const manager = {
        query: vi.fn(),
        findOneBy: vi.fn().mockResolvedValue(legacy),
        upsert: vi.fn(),
        createQueryBuilder: () => builder,
        connection: {
          entityMetadatas: [
            {
              target: 'hechos',
              foreignKeys: [
                {
                  referencedEntityMetadata: { target: Canton },
                  columns: [{ propertyName: 'cantonCodigo' }],
                },
              ],
            },
          ],
        },
      };
      const repo = {
        manager: {
          transaction: (cb: (m: typeof manager) => Promise<void>) =>
            cb(manager),
        },
      };
      await new CantonesService(
        repo as unknown as Repository<Canton>,
      ).onModuleInit();
      expect(manager.upsert).toHaveBeenLastCalledWith(Canton, CANTONES_CR, [
        'codigo',
      ]);
      expect(builder.execute).toHaveBeenCalledTimes(
        legacy?.nombre === 'Puerto Jiménez' ? 1 : 0,
      );
      if (legacy?.nombre === 'Puerto Jiménez') {
        expect(builder.set).toHaveBeenCalledWith({ cantonCodigo: '613' });
        expect(builder.where).toHaveBeenCalledWith({ cantonCodigo: '612' });
      }
    },
  );
});
