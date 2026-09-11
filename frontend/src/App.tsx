import { useEffect, useState } from "react";
import {
  api,
  type Radar,
  type DatoMensual,
  type EstadisticaPolicial,
  type ResumenDelito,
} from "./api";
import { CantonSelector } from "./components/CantonSelector";
import { RadarPanel, RadarFuentes } from "./components/RadarPanel";
import { SicopPanel } from "./components/SicopPanel";
import { TsePanel } from "./components/TsePanel";
import { DatosAbiertosPanel } from "./components/datos-abiertos";
import { DelitosChart } from "./components/DelitosChart";
import { TimelineChart } from "./components/TimelineChart";
import { DataTable } from "./components/DataTable";

export default function App() {
  const [canton, setCanton] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtro, setFiltro] = useState({ desde: "", hasta: "" });
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<{
    clave: string;
    data: Radar | null;
    error: boolean;
  } | null>(null);
  const clave = `${canton}:${filtro.desde}:${filtro.hasta}:${intento}`;
  const loading = !!canton && resultado?.clave !== clave;
  const data = resultado?.clave === clave ? resultado.data : null;
  const error = resultado?.clave === clave && resultado.error;
  useEffect(() => {
    if (!canton) return;
    let active = true;
    api
      .radar(canton, filtro)
      .then((data) => {
        if (active) setResultado({ clave, data, error: false });
      })
      .catch(() => {
        if (active) setResultado({ clave, data: null, error: true });
      });
    return () => {
      active = false;
    };
  }, [canton, filtro, clave]);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-sm font-semibold tracking-widest text-indigo-800">
            TRANSPARENCIA CR · COSTA RICA
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Radar cantonal de señales públicas
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-slate-600">
            ¿Qué señales públicas presenta este cantón y cuáles merecen una
            investigación más profunda?
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Una ficha para periodistas, organizaciones comunales, estudiantes,
            investigadores y ciudadanía. Evidencia pública, procedencia y
            límites visibles.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 font-medium">Cantón</p>
              <CantonSelector value={canton} onChange={setCanton} />
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setFiltro({ desde, hasta });
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <div>
                <label htmlFor="radar-desde" className="mb-2 block text-sm">
                  Desde
                </label>
                <input
                  id="radar-desde"
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  max={hasta || undefined}
                  className="rounded-lg border border-slate-300 p-2"
                />
              </div>
              <div>
                <label htmlFor="radar-hasta" className="mb-2 block text-sm">
                  Hasta
                </label>
                <input
                  id="radar-hasta"
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  min={desde || undefined}
                  className="rounded-lg border border-slate-300 p-2"
                />
              </div>
              <button className="rounded-lg bg-indigo-700 px-4 py-2 text-white">
                Aplicar período
              </button>
              <button
                type="button"
                className="text-sm text-indigo-800 underline"
                onClick={() => {
                  setDesde("");
                  setHasta("");
                  setFiltro({ desde: "", hasta: "" });
                }}
              >
                Últimos seis meses completos disponibles
              </button>
            </form>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Sin fechas: seis meses completos según la última fecha observada en
            OIJ; SICOP se usa como referencia si OIJ está vacío. Las coberturas
            de las fuentes pueden diferir.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {!canton && (
          <p className="rounded-xl border border-slate-200 bg-white p-6">
            Seleccioná un cantón para reunir su ficha integrada.
          </p>
        )}
        {loading && <p role="status">Cargando ficha del cantón…</p>}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-slate-300 bg-white p-5"
          >
            No se pudo cargar el radar. Revisá el período y la conexión.
            <button
              className="ml-3 text-indigo-800 underline"
              onClick={() => setIntento((i) => i + 1)}
            >
              Reintentar
            </button>
          </div>
        )}
        {data && (
          <>
            <RadarPanel data={data} />
            <section className="space-y-4" aria-labelledby="dimensiones">
              <h2 id="dimensiones" className="text-xl font-semibold">
                Explorar las dimensiones
              </h2>
              <details className="rounded-xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer text-lg font-semibold">
                  Seguridad · detalle OIJ
                </summary>
                <JudicialDetalle
                  key={`${canton}:${data.periodo.desde}:${data.periodo.hasta}`}
                  canton={canton}
                  desde={data.periodo.desde}
                  hasta={data.periodo.hasta}
                />
              </details>
              <details className="rounded-xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer text-lg font-semibold">
                  Contratación · detalle SICOP en CRC
                </summary>
                <SicopPanel
                  key={`${canton}:${data.periodo.desde}:${data.periodo.hasta}`}
                  canton={canton}
                  cantonNombre={data.canton.nombre}
                  desde={data.periodo.desde}
                  hasta={data.periodo.hasta}
                />
              </details>
              <details className="rounded-xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer text-lg font-semibold">
                  Electorado · detalle TSE
                </summary>
                <TsePanel
                  canton={canton}
                  cantonNombre={data.canton.nombre}
                  onCantonChange={setCanton}
                />
              </details>
            </section>
          </>
        )}
        <section
          className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 sm:p-6"
          aria-labelledby="contexto-nacional"
        >
          <h2 id="contexto-nacional" className="text-xl font-semibold">
            Contexto nacional de empleo y apoyo social
          </h2>
          <p className="my-3">
            PRONAE · Costa Rica · 2021–2024. No está desagregado por cantón. Sus
            beneficiarios no se atribuyen al cantón seleccionado y no
            intervienen en las señales cantonales.
          </p>
          <DatosAbiertosPanel />
        </section>
        {data && <RadarFuentes data={data} />}
      </main>
      <footer className="border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-600">
        Transparencia CR · Correlación o coincidencia temporal no implica
        causalidad.
      </footer>
    </div>
  );
}
function JudicialDetalle({
  canton,
  desde,
  hasta,
}: {
  canton: string;
  desde: string;
  hasta: string;
}) {
  const [data, setData] = useState<{
    resumen: ResumenDelito[];
    mensual: DatoMensual[];
    registros: EstadisticaPolicial[];
  } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      api.judicial.resumen(canton, { desde, hasta }),
      api.judicial.mensual(canton, { desde, hasta }),
      api.judicial.porCanton(canton, { desde, hasta, limit: 100 }),
    ])
      .then(([resumen, mensual, registros]) => {
        if (active) setData({ resumen, mensual, registros });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [canton, desde, hasta]);
  if (error) return <p role="alert">No se pudo cargar el detalle OIJ.</p>;
  if (!data) return <p role="status">Cargando detalle OIJ…</p>;
  return (
    <div className="mt-4 space-y-5">
      <p>
        Período: {desde} — {hasta}. Incidentes registrados; no todos los delitos
        ocurridos.
      </p>
      <h3 className="font-semibold">Delitos registrados</h3>
      <DelitosChart data={data.resumen} loading={false} />
      <h3 className="font-semibold">
        Incidentes por mes (los extremos pueden ser parciales)
      </h3>
      <TimelineChart data={data.mensual} loading={false} />
      <h3 className="font-semibold">Registros recientes</h3>
      <DataTable data={data.registros} loading={false} />
    </div>
  );
}
