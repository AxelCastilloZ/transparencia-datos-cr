import axios from 'axios';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { ConfigService } from '@nestjs/config';
import { zipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANTONES_CR } from '../cantones/cantones-seed.js';
import { TseService } from './tse.service.js';
import type { Repository } from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';
import { TsePadronCantonal } from './tse-padron-cantonal.entity.js';
import { TsePadronDistrital } from './tse-padron-distrital.entity.js';

afterEach(() => vi.restoreAllMocks());
const tempFolders = async () =>
  (await readdir(tmpdir()))
    .filter((n) => n.startsWith('transparencia-tse-'))
    .sort();
function fixture(complete = true) {
  const cantones = complete ? CANTONES_CR : CANTONES_CR.slice(1);
  return Buffer.from(
    zipSync({
      'PADRON_COMPLETO.TXT': Buffer.from(
        cantones
          .map(
            (c) =>
              `000000000,${c.codigo}001, ,20990101,00000,PERSONA SINTETICA,PRUEBA,PRUEBA`,
          )
          .join('\r\n'),
        'latin1',
      ),
      'DISTELEC.TXT': Buffer.from(
        cantones
          .map((c) => `${c.codigo}001,PROVINCIA,CANTON,DISTRITO SINTETICO`)
          .join('\r\n'),
        'latin1',
      ),
      'LEAME.TXT': Buffer.from('DOCUMENTACION SINTETICA'),
    }),
  );
}
function setup(
  zip: Buffer,
  hash = createHash('sha256').update(zip).digest('hex'),
) {
  vi.spyOn(axios, 'get').mockResolvedValue({
    data: Readable.from([zip.subarray(0, 30), zip.subarray(30)]),
  });
  return new TseService(
    {} as Repository<TsePadronCantonal>,
    {} as Repository<TsePadronDistrital>,
    {} as Repository<Canton>,
    new ConfigService({ TSE_FECHA_CORTE: '2026-08-31', TSE_ZIP_SHA256: hash }),
  );
}
describe('TSE ZIP sintético completo', () => {
  it('descarga, valida, agrega 84 cantones y elimina temporales', async () => {
    const before = await tempFolders();
    const result = await setup(fixture()).descargarAgregados(
      new Set(CANTONES_CR.map((c) => c.codigo)),
    );
    expect(result.conteos.size).toBe(84);
    expect([...result.conteos.values()].reduce((a, b) => a + b, 0)).toBe(84);
    expect(await tempFolders()).toEqual(before);
  });
  it('rechaza hash diferente y limpia temporales', async () => {
    const before = await tempFolders();
    await expect(
      setup(fixture(), '0'.repeat(64)).descargarAgregados(
        new Set(CANTONES_CR.map((c) => c.codigo)),
      ),
    ).rejects.toThrow('no corresponde');
    expect(await tempFolders()).toEqual(before);
  });
  it('rechaza cobertura incompleta y limpia temporales', async () => {
    const before = await tempFolders();
    await expect(
      setup(fixture(false)).descargarAgregados(
        new Set(CANTONES_CR.map((c) => c.codigo)),
      ),
    ).rejects.toThrow('Cobertura');
    expect(await tempFolders()).toEqual(before);
  });
});
