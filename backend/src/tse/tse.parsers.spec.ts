import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  agregarPadron,
  fechaPublicacion,
  lineas,
  parseDistrito,
  parsePadron,
  verificarEntrada,
} from './tse.parsers.js';

// Identificadores y textos deliberadamente sintéticos; ninguna muestra de electores reales.
const fila = (code = '101001') =>
  `000000000,${code}, ,20990101,00000,PERSONA SINTETICA,PRUEBA,PRUEBA`;
const stream = (text: string) => Readable.from([Buffer.from(text, 'latin1')]);
const catalogo = new Map(
  ['101001', '801001'].map((code) => [
    code,
    parseDistrito(`${code},PROVINCIA,CANTON,DISTRITO SINTETICO`),
  ]),
);

describe('TSE parsers', () => {
  it('solo devuelve CODELEC', () => expect(parsePadron(fila())).toBe('101001'));
  it.each(['10101', '101000', 'x01001', '999999'])(
    'rechaza CODELEC inválido %s',
    (code) => expect(() => parsePadron(fila(code))).toThrow(),
  );
  it('rechaza campos de más y longitudes excesivas sin filtrar contenido', () => {
    expect(() => parsePadron(fila() + ',EXTRA')).toThrow('Estructura');
    expect(() =>
      parsePadron(fila().replace('PERSONA SINTETICA', 'X'.repeat(31))),
    ).toThrow('Estructura');
    try {
      parsePadron('CONTENIDO SINTETICO PRIVADO');
    } catch (e) {
      expect(String(e)).not.toContain('CONTENIDO');
    }
  });
  it('decodifica Windows-1252 incrementalmente con CRLF y última línea sin salto', async () => {
    const lines = [];
    for await (const line of lineas(
      Readable.from([Buffer.from([0xc1, 13]), Buffer.from([10, 0x80])]),
    ))
      lines.push(line);
    expect(lines).toEqual(['Á', '€']);
  });
  it('limita líneas y archivos', async () => {
    await expect(
      Array.fromAsync(lineas(stream('X'.repeat(1025)))),
    ).rejects.toThrow('Línea');
    await expect(Array.fromAsync(lineas(stream('abc'), 2))).rejects.toThrow(
      'Archivo',
    );
  });
  it('resuelve el nombre de distrito sin usar distritos administrativos', () => {
    expect(
      parseDistrito('612001,PUNTARENAS,MONTEVERDE,DISTRITO SINTÉTICO  ')
        .distrito,
    ).toBe('DISTRITO SINTÉTICO');
    expect(
      parseDistrito('612001,PROVINCIA,CANTON,DISTRITO (A,B)').distrito,
    ).toBe('DISTRITO (A,B)');
  });
  it('agrega sin conservar campos individuales y separa exterior', async () => {
    const result = await agregarPadron(
      stream([fila(), fila(), fila('801001')].join('\n')),
      catalogo,
      new Set(['101']),
    );
    expect([...result.conteos]).toEqual([['101001', 2]]);
    expect(result.exterior).toBe(1);
    expect(JSON.stringify(result)).not.toContain('PERSONA');
  });
  it('rechaza distrito y cantón desconocidos y archivo vacío', async () => {
    await expect(
      agregarPadron(stream(fila('102001')), catalogo, new Set(['101'])),
    ).rejects.toThrow('Distrito desconocido');
    await expect(
      agregarPadron(stream(fila()), catalogo, new Set(['102'])),
    ).rejects.toThrow('Cantón desconocido');
    await expect(
      agregarPadron(stream(''), catalogo, new Set(['101'])),
    ).rejects.toThrow('vacío');
  });
  it('obtiene corte real del portal y valida fechas', () => {
    expect(fechaPublicacion('<h1>actualizado al 31 de agosto 2026</h1>')).toBe(
      '2026-08-31',
    );
    expect(() =>
      fechaPublicacion('actualizado al 31 de febrero 2026'),
    ).toThrow();
    expect(() => fechaPublicacion('sin fecha')).toThrow();
  });
  it('verifica CRC y truncación aunque el texto sea parseable', async () => {
    expect(
      await Array.fromAsync(
        verificarEntrada(stream('123456789'), 9, 0xcbf43926),
      ),
    ).toHaveLength(1);
    await expect(
      Array.fromAsync(verificarEntrada(stream('123456789'), 10, 0xcbf43926)),
    ).rejects.toThrow('Integridad');
    await expect(
      Array.fromAsync(verificarEntrada(stream('123456788'), 9, 0xcbf43926)),
    ).rejects.toThrow('Integridad');
  });
});
