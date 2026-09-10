import { useEffect, useState } from 'react';
import { api, type Canton } from '../api';

interface Props {
  value: string;
  onChange: (codigo: string, nombre: string) => void;
}

/** Selector de cantón agrupado por provincia */
export function CantonSelector({ value, onChange }: Props) {
  const [cantones, setCantones] = useState<Canton[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.cantones().then((data) => {
      setCantones(data);
      setLoading(false);
    });
  }, []);

  // Agrupar por provincia para el optgroup
  const porProvincia = cantones.reduce<Record<string, Canton[]>>((acc, c) => {
    (acc[c.provincia] ??= []).push(c);
    return acc;
  }, {});

  return (
    <select
      value={value}
      onChange={(e) =>
        onChange(
          e.target.value,
          e.target.selectedOptions[0]?.text ?? '',
        )
      }
      disabled={loading}
      className="w-full max-w-md px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900
                 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                 disabled:opacity-50 disabled:cursor-wait"
    >
      <option value="">
        {loading ? 'Cargando cantones...' : '— Seleccioná un cantón —'}
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
  );
}
