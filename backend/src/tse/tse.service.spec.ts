import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';
import { TsePadronCantonal } from './tse-padron-cantonal.entity.js';
import { TsePadronDistrital } from './tse-padron-distrital.entity.js';
import { TseService } from './tse.service.js';

function setup() {
  let rows: Record<string, unknown>[] = [
    { fechaCorte: '2026-07-31', cantonCodigo: '101', total: 1 },
  ];
  const manager = {
    query: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(
      async (entity: unknown, incoming: Record<string, unknown>[]) => {
        if (entity === TsePadronCantonal)
          for (const row of incoming) {
            rows = rows.filter(
              (old) =>
                old.fechaCorte !== row.fechaCorte ||
                old.cantonCodigo !== row.cantonCodigo,
            );
            rows.push(row);
          }
      },
    ),
  };
  const transaction = vi.fn(
    async (cb: (m: typeof manager) => Promise<void>) => {
      const before = [...rows];
      try {
        await cb(manager);
      } catch (e) {
        rows = before;
        throw e;
      }
    },
  );
  const service = new TseService(
    { manager: { transaction } } as unknown as Repository<TsePadronCantonal>,
    {} as Repository<TsePadronDistrital>,
    { find: async () => [{ codigo: '101' }] } as Repository<Canton>,
    new ConfigService(),
  );
  const download = vi.spyOn(service, 'descargarAgregados').mockResolvedValue({
    fechaCorte: '2026-08-31',
    exterior: 0,
    conteos: new Map([['101001', 2]]),
    distritos: new Map([
      [
        '101001',
        {
          distritoCodigo: '101001',
          cantonCodigo: '101',
          distrito: 'SINTETICO',
        },
      ],
    ]),
  });
  return { service, transaction, manager, download, rows: () => rows };
}
describe('TSE snapshots', () => {
  it('conserva meses previos y repetir un corte no duplica conteos', async () => {
    const s = setup();
    await s.service.sincronizar();
    await s.service.sincronizar();
    expect(s.rows()).toHaveLength(2);
    expect(s.rows().map((r) => r.total)).toEqual([1, 2]);
    expect(s.manager.delete).toHaveBeenCalledWith(TsePadronDistrital, {
      fechaCorte: '2026-08-31',
    });
  });
  it('no inicia una transacción si falla la descarga o validación', async () => {
    const s = setup();
    s.download.mockRejectedValue(new Error('DETALLE SINTETICO PRIVADO'));
    await expect(s.service.sincronizar()).rejects.toThrow('se conservan');
    await expect(s.service.sincronizar()).rejects.not.toThrow('DETALLE SINTETICO PRIVADO');
    expect(s.transaction).not.toHaveBeenCalled();
    expect(s.rows()).toHaveLength(1);
  });
  it('revierte el corte completo si falla la escritura distrital', async () => {
    const s = setup();
    s.manager.delete.mockRejectedValue(new Error('fallo SQL'));
    await expect(s.service.sincronizar()).rejects.toThrow('se conservan');
    expect(s.rows()).toEqual([
      { fechaCorte: '2026-07-31', cantonCodigo: '101', total: 1 },
    ]);
  });
  it('impide sincronizaciones simultáneas y libera el bloqueo tras un fallo', async () => {
    const s = setup();
    let reject!: (e: Error) => void;
    s.download.mockReturnValueOnce(
      new Promise((_resolve, r) => {
        reject = r;
      }),
    );
    const first = s.service.sincronizar();
    await expect(s.service.sincronizar()).rejects.toThrow('en curso');
    await Promise.resolve();
    reject(new Error('fallo'));
    await expect(first).rejects.toThrow('se conservan');
    await expect(s.service.sincronizar()).resolves.toHaveProperty('total', 2);
  });
});
