import { useCallback, useEffect, useState } from 'react';
import { api, type DatoMensual, type EstadisticaPolicial, type ResumenDelito } from './api';
import { CantonSelector } from './components/CantonSelector';
import { DataTable } from './components/DataTable';
import { DelitosChart } from './components/DelitosChart';
import { SicopPanel } from './components/SicopPanel';
import { TimelineChart } from './components/TimelineChart';

function App() {
  const [canton, setCanton] = useState('');
  const [cantonNombre, setCantonNombre] = useState('');
  const [resumen, setResumen] = useState<ResumenDelito[]>([]);
  const [registros, setRegistros] = useState<EstadisticaPolicial[]>([]);
  const [mensual, setMensual] = useState<DatoMensual[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalGeneral, setTotalGeneral] = useState<number | null>(null);

  // Cargar status general al montar
  useEffect(() => {
    api.judicial.status().then((s) => setTotalGeneral(s.registros));
  }, []);

  // Cargar datos cuando cambia el cantón seleccionado
  const cargarDatos = useCallback(async (codigo: string, nombre = '') => {
    setCanton(codigo);
    setCantonNombre(nombre);
    if (!codigo) {
      setResumen([]);
      setRegistros([]);
      setMensual([]);
      return;
    }
    setLoading(true);
    try {
      const [res, reg, men] = await Promise.all([
        api.judicial.resumen(codigo),
        api.judicial.porCanton(codigo, { limit: 100 }),
        api.judicial.mensual(codigo),
      ]);
      setResumen(res);
      setRegistros(reg);
      setMensual(men);
    } catch (err) {
      console.error('Error cargando datos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalCanton = resumen.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            🇨🇷 Transparencia CR
          </h1>
          <p className="mt-1 text-gray-500">
            Explorador de datos públicos de Costa Rica — seguridad (OIJ) y
            contratación pública (SICOP)
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Selector de cantón */}
        <section className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Seleccioná un cantón para explorar sus datos:
          </label>
          <CantonSelector value={canton} onChange={cargarDatos} />
        </section>

        {/* Estado general */}
        {!canton && totalGeneral !== null && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-4xl font-bold text-blue-600">{totalGeneral.toLocaleString()}</p>
            <p className="text-gray-500 mt-1">registros policiales del OIJ en la base de datos</p>
            <p className="text-gray-400 text-sm mt-2">
              Datos de 2024 – 2026 · Fuente: Portal de Datos Abiertos del Poder Judicial
            </p>
          </div>
        )}

        {/* Sección: Seguridad (OIJ) */}
        {canton && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Total incidentes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : totalCanton.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Tipos de delito</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : resumen.length}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Delito más frecuente</p>
                <p className="text-lg font-semibold text-gray-900 truncate">
                  {loading ? '...' : resumen[0]?.delito ?? '—'}
                </p>
              </div>
            </div>

            {/* Gráfica de delitos */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Top 10 delitos
              </h2>
              <DelitosChart data={resumen} loading={loading} />
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Incidentes por mes
              </h2>
              <TimelineChart data={mensual} loading={loading} />
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Registros más recientes
              </h2>
              <DataTable data={registros} loading={loading} />
            </div>
          </div>
        )}

        {/* Sección: Contratación pública (SICOP) — nacional o por cantón */}
        <section className="mt-12 pt-8 border-t border-gray-200">
          <SicopPanel canton={canton || undefined} cantonNombre={cantonNombre || undefined} />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12 py-6 text-center text-sm text-gray-400">
        Proyecto universitario — Datos abiertos de Costa Rica · 2026
      </footer>
    </div>
  );
}

export default App;
