import type { Radar } from "../api";
const fmt = (n: number | null | undefined) =>
  n == null
    ? "No disponible"
    : n.toLocaleString("es-CR", { maximumFractionDigits: 2 });
export function RadarPanel({ data }: { data: Radar }) {
  const {
    seguridad: s,
    electorado: e,
    contratacion: c,
    comparacion: comp,
  } = data;
  const max = Math.max(
    s.incidentesPorMilElectores ?? 0,
    comp.medianaIncidentesPorMilElectores ?? 0,
    1,
  );
  return (
    <div className="space-y-8">
      <section aria-labelledby="resumen-radar">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="resumen-radar" className="text-2xl font-semibold">
            {data.canton.nombre} · {data.canton.provincia}
          </h2>
          <p>
            {data.periodo.desde} — {data.periodo.hasta} ·{" "}
            {data.periodo.mesesCompletos} meses completos
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Incidentes registrados del período"
            value={fmt(s.incidentes)}
            note={
              s.coberturaSuficiente
                ? "OIJ · cobertura temporal observada"
                : "Cobertura insuficiente; conteo parcial si está disponible"
            }
          />
          <Stat
            label="Electores inscritos"
            value={fmt(e.electores)}
            note={`TSE · último corte: ${e.fechaCorte ?? "sin snapshots"}`}
          />
          <Stat
            label="Razón de incidentes por cada 1.000 electores"
            value={fmt(s.incidentesPorMilElectores)}
            note="El padrón no equivale a la población total"
          />
          <Stat
            label="Órdenes SICOP territorialmente identificadas"
            value={fmt(c.ordenes)}
            note="Sede de la institución compradora"
          />
          <Stat
            label="Montos observados por moneda"
            value={
              c.montosPorMoneda.length
                ? c.montosPorMoneda
                    .map((m) => `${m.moneda} ${fmt(m.monto)}`)
                    .join(" · ")
                : "No disponible"
            }
            note="Sin conversión ni suma entre monedas; ver cobertura monetaria abajo"
          />
          <Stat
            label="Cobertura territorial SICOP"
            value={
              c.coberturaGeografica === null
                ? "No disponible"
                : `${fmt(c.coberturaGeografica)}%`
            }
            note="Porcentaje de órdenes nacionales del período con cantón identificado"
          />
        </div>
        <p className="mt-4 text-sm">
          Variación mensual OIJ: {fmt(s.variacionMensualPorcentaje)}
          {s.variacionMensualPorcentaje !== null && "%"} ·{" "}
          {s.mesesComparados.join(" → ")}. {s.explicacionVariacion}
        </p>
      </section>
      <section aria-labelledby="senales-radar">
        <h2 id="senales-radar" className="text-xl font-semibold">
          Señales para investigar
        </h2>
        <p className="mt-1 mb-4 text-slate-600">
          {data.senales.length} señales disponibles. Son preguntas de
          investigación, no una calificación del cantón.
        </p>
        {!data.senales.length && (
          <p>
            No se activaron señales con los datos disponibles. Esto no demuestra
            ausencia de problemas.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {data.senales.map((senal) => (
            <article
              key={senal.codigo}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <p className="text-sm font-semibold text-indigo-800">
                {senal.nivel === "atencion" ? "Atención" : "Informativa"} ·{" "}
                {senal.fuentes.join(" + ")}
              </p>
              <h3 className="my-2 text-lg font-semibold">{senal.titulo}</h3>
              <p>{senal.descripcion}</p>
              <dl className="my-3 space-y-1">
                {senal.evidencia.map((ev) => (
                  <div key={ev.etiqueta} className="flex justify-between gap-4">
                    <dt>{ev.etiqueta}</dt>
                    <dd className="font-semibold">{ev.valor}</dd>
                  </div>
                ))}
              </dl>
              <details className="border-t border-slate-200 pt-3">
                <summary className="cursor-pointer font-medium text-indigo-800">
                  ¿Cómo se calculó?
                </summary>
                <p className="mt-2">{senal.metodologia}</p>
                {senal.limitaciones.map((l) => (
                  <p className="mt-2 text-sm text-slate-600" key={l}>
                    {l}
                  </p>
                ))}
              </details>
              <p className="mt-4 rounded-lg bg-slate-50 p-3">
                <strong>Para investigar: </strong>
                {senal.preguntaSugerida}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section
        aria-labelledby="comparacion-radar"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 id="comparacion-radar" className="text-xl font-semibold">
          Comparación con cantones observados
        </h2>
        <p className="my-2 text-sm">
          Razón de incidentes por cada 1.000 electores ·{" "}
          {comp.cantonesComparables} cantones comparables · mismo período,
          último corte TSE.
        </p>
        {s.incidentesPorMilElectores === null ||
        comp.medianaIncidentesPorMilElectores === null ? (
          <p>Cobertura insuficiente para presentar una posición relativa.</p>
        ) : (
          <>
            {[
              { label: data.canton.nombre, n: s.incidentesPorMilElectores },
              {
                label: "Mediana de cantones comparables",
                n: comp.medianaIncidentesPorMilElectores,
              },
            ].map((row) => (
              <div className="my-4" key={row.label}>
                <div className="flex justify-between gap-2">
                  <span>{row.label}</span>
                  <strong>{fmt(row.n)}</strong>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1 h-3 rounded bg-slate-100"
                >
                  <div
                    className="h-3 rounded bg-indigo-600"
                    style={{ width: `${(row.n / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-sm">
              Percentil empírico: {fmt(comp.posicionRelativaIncidentes)}{" "}
              (porcentaje de cantones con razón menor o igual). No representa
              peligrosidad.
            </p>
          </>
        )}
        {comp.medianasSicopPorMoneda.length ? (
          <ul className="mt-4">
            {comp.medianasSicopPorMoneda.map((m) => (
              <li key={m.moneda}>
                Mediana SICOP {m.moneda}: {fmt(m.mediana)} · {m.cantones}{" "}
                cantones con montos completos. Monto observado del cantón:{" "}
                {fmt(
                  c.montosPorMoneda.find((valor) => valor.moneda === m.moneda)
                    ?.monto,
                )}{" "}
                {m.moneda}.
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4">
            SICOP: cobertura insuficiente para medianas territoriales por
            moneda.
          </p>
        )}
      </section>
      <section
        aria-labelledby="concentracion-radar"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 id="concentracion-radar" className="text-xl font-semibold">
          Contratación observada y concentración
        </h2>
        <p className="my-3">
          Instituciones identificadas: {fmt(c.instituciones)} · Proveedores
          identificados: {fmt(c.proveedores)}. Los conteos excluyen identidades
          ausentes.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="text-left mb-3">
              Participación del monto por moneda original. Sin monto o proveedor
              completo, concentración no disponible.
            </caption>
            <thead>
              <tr>
                {[
                  "Moneda",
                  "Monto observado",
                  "Órdenes con monto / total",
                  "Principal (%)",
                  "Top cinco (%)",
                ].map((t) => (
                  <th className="p-2" scope="col" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.montosPorMoneda.map((m) => (
                <tr key={m.moneda} className="border-t border-slate-200">
                  <th scope="row" className="p-2">
                    {m.moneda}
                  </th>
                  <td className="p-2">{fmt(m.monto)}</td>
                  <td className="p-2">
                    {fmt(m.ordenesConMonto)} / {fmt(m.ordenes)}
                  </td>
                  <td className="p-2">{fmt(m.principal)}</td>
                  <td className="p-2">{fmt(m.topCinco)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!c.montosPorMoneda.length && (
          <p>Sin montos con moneda identificada.</p>
        )}
      </section>
    </div>
  );
}
function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-medium text-slate-600">{label}</h3>
      <p className="my-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-slate-600">{note}</p>
    </div>
  );
}
export function RadarFuentes({ data }: { data: Radar }) {
  return (
    <section aria-labelledby="fuentes-radar" className="space-y-4">
      <h2 id="fuentes-radar" className="text-xl font-semibold">
        Metodología y fuentes
      </h2>
      <ul className="list-disc pl-5 space-y-2">
        {data.metadatos.advertencias.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <p>
        Razón = incidentes del período / electores del último corte × 1.000.
        Medianas: mínimo cinco cantones, denominador positivo y cobertura
        temporal observada. SICOP requiere además 80% de cobertura territorial
        nacional para comparar. No hay puntuación única de riesgo.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {data.metadatos.fuentes.map((f) => (
          <article
            key={f.nombre}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h3 className="font-semibold">{f.nombre}</h3>
            <p>
              {f.alcance} · {f.estado}
            </p>
            <p>Registros usados: {fmt(f.registrosUsados)}</p>
            <p>
              Corte: {f.fechaCorte ?? "No disponible"} · Sincronización:{" "}
              {f.sincronizadoEn ?? "No registrada"}
            </p>
            {f.cobertura && (
              <p>
                En caché: {f.cobertura.desde ?? "Sin fecha"} —{" "}
                {f.cobertura.hasta ?? "Sin fecha"} ·{" "}
                {fmt(f.cobertura.registros)} registros ·{" "}
                {f.cobertura.meses.length} meses observados.
              </p>
            )}
            <ul className="my-3 list-disc pl-5 text-sm">
              {f.advertencias.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <a
              className="font-medium text-indigo-800 underline"
              href={f.url}
              target="_blank"
              rel="noreferrer"
            >
              Referencia oficial
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
