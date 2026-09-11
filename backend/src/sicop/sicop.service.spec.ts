import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { SicopService } from './sicop.service.js';
import type { Contratacion } from './contratacion.entity.js';
import type { Canton } from '../cantones/canton.entity.js';

describe('Indicadores monetarios SICOP heredados', () => {
  it.each(['topProveedores', 'topInstituciones', 'gastoMensual'] as const)(
    '%s restringe el agregado a CRC conocido antes de sumar',
    async (metodo) => {
      const qb = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
      };
      const service = new SicopService(
        { createQueryBuilder: () => qb } as unknown as Repository<Contratacion>,
        {} as Repository<Canton>,
      );
      await service[metodo]({
        desde: '2026-03-01',
        hasta: '2026-08-31',
        cantonCodigo: '101',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        "UPPER(TRIM(c.moneda)) = 'CRC' AND c.monto_orden >= 0",
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'c.fecha_elaboracion >= :desde',
        { desde: '2026-03-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('c.canton_codigo = :cc', {
        cc: '101',
      });
      expect(qb.getRawMany).toHaveBeenCalledOnce();
    },
  );
});
