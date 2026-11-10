import type { Radar } from '../src/api';

/** Datos simulados de la ficha cantonal para los tests E2E. */

export const MONTO_CRC = 900;
export const MONTO_USD = 500;

export const ficha: Radar = {
  canton: { codigo: '101', nombre: 'San José', provincia: 'San José' },
  periodo: { desde: '2026-03-01', hasta: '2026-08-31', mesesCompletos: 6 },
  seguridad: {
    incidentes: 50,
    mesAnterior: 20,
    ultimoMesCompleto: 30,
    mesesComparados: ['2026-07', '2026-08'],
    variacionMensualPorcentaje: 50,
    explicacionVariacion: 'Dos meses completos.',
    incidentesPorMilElectores: 5,
    coberturaSuficiente: true,
    topDelitos: [],
  },
  electorado: {
    fechaCorte: '2026-08-31',
    electores: 850,
    porcentajeNacional: 1,
    distritosPrincipales: [],
  },
  contratacion: {
    ordenes: 30,
    instituciones: 2,
    proveedores: 3,
    coberturaGeografica: 40,
    coberturaSuficiente: false,
    montosPorMoneda: [
      { moneda: 'CRC', monto: MONTO_CRC, ordenes: 20, ordenesConMonto: 20, principal: 50, topCinco: 100 },
      { moneda: 'USD', monto: MONTO_USD, ordenes: 10, ordenesConMonto: 10, principal: 100, topCinco: 100 },
    ],
  },
  comparacion: {
    cantonesComparables: 6,
    medianaIncidentesPorMilElectores: 3,
    posicionRelativaIncidentes: 80,
    medianasSicopPorMoneda: [],
  },
  contextoNacional: {
    pronae: {
      anioMasReciente: null,
      totalBeneficiarios: null,
      modalidadPrincipal: null,
      evolucion: [],
    },
  },
  senales: [],
  metadatos: { fuentes: [], advertencias: [] },
};
