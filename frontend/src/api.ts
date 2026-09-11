/** Tipos compartidos que reflejan lo que devuelve el backend */
import type { Radar } from '../../backend/src/radar/radar.types';
export type { Radar } from '../../backend/src/radar/radar.types';

export interface Canton {
  codigo: string;
  nombre: string;
  provincia: string;
}

export interface EstadisticaPolicial {
  id: number;
  delito: string;
  fecha: string;
  provincia: string;
  cantonCodigo: string;
  distrito: string | null;
  victimaSexo: string | null;
  victimaNacionalidad: string | null;
  victimaEdad: string | null;
}

export interface ResumenDelito {
  delito: string;
  total: number;
}

export interface DatoMensual {
  mes: string;
  casos: number;
}

export interface JudicialStatus {
  fuente: string;
  registros: number;
}

// ─── SICOP — Contratación pública ────────────────────────────────────

export interface SicopStatus {
  fuente: string;
  registros: number;
  conCanton: number;
}

export interface ProveedorRanking {
  proveedor: string;
  total: number;
  ordenes: number;
}

export interface InstitucionRanking {
  institucion: string;
  total: number;
  ordenes: number;
}

export interface GastoMensual {
  mes: string;
  monto: number;
  ordenes: number;
}

// ─── Datos Abiertos — PRONAE ──────────────────────────────────────────

export interface PronaeModalidad {
  modalidad: string;
  anio: number;
  beneficiarios: number | null;
  esTotal: boolean;
}

export interface PronaeAnual {
  anio: number;
  total: number | null;
}

export interface PronaeResumen {
  totalUltimoAnio: number | null;
  anioMasReciente: number | null;
  anioConMayorTotal: number | null;
  modalidadPrincipalUltimoAnio: string | null;
}

const BASE = '/api';

export interface TseResumen {
  fuente: string;
  fechaCorte: string | null;
  cantonCodigo: string | null;
  total: number;
  totalNacional: number;
  porcentajeNacional: number;
  alcance: string;
}
export interface TseSnapshot { fechaCorte: string; cantonCodigo: string; total: number }
export interface TseDistrito extends TseSnapshot { distritoCodigo: string; distrito: string }
export interface TseStatus { fuente: string; fechaCorte: string | null; snapshots: number; enCurso: boolean; ultimoError: string | null }

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  radar: (codigo: string, params: { desde?: string; hasta?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.desde) qs.set('desde', params.desde);
    if (params.hasta) qs.set('hasta', params.hasta);
    return get<Radar>(`/radar/canton/${encodeURIComponent(codigo)}?${qs}`);
  },
  tse: {
    status: () => get<TseStatus>('/tse/status'),
    resumen: () => get<TseResumen>('/tse/resumen'),
    porCanton: (codigo: string) => get<TseResumen>(`/tse/canton/${encodeURIComponent(codigo)}`),
    historico: (codigo: string) => get<TseSnapshot[]>(`/tse/canton/${encodeURIComponent(codigo)}/historico`),
    distritos: (codigo: string) => get<TseDistrito[]>(`/tse/canton/${encodeURIComponent(codigo)}/distritos`),
    sync: async () => {
      const response = await fetch(`${BASE}/tse/sync`, { method: 'POST' });
      if (!response.ok) throw new Error('No se pudo sincronizar TSE');
      return response.json() as Promise<{ fechaCorte: string; cantones: number; distritos: number; total: number; exteriorExcluido: number }>;
    },
  },
  /** Lista los 84 cantones */
  cantones: () => get<Canton[]>('/cantones'),

  /** Estadísticas policiales para un cantón */
  judicial: {
    porCanton: (codigo: string, params?: { desde?: string; hasta?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.desde) qs.set('desde', params.desde);
      if (params?.hasta) qs.set('hasta', params.hasta);
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return get<EstadisticaPolicial[]>(`/judicial/canton/${codigo}${query ? '?' + query : ''}`);
    },

    resumen: (codigo: string, params?: { desde?: string; hasta?: string }) => {
      const qs = new URLSearchParams();
      if (params?.desde) qs.set('desde', params.desde);
      if (params?.hasta) qs.set('hasta', params.hasta);
      const query = qs.toString();
      return get<ResumenDelito[]>(`/judicial/canton/${codigo}/resumen${query ? '?' + query : ''}`);
    },

    mensual: (codigo: string, params?: { desde?: string; hasta?: string }) => {
      const qs = new URLSearchParams();
      if (params?.desde) qs.set('desde', params.desde);
      if (params?.hasta) qs.set('hasta', params.hasta);
      const query = qs.toString();
      return get<DatoMensual[]>(`/judicial/canton/${codigo}/mensual${query ? '?' + query : ''}`);
    },

    status: () => get<JudicialStatus>('/judicial/status'),
  },

  /** Contratación pública (SICOP) */
  sicop: {
    status: () => get<SicopStatus>('/sicop/status'),

    proveedores: (params?: {
      q?: string;
      desde?: string;
      hasta?: string;
      limit?: number;
      canton?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set('q', params.q);
      if (params?.desde) qs.set('desde', params.desde);
      if (params?.hasta) qs.set('hasta', params.hasta);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.canton) qs.set('canton', params.canton);
      const query = qs.toString();
      return get<ProveedorRanking[]>(`/sicop/proveedores${query ? '?' + query : ''}`);
    },

    instituciones: (params?: { desde?: string; hasta?: string; limit?: number; canton?: string }) => {
      const qs = new URLSearchParams();
      if (params?.desde) qs.set('desde', params.desde);
      if (params?.hasta) qs.set('hasta', params.hasta);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.canton) qs.set('canton', params.canton);
      const query = qs.toString();
      return get<InstitucionRanking[]>(`/sicop/instituciones${query ? '?' + query : ''}`);
    },

    mensual: (params?: { desde?: string; hasta?: string; canton?: string }) => {
      const qs = new URLSearchParams();
      if (params?.desde) qs.set('desde', params.desde);
      if (params?.hasta) qs.set('hasta', params.hasta);
      if (params?.canton) qs.set('canton', params.canton);
      const query = qs.toString();
      return get<GastoMensual[]>(`/sicop/mensual${query ? '?' + query : ''}`);
    },
  },
  
    /** Datos Abiertos — Personas beneficiarias del PRONAE (MTSS) */
  datosAbiertos: {
    porModalidad: (anio?: number) => {
      const qs = anio ? `?anio=${anio}` : '';
      return get<PronaeModalidad[]>(`/datos-abiertos/pronae${qs}`);
    },
    porAnio: () => get<PronaeAnual[]>('/datos-abiertos/pronae/anual'),
    resumen: () => get<PronaeResumen>('/datos-abiertos/pronae/resumen'),
  },
};
