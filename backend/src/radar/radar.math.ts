import { BadRequestException } from '@nestjs/common';
import type { Cobertura, Compra, MontoMoneda, Periodo } from './radar.types.js';

export const REGLAS = Object.freeze({
  minCantones: 5,
  incrementoPct: 25,
  incrementoAbsoluto: 20,
  minAnterior: 20,
  principalPct: 50,
  topCincoPct: 80,
  minOrdenes: 20,
  minProveedoresTop: 6,
  coberturaPct: 80,
  electoresTopTresPct: 60,
  minDistritos: 4,
  historiaMeses: 6,
  madFactor: 3,
  minCambioOrdenes: 20,
});
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const inicioMes = (s: string) => s.slice(0, 7) + '-01';
export function moverMes(s: string, n: number) {
  const d = new Date(inicioMes(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d);
}
export function finMes(s: string) {
  return iso(new Date(new Date(moverMes(s, 1)).getTime() - 86400000));
}
export function validarFecha(s?: string) {
  if (
    s !== undefined &&
    (typeof s !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
      !Number.isFinite(Date.parse(s)) ||
      iso(new Date(s)) !== s ||
      s < '1900-01-01' ||
      s > '2100-12-31')
  )
    throw new BadRequestException(
      'Fecha inválida: use YYYY-MM-DD (1900–2100).',
    );
}
export function mesesCompletos(
  desde: string,
  hasta: string,
  hoy: string,
): string[] {
  const meses: string[] = [];
  for (let m = inicioMes(desde); m <= hasta; m = moverMes(m, 1)) {
    if (m >= desde && finMes(m) <= hasta && finMes(m) < inicioMes(hoy))
      meses.push(m.slice(0, 7));
  }
  return meses;
}
export function periodo(
  desde: string | undefined,
  hasta: string | undefined,
  ultima: string | null,
  hoy: string,
): Periodo {
  validarFecha(desde);
  validarFecha(hasta);
  // El mes terminal observado se excluye salvo que haya datos hasta su último día.
  const limite = ultima && ultima < hoy ? ultima : hoy;
  const cierre =
    ultima && limite === finMes(limite) && limite < inicioMes(hoy)
      ? limite
      : finMes(moverMes(limite, -1));
  const h = hasta ?? cierre;
  const d = desde ?? moverMes(h, -5);
  if (d > h)
    throw new BadRequestException('desde debe ser anterior o igual a hasta.');
  return {
    desde: d,
    hasta: h,
    mesesCompletos: mesesCompletos(d, h, hoy).length,
  };
}
export function mediana(values: number[]): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
}
export const razon = (n: number | null, d: number | null) =>
  n !== null && d !== null && d > 0 ? (n / d) * 1000 : null;
export const variacion = (actual: number | null, anterior: number | null) =>
  actual !== null && anterior !== null && anterior > 0
    ? ((actual - anterior) / anterior) * 100
    : null;
export function cubre(c: Cobertura | null, p: Periodo): boolean {
  if (!c?.desde || !c.hasta || c.desde > p.desde || c.hasta < p.hasta)
    return false;
  for (let m = inicioMes(p.desde); m <= p.hasta; m = moverMes(m, 1))
    if (!c.meses.includes(m.slice(0, 7))) return false;
  return true;
}
export function montos(rows: Compra[]): MontoMoneda[] {
  return [...new Set(rows.flatMap((r) => (r.moneda ? [r.moneda] : [])))]
    .sort()
    .map((moneda) => {
      const grupo = rows.filter((r) => r.moneda === moneda);
      const validos = grupo.reduce((s, r) => s + r.validos, 0);
      const monto = validos
        ? grupo.reduce((s, r) => s + (r.monto ?? 0), 0)
        : null;
      const proveedores = new Map<string, number>();
      for (const r of grupo)
        if (r.proveedor)
          proveedores.set(
            r.proveedor,
            (proveedores.get(r.proveedor) ?? 0) + (r.monto ?? 0),
          );
      const valores = [...proveedores.values()].sort((a, b) => b - a);
      const ordenes = grupo.reduce((s, r) => s + r.ordenes, 0);
      const completo =
        monto !== null &&
        monto > 0 &&
        validos === ordenes &&
        grupo.every((r) => r.proveedor !== null);
      return {
        moneda,
        monto,
        ordenes,
        ordenesConMonto: validos,
        principal: completo ? (valores[0] / monto) * 100 : null,
        topCinco: completo
          ? (valores.slice(0, 5).reduce((s, n) => s + n, 0) / monto) * 100
          : null,
      };
    });
}
export function atipico(actual: number, historia: number[]): boolean {
  if (historia.length < REGLAS.historiaMeses) return false;
  const base = mediana(historia)!;
  const mad = mediana(historia.map((n) => Math.abs(n - base)))!;
  // MAD cero no proporciona escala robusta; no se fuerza una alerta.
  return (
    mad > 0 &&
    actual - base >= REGLAS.minCambioOrdenes &&
    actual > base + REGLAS.madFactor * 1.4826 * mad
  );
}
