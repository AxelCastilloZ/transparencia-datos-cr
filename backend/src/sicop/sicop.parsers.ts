/**
 * Funciones puras de normalización de los CSV de SICOP.
 * Separadas del service para poder testearlas sin instanciar Nest/TypeORM.
 */

/** "2059200.000000" → "2059200.00"; vacío / "0" / no numérico → null. */
export function parseMonto(v: string | undefined | null): string | null {
  const t = (v ?? '').trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n !== 0 ? n.toFixed(2) : null;
}

/** "2026-01-05 17:39:03.0000000" → "2026-01-05"; sin fecha válida → null. */
export function parseFecha(v: string | undefined | null): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((v ?? '').trim());
  return m ? m[1] : null;
}

/** Recorta y limita longitud; cadena vacía → null. */
export function texto(v: string | undefined | null, max: number): string | null {
  const t = (v ?? '').trim();
  return t.length ? t.substring(0, max) : null;
}

/** Minúsculas sin tildes, para comparar nombres de cantón / provincia. */
export function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * ZONA_GEO_INST viene como "distrito, cantón, provincia" (sin tildes).
 * Devuelve { canton, provincia } o null si no se puede separar.
 */
export function partirZonaGeo(
  zona: string | undefined | null,
): { canton: string; provincia: string } | null {
  const partes = (zona ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length < 2) return null;
  return {
    canton: partes[partes.length - 2],
    provincia: partes[partes.length - 1],
  };
}

/** ["202609","202608",...] — últimos n meses "AAAAMM" incluyendo el de `hoy`. */
export function ultimosMeses(n: number, hoy: Date = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(hoy.getTime());
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}
