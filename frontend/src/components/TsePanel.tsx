import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  api,
  type TseResumen,
  type TseDistrito,
  type TseSnapshot,
} from '../api';

export function TsePanel({
  canton,
  cantonNombre,
}: {
  canton?: string;
  cantonNombre?: string;
  onCantonChange?: (codigo: string, nombre: string) => void;
}) {
  const [resultado, setResultado] = useState<{
    clave: string;
    error: boolean;
    data: {
      resumen: TseResumen;
      distritos: TseDistrito[];
      historico: TseSnapshot[];
    } | null;
  } | null>(null);
  const [intento, setIntento] = useState(0);
  const clave = `${canton ?? ''}:${intento}`;
  const loading = resultado?.clave !== clave;
  const error = !loading && resultado?.error;
  const data = !loading ? resultado?.data : null;
  useEffect(() => {
    let active = true;
    Promise.all([
      canton ? api.tse.porCanton(canton) : api.tse.resumen(),
      canton ? api.tse.distritos(canton) : Promise.resolve([]),
      canton ? api.tse.historico(canton) : Promise.resolve([]),
    ])
      .then(([resumen, distritos, historico]) => {
        if (active)
          setResultado({
            clave,
            error: false,
            data: { resumen, distritos, historico },
          });
      })
      .catch(() => {
        if (active) setResultado({ clave, error: true, data: null });
      });
    return () => {
      active = false;
    };
  }, [canton, clave]);

  const fmt = (n: number) => n.toLocaleString('es-CR');
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">
        Padrón electoral — TSE{cantonNombre ? ` · ${cantonNombre}` : ''}
      </h2>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        El padrón electoral cuenta electores inscritos: no equivale a
        participación, abstencionismo ni votos emitidos. PADRON.TXT no contiene
        sexo ni edad.
      </p>
      <p className="text-sm text-gray-500">
        Fuente: Tribunal Supremo de Elecciones · Padrón nacional mensual · Fecha
        de corte: {data?.resumen.fechaCorte ?? 'sin datos'}
      </p>
      {loading ? (
        <p role="status">Cargando padrón electoral…</p>
      ) : error ? (
        <div role="alert">
          No se pudieron cargar los datos del TSE.
          <button
            className="ml-2 text-blue-700 underline"
            onClick={() => setIntento((i) => i + 1)}
          >
            Reintentar
          </button>
        </div>
      ) : !data?.resumen.fechaCorte ? (
        <p>
          No hay snapshots disponibles. Ejecutá la primera sincronización del
          TSE en el backend.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">
                Electores inscritos{canton ? ' en el cantón' : ' en Costa Rica'}
              </p>
              <p className="text-3xl font-bold text-blue-700">
                {fmt(data.resumen.total)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm text-gray-500">Porcentaje nacional</p>
              <p className="text-3xl font-bold">
                {data.resumen.porcentajeNacional.toFixed(2)}%
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500">{data.resumen.alcance}</p>
          {!canton && (
            <p>
              Seleccioná un cantón para ver sus distritos y evolución mensual.
            </p>
          )}
          {canton && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="font-semibold mb-3">
                Principales distritos electorales
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Distrito</th>
                    <th className="text-right">Electores</th>
                  </tr>
                </thead>
                <tbody>
                  {data.distritos.slice(0, 10).map((d) => (
                    <tr
                      key={d.distritoCodigo}
                      className="border-t border-gray-100"
                    >
                      <td className="py-2">{d.distrito}</td>
                      <td className="text-right">{fmt(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.distritos.length === 0 && <p>Sin distritos disponibles.</p>}
            </div>
          )}
          {canton &&
            (data.historico.length > 1 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="font-semibold mb-3">
                  Evolución mensual de electores inscritos
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.historico}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fechaCorte" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Electores inscritos"
                      stroke="#2563eb"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                La evolución mensual estará disponible cuando existan al menos
                dos snapshots.
              </p>
            ))}
        </>
      )}
    </div>
  );
}
