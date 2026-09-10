import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  api,
  type GastoMensual,
  type InstitucionRanking,
  type ProveedorRanking,
} from '../api';

/** ₡ compacto: 49_400_000_000 → "₡49,4 mil M" */
function colones(n: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}
function colonesExacto(n: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(n);
}
function acortar(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

interface Props {
  /** Código de cantón para acotar los datos. Vacío = datos nacionales. */
  canton?: string;
  cantonNombre?: string;
}

/**
 * Panel de Contratación Pública (SICOP).
 * Fuente: SICOP vía la zona de descarga masiva del Observatorio de Compra
 * Pública (Ministerio de Hacienda).
 */
export function SicopPanel({ canton, cantonNombre }: Props) {
  const [ranking, setRanking] = useState<ProveedorRanking[]>([]);
  const [instituciones, setInstituciones] = useState<InstitucionRanking[]>([]);
  const [mensual, setMensual] = useState<GastoMensual[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [conCanton, setConCanton] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');

  const ambito = canton ? { canton } : undefined;

  // Carga: status (solo nacional) + mensual + instituciones
  useEffect(() => {
    let vivo = true;
    setLoading(true);
    Promise.all([
      canton ? Promise.resolve(null) : api.sicop.status(),
      api.sicop.mensual(ambito),
      api.sicop.instituciones({ ...ambito, limit: 8 }),
    ])
      .then(([st, men, inst]) => {
        if (!vivo) return;
        if (st) {
          setTotal(st.registros);
          setConCanton(st.conCanton);
        }
        setMensual(men);
        setInstituciones(inst);
      })
      .catch(() => vivo && setError(true))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canton]);

  // Ranking de proveedores — al montar y en cada búsqueda / cambio de cantón
  useEffect(() => {
    let vivo = true;
    api.sicop
      .proveedores({ ...ambito, q: q || undefined, limit: 10 })
      .then((prov) => vivo && setRanking(prov))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, canton]);

  const barData = useMemo(
    () => ranking.map((r) => ({ ...r, nombre: acortar(r.proveedor, 40) })),
    [ranking],
  );
  const montoPeriodo = useMemo(() => mensual.reduce((s, m) => s + m.monto, 0), [mensual]);
  const ordenesPeriodo = useMemo(() => mensual.reduce((s, m) => s + m.ordenes, 0), [mensual]);
  const periodo =
    mensual.length > 0 ? `${mensual[0].mes} – ${mensual[mensual.length - 1].mes}` : '—';

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
        No se pudieron cargar los datos de SICOP. El backend puede no tener datos
        aún — corré <code className="text-sm">POST /api/sicop/sync</code>.
      </div>
    );
  }

  const alcance = canton
    ? `Instituciones de ${cantonNombre ?? 'este cantón'}`
    : 'Datos nacionales';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Contratación pública — SICOP</h2>
        <p className="text-sm text-gray-500">
          Órdenes de pedido de instituciones públicas · Fuente: SICOP vía
          Observatorio de Compra Pública · {alcance}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {canton ? (
          <Stat
            label="Órdenes del cantón"
            value={loading ? '…' : ordenesPeriodo.toLocaleString('es-CR')}
          />
        ) : (
          <Stat
            label="Órdenes en la base"
            value={loading ? '…' : (total ?? 0).toLocaleString('es-CR')}
          />
        )}
        <Stat label="Monto del período" value={loading ? '…' : colones(montoPeriodo)} />
        <Stat label="Período" value={loading ? '…' : periodo} />
        {canton ? (
          <Stat
            label="Instituciones compradoras"
            value={loading ? '…' : instituciones.length.toString()}
          />
        ) : (
          <Stat
            label="Órdenes con cantón resuelto"
            value={
              loading || total == null || conCanton == null
                ? '…'
                : `${conCanton.toLocaleString('es-CR')} (${Math.round((conCanton / total) * 100)}%)`
            }
          />
        )}
      </div>

      {/* Buscador + ranking de proveedores */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-gray-900">
            Top proveedores por monto{canton ? ` — ${cantonNombre ?? 'cantón'}` : ''}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQ(busqueda.trim());
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar proveedor…"
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 focus:outline-none
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Buscar
            </button>
            {q && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setQ('');
                }}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Limpiar
              </button>
            )}
          </form>
        </div>

        {loading ? (
          <div className="h-80 flex items-center justify-center text-gray-500">Cargando…</div>
        ) : ranking.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-400">
            Sin resultados{q ? ` para “${q}”` : ''}
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ left: 10, right: 40, top: 5, bottom: 5 }}
                barSize={18}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => colones(Number(v))} />
                <YAxis type="category" dataKey="nombre" width={230} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [colonesExacto(Number(value)), 'Monto']}
                  labelFormatter={(label) => String(label)}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600">
                    <th className="px-3 py-2 font-medium">Proveedor</th>
                    <th className="px-3 py-2 font-medium text-right">Órdenes</th>
                    <th className="px-3 py-2 font-medium text-right">Monto total</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.proveedor} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{r.proveedor}</td>
                      <td className="px-3 py-2 text-right">{r.ordenes.toLocaleString('es-CR')}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {colonesExacto(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Instituciones compradoras */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {canton
            ? `Instituciones compradoras de ${cantonNombre ?? 'este cantón'}`
            : 'Top instituciones compradoras'}
        </h3>
        {loading ? (
          <div className="h-40 flex items-center justify-center text-gray-500">Cargando…</div>
        ) : instituciones.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400">
            Sin datos {canton ? '(no se pudo geolocalizar ninguna institución de este cantón)' : ''}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="px-3 py-2 font-medium">Institución</th>
                  <th className="px-3 py-2 font-medium text-right">Órdenes</th>
                  <th className="px-3 py-2 font-medium text-right">Monto total</th>
                </tr>
              </thead>
              <tbody>
                {instituciones.map((i) => (
                  <tr key={i.institucion} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">{i.institucion}</td>
                    <td className="px-3 py-2 text-right">{i.ordenes.toLocaleString('es-CR')}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {colonesExacto(i.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evolución mensual del gasto */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Evolución mensual del gasto en órdenes de pedido
        </h3>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">Cargando…</div>
        ) : mensual.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Sin datos</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={mensual} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => colones(Number(v))} width={80} />
              <Tooltip
                formatter={(value) => [colonesExacto(Number(value)), 'Monto']}
                labelFormatter={(label) => `Mes ${String(label)}`}
              />
              <Area
                type="monotone"
                dataKey="monto"
                stroke="#3b82f6"
                fill="url(#colorGasto)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {!canton && (
        <p className="text-xs text-gray-400">
          El cruce institución → cantón se resuelve para ~1 de cada 3 órdenes (las
          demás quedan solo a nivel nacional). La ubicación es la de la sede de la
          institución compradora, no necesariamente la del lugar de entrega.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
