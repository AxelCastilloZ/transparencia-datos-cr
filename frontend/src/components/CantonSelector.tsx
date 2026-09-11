import { useEffect, useState } from 'react';
import { api, type Canton } from '../api';

interface Props {
  value: string;
  onChange: (codigo: string, nombre: string) => void;
  label?: string;
}

/** Selector de cantón agrupado por provincia */
export function CantonSelector({ value, onChange, label = 'Cantón' }: Props) {
  const [cantones, setCantones] = useState<Canton[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let active = true;
    api.cantones().then((data) => {
      if (active) setCantones(data);
    }).catch(() => {
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [intento]);

  // Agrupar por provincia para el optgroup
  const porProvincia = cantones.reduce<Record<string, Canton[]>>((acc, c) => {
    (acc[c.provincia] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div>
    <select
      aria-label={label}
      value={value}
      onChange={(e) =>
        onChange(
          e.target.value,
          e.target.selectedOptions[0]?.text ?? '',
        )
      }
      disabled={loading || error}
      className="w-full max-w-md px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900
                 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                 disabled:opacity-50 disabled:cursor-wait"
    >
      <option value="">
        {loading ? 'Cargando cantones...' : error ? 'Cantones no disponibles' : '— Todos los cantones (vista nacional) —'}
      </option>
      {Object.entries(porProvincia).map(([provincia, lista]) => (
        <optgroup key={provincia} label={provincia}>
          {lista.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.nombre}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">
      No se pudo cargar la lista de cantones.
      <button type="button" className="ml-2 underline" onClick={() => {
        setError(false);
        setLoading(true);
        setIntento((i) => i + 1);
      }}>Reintentar</button>
    </p>}
    </div>
  );
}
