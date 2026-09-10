import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ResumenDelito } from '../api';

interface Props {
  data: ResumenDelito[];
  loading: boolean;
}

/** Gráfica de barras horizontales — top delitos por cantón */
export function DelitosChart({ data, loading }: Props) {
  if (loading) {
    return <div className="h-80 flex items-center justify-center text-gray-500">Cargando...</div>;
  }
  if (data.length === 0) {
    return <div className="h-80 flex items-center justify-center text-gray-400">Sin datos</div>;
  }

  // Top 10 delitos, acortando el nombre para la gráfica
  const top = data.slice(0, 10).map((d) => ({
    ...d,
    nombre: d.delito.length > 35 ? d.delito.slice(0, 32) + '...' : d.delito,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={top} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }} barSize={20}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis type="category" dataKey="nombre" width={220} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [Number(value).toLocaleString(), 'Casos']}
          labelFormatter={(label) => String(label)}
        />
        <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
