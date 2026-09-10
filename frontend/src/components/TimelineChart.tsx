import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DatoMensual } from '../api';

interface Props {
  data: DatoMensual[];
  loading: boolean;
}

/** Gráfica de área — incidentes por mes para el cantón seleccionado */
export function TimelineChart({ data, loading }: Props) {
  if (loading) {
    return <div className="h-64 flex items-center justify-center text-gray-500">Cargando...</div>;
  }
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-400">Sin datos</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="colorCasos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
        <YAxis />
        <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Incidentes']} />
        <Area
          type="monotone"
          dataKey="casos"
          stroke="#3b82f6"
          fill="url(#colorCasos)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
