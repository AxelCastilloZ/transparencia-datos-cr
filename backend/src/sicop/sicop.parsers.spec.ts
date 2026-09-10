import { describe, expect, it } from 'vitest';
import {
  normalizarTexto,
  parseFecha,
  parseMonto,
  partirZonaGeo,
  texto,
  ultimosMeses,
} from './sicop.parsers.js';

describe('parseMonto', () => {
  it('normaliza un monto con decimales del CSV', () => {
    expect(parseMonto('2059200.000000')).toBe('2059200.00');
  });
  it('quita separadores de miles', () => {
    expect(parseMonto('1,426,800.50')).toBe('1426800.50');
  });
  it('trata vacío, 0 y basura como null', () => {
    expect(parseMonto('')).toBeNull();
    expect(parseMonto('   ')).toBeNull();
    expect(parseMonto('0')).toBeNull();
    expect(parseMonto('0.000000')).toBeNull();
    expect(parseMonto('N/D')).toBeNull();
    expect(parseMonto(undefined)).toBeNull();
  });
});

describe('parseFecha', () => {
  it('recorta el timestamp de SICOP a YYYY-MM-DD', () => {
    expect(parseFecha('2026-01-05 17:39:03.0000000')).toBe('2026-01-05');
  });
  it('acepta una fecha ya recortada', () => {
    expect(parseFecha('2026-01-05')).toBe('2026-01-05');
  });
  it('devuelve null si no hay fecha válida', () => {
    expect(parseFecha('')).toBeNull();
    expect(parseFecha('  ')).toBeNull();
    expect(parseFecha('05/01/2026')).toBeNull();
    expect(parseFecha(null)).toBeNull();
  });
});

describe('texto', () => {
  it('recorta y limita longitud', () => {
    expect(texto('  hola  ', 10)).toBe('hola');
    expect(texto('abcdefghij', 4)).toBe('abcd');
  });
  it('cadena vacía → null', () => {
    expect(texto('   ', 5)).toBeNull();
    expect(texto(undefined, 5)).toBeNull();
  });
});

describe('normalizarTexto', () => {
  it('pasa a minúsculas y quita tildes', () => {
    expect(normalizarTexto('San José')).toBe('san jose');
    expect(normalizarTexto('LEÓN CORTÉS')).toBe('leon cortes');
    expect(normalizarTexto('  Vázquez de Coronado ')).toBe('vazquez de coronado');
  });
  it('un nombre sin tildes queda igual (así matchea con ZONA_GEO_INST)', () => {
    expect(normalizarTexto('San Jose')).toBe(normalizarTexto('San José'));
  });
});

describe('partirZonaGeo', () => {
  it('separa "distrito, cantón, provincia"', () => {
    expect(partirZonaGeo('Río Segundo, Alajuela, Alajuela')).toEqual({
      canton: 'Alajuela',
      provincia: 'Alajuela',
    });
  });
  it('toma los dos últimos tokens aunque haya comas de más', () => {
    expect(partirZonaGeo('Hospital, San Jose, San Jose')).toEqual({
      canton: 'San Jose',
      provincia: 'San Jose',
    });
  });
  it('null si no hay al menos cantón + provincia', () => {
    expect(partirZonaGeo('San Jose')).toBeNull();
    expect(partirZonaGeo('')).toBeNull();
    expect(partirZonaGeo(undefined)).toBeNull();
  });
});

describe('ultimosMeses', () => {
  it('devuelve n meses "AAAAMM" hacia atrás desde la fecha dada', () => {
    const hoy = new Date('2026-03-15T12:00:00Z');
    expect(ultimosMeses(4, hoy)).toEqual(['202603', '202602', '202601', '202512']);
  });
  it('cruza el año correctamente', () => {
    expect(ultimosMeses(2, new Date('2026-01-10T00:00:00Z'))).toEqual(['202601', '202512']);
  });
});
