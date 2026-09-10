/** Tipos compartidos que reflejan lo que devuelve el backend */

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

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  /** Lista los 82 cantones */
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
};
