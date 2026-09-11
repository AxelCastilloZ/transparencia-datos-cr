import { useEffect, useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { api, type PronaeAnual, type PronaeModalidad, type PronaeResumen } from '../api';

const ANIOS_DISPONIBLES = [2021, 2022, 2023, 2024];

/**
 * Panel de Datos Abiertos — Personas beneficiarias del PRONAE.
 * Fuente: MTSS, vía el Portal Nacional de Datos Abiertos de Costa Rica.
 *
 * A diferencia de OIJ y SICOP, este dataset es un agregado nacional por
 * modalidad y año — no trae cantón, así que el panel no depende del
 * selector de cantón del resto de la app (permitido por AGENTS.md 6.4).
 */
export function DatosAbiertosPanel() {
    const [anio, setAnio] = useState(ANIOS_DISPONIBLES[ANIOS_DISPONIBLES.length - 1]);
    const [modalidades, setModalidades] = useState<PronaeModalidad[]>([]);
    const [anual, setAnual] = useState<PronaeAnual[]>([]);
    const [resumen, setResumen] = useState<PronaeResumen | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Carga: evolución anual + resumen KPI (una sola vez, no dependen del año elegido)
    useEffect(() => {
        let vivo = true;
        Promise.all([api.datosAbiertos.porAnio(), api.datosAbiertos.resumen()])
        .then(([an, res]) => {
            if (!vivo) return;
            setAnual(an);
            setResumen(res);
        })
        .catch(() => vivo && setError(true));
        return () => {
        vivo = false;
        };
    }, []);

    // Distribución por modalidad — al montar y cada vez que cambia el año elegido
    useEffect(() => {
        let vivo = true;
        setLoading(true);
        api.datosAbiertos
        .porModalidad(anio)
        .then((data) => vivo && setModalidades(data))
        .catch(() => vivo && setError(true))
        .finally(() => vivo && setLoading(false));
        return () => {
        vivo = false;
        };
    }, [anio]);

    const barData = useMemo(
        () =>
        modalidades.map((m) => ({
            modalidad: m.modalidad,
            beneficiarios: m.beneficiarios,
        })),
        [modalidades],
    );

    if (error) {
        return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
            No se pudieron cargar los datos del PRONAE. El backend puede no tener
            datos aún — corré <code className="text-sm">POST /api/datos-abiertos/sync</code>.
        </div>
        );
    }

    return (
        <div className="space-y-6">
        <div>
            <h2 className="text-xl font-bold text-gray-900">
            Datos Abiertos — Beneficiarios del PRONAE
            </h2>
            <p className="text-sm text-gray-500">
            Personas beneficiarias según modalidad de proyecto · Fuente: MTSS vía
            Portal Nacional de Datos Abiertos de Costa Rica · Datos nacionales
            </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Stat
            label={`Total beneficiarios ${resumen?.anioMasReciente ?? ''}`}
            value={resumen?.totalUltimoAnio?.toLocaleString('es-CR') ?? 'No disponible'}
            />
            <Stat
            label="Año con mayor total"
            value={resumen?.anioConMayorTotal?.toString() ?? 'No disponible'}
            />
            <Stat
            label={`Modalidad principal ${resumen?.anioMasReciente ?? ''}`}
            value={resumen?.modalidadPrincipalUltimoAnio ?? 'No disponible'}
            />
            <Stat
            label="Período de datos"
            value={anual.length > 0 ? `${anual[0].anio} – ${anual[anual.length - 1].anio}` : '…'}
            />
        </div>

        {/* Evolución anual */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Evolución anual de beneficiarios
            </h3>
            {anual.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-600">{resumen === null ? 'Cargando…' : 'Sin datos nacionales PRONAE disponibles'}</div>
            ) : (
            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={anual} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="anio" tick={{ fontSize: 12 }} />
                <YAxis width={70} tickFormatter={(v) => Number(v).toLocaleString('es-CR')} />
                <Tooltip
                    formatter={(value) => [Number(value).toLocaleString('es-CR'), 'Beneficiarios']}
                    labelFormatter={(label) => `Año ${label}`}
                />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
            </ResponsiveContainer>
            )}
        </div>

        {/* Distribución por modalidad, con filtro de año */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Distribución por modalidad</h3>
            <select
                aria-label="Año del contexto nacional PRONAE"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 focus:outline-none
                        focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                {ANIOS_DISPONIBLES.map((a) => (
                <option key={a} value={a}>
                    {a}
                </option>
                ))}
            </select>
            </div>

            {loading ? (
            <div className="h-72 flex items-center justify-center text-gray-500">Cargando…</div>
            ) : barData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-gray-400">
                Sin datos para {anio}
            </div>
            ) : (
            <>
                <ResponsiveContainer width="100%" height={280}>
                <BarChart
                    data={barData}
                    layout="vertical"
                    margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                    barSize={20}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => Number(v).toLocaleString('es-CR')} />
                    <YAxis type="category" dataKey="modalidad" width={190} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [Number(value).toLocaleString('es-CR'), 'Beneficiarios']} />
                    <Bar dataKey="beneficiarios" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm text-left border-collapse">
                    <thead>
                    <tr className="bg-gray-100 text-gray-600">
                        <th className="px-3 py-2 font-medium">Modalidad</th>
                        <th className="px-3 py-2 font-medium text-right">Beneficiarios ({anio})</th>
                    </tr>
                    </thead>
                    <tbody>
                    {modalidades.map((m) => (
                        <tr key={m.modalidad} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2">{m.modalidad}</td>
                        <td className="px-3 py-2 text-right">
                            {m.beneficiarios !== null ? m.beneficiarios.toLocaleString('es-CR') : '— sin dato'}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </>
            )}
        </div>

        <p className="text-xs text-gray-400">
            Acerca de los datos: MTSS — Dirección Nacional de Empleo · Portal Nacional
            de Datos Abiertos de Costa Rica · Licencia Creative Commons Attribution
            (CC-BY) · Última actualización de la fuente: marzo 2026.{' '}
            <a
            href="https://datosabiertos.gob.go.cr/dataset/mtss-personas-beneficiarias-pronae-2021-2024"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-gray-600"
            >
            Ver dataset oficial
            </a>
        </p>
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
