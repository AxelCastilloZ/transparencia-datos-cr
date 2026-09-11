export interface Periodo {
  desde: string;
  hasta: string;
  mesesCompletos: number;
}
export interface Cobertura {
  desde: string | null;
  hasta: string | null;
  meses: string[];
  registros: number;
}
export interface Incidentes {
  canton: string;
  fecha: string;
  delito: string;
  total: number;
}
export interface Compra {
  canton: string | null;
  mes: string;
  moneda: string | null;
  proveedor: string | null;
  institucion: string | null;
  ordenes: number;
  monto: number | null;
  validos: number;
}
export interface Electores {
  canton: string;
  total: number;
  fechaCorte: string;
  sincronizadoEn: string;
}
export interface Distrito {
  distrito: string;
  total: number;
}
export interface Pronae {
  anio: number;
  modalidad: string;
  beneficiarios: number | null;
  esTotal: boolean;
}
export interface Senal {
  codigo: string;
  nivel: 'informativa' | 'atencion';
  titulo: string;
  descripcion: string;
  evidencia: { etiqueta: string; valor: string }[];
  metodologia: string;
  fuentes: string[];
  limitaciones: string[];
  preguntaSugerida: string;
}
export interface MontoMoneda {
  moneda: string;
  monto: number | null;
  ordenes: number;
  ordenesConMonto: number;
  principal: number | null;
  topCinco: number | null;
}
export interface Fuente {
  nombre: string;
  alcance: string;
  url: string;
  cobertura: Cobertura | null;
  fechaCorte: string | null;
  sincronizadoEn: string | null;
  registrosUsados: number | null;
  estado: 'disponible' | 'sin-datos' | 'error';
  advertencias: string[];
}
export interface Radar {
  canton: { codigo: string; nombre: string; provincia: string };
  periodo: Periodo;
  seguridad: {
    incidentes: number | null;
    mesAnterior: number | null;
    ultimoMesCompleto: number | null;
    mesesComparados: string[];
    variacionMensualPorcentaje: number | null;
    explicacionVariacion: string;
    incidentesPorMilElectores: number | null;
    coberturaSuficiente: boolean;
    topDelitos: { delito: string; total: number }[];
  };
  electorado: {
    fechaCorte: string | null;
    electores: number | null;
    porcentajeNacional: number | null;
    distritosPrincipales: (Distrito & { porcentaje: number | null })[];
  };
  contratacion: {
    ordenes: number | null;
    instituciones: number | null;
    proveedores: number | null;
    montosPorMoneda: MontoMoneda[];
    coberturaGeografica: number | null;
    coberturaSuficiente: boolean;
  };
  comparacion: {
    cantonesComparables: number;
    medianaIncidentesPorMilElectores: number | null;
    posicionRelativaIncidentes: number | null;
    medianasSicopPorMoneda: {
      moneda: string;
      mediana: number;
      cantones: number;
    }[];
  };
  contextoNacional: {
    pronae: {
      anioMasReciente: number | null;
      totalBeneficiarios: number | null;
      modalidadPrincipal: string | null;
      evolucion: { anio: number; total: number | null }[];
    };
  };
  senales: Senal[];
  metadatos: { fuentes: Fuente[]; advertencias: string[] };
}
