import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';

/**
 * Orden de pedido de SICOP = compra ejecutada por una institución pública.
 *
 * Fuente OSINT (AGENTS.md §6.2): SICOP — Datos Abiertos de Contratación Pública.
 * Vía de acceso: "Zona de descarga masiva" del Observatorio de Compra Pública
 * del Ministerio de Hacienda, que replica los datos de SICOP en CSV mensual.
 *   URL: https://dlsaobservatorioprod.blob.core.windows.net/fs-synapse-observatorio-produccion/Zip/AAAAMM.zip
 *   Archivo dentro del ZIP: OrdenPedido.csv  (separador ";", UTF-8, campos entre comillas)
 *
 * Caveats a documentar en el README:
 *  - Los datos abiertos son una réplica y pueden tener hasta 24 h de desfase.
 *  - Cada ZIP mensual trae solo lo publicado ese mes; el histórico se arma
 *    descargando varios meses.
 *
 * Mapeo columna CSV -> campo (ver DATOS.md para el diccionario completo):
 *   NRO_ORDEN                 -> nroOrden (PK natural)
 *   NRO_SICOP                 -> nroSicop
 *   NUMERO_PROCEDIMIENTO      -> numeroProcedimiento
 *   CONTRACT_NO / NRO_CONTRATO-> nroContrato
 *   DESC_PROCEDIMIENTO        -> descripcion
 *   CEDULAPROVEEDOR           -> proveedorCedula
 *   NOMBRE_PROVEEDOR          -> proveedor
 *   TOTAL_ORDEN              -> montoOrden
 *   TOTALESTIMADO            -> montoEstimado
 *   USD_MONT                 -> montoUsd
 *   MONEDA_ORDEN             -> moneda
 *   ESTADO_ORDEN            -> estado
 *   FECHA_ELABORACION_ORDEN  -> fechaElaboracion
 *   FECHA_NOTIFICACION_ORDEN -> fechaNotificacion
 *
 * institucion / provincia / cantonCodigo se completan en la fase "scope
 * completo" cruzando NRO_CONTRATO -> Contratos.csv -> CEDULA_INSTITUCION ->
 * InstitucionesRegistradas.csv (campo ZONA_GEO_INST = "distrito, cantón, provincia").
 * Mientras tanto quedan NULL y el panel funciona a nivel nacional / por proveedor.
 */
@Entity('sicop_ordenes_pedido')
@Index(['cantonCodigo', 'fechaElaboracion'])
@Index(['proveedorCedula'])
export class Contratacion {
  /** Número de orden de pedido en SICOP (identificador natural) */
  @PrimaryColumn({ type: 'varchar', length: 40, name: 'nro_orden' })
  nroOrden: string;

  /** Número de procedimiento SICOP asociado, e.g. "2025LD-000013-0023300001" */
  @Index()
  @Column({ type: 'varchar', length: 40, name: 'nro_sicop', nullable: true })
  nroSicop: string | null;

  @Column({ type: 'varchar', length: 40, name: 'numero_procedimiento', nullable: true })
  numeroProcedimiento: string | null;

  /** Código de contrato SICOP, e.g. "CE202601000513" */
  @Column({ type: 'varchar', length: 30, name: 'nro_contrato', nullable: true })
  nroContrato: string | null;

  /** Descripción de lo comprado (texto libre del procedimiento) */
  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  /** Cédula jurídica / física del proveedor */
  @Column({ type: 'varchar', length: 20, name: 'proveedor_cedula', nullable: true })
  proveedorCedula: string | null;

  /** Nombre del proveedor adjudicado */
  @Column({ type: 'varchar', length: 250, nullable: true })
  proveedor: string | null;

  /** Monto de la orden en la moneda original */
  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'monto_orden', nullable: true })
  montoOrden: string | null;

  /** Monto estimado del procedimiento */
  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'monto_estimado', nullable: true })
  montoEstimado: string | null;

  /** Monto convertido a dólares (lo provee la fuente) */
  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'monto_usd', nullable: true })
  montoUsd: string | null;

  /** Moneda de la orden: "CRC", "USD", etc. */
  @Column({ type: 'varchar', length: 3, nullable: true })
  moneda: string | null;

  /** Estado de la orden, e.g. "Orden de Pedido Tramitada" */
  @Column({ type: 'varchar', length: 80, nullable: true })
  estado: string | null;

  /** Fecha de elaboración de la orden (YYYY-MM-DD) */
  @Index()
  @Column({ type: 'date', name: 'fecha_elaboracion', nullable: true })
  fechaElaboracion: string | null;

  /** Fecha de notificación de la orden al proveedor */
  @Column({ type: 'date', name: 'fecha_notificacion', nullable: true })
  fechaNotificacion: string | null;

  // ─── Enriquecimiento: institución compradora (ver DATOS.md §3) ───────
  // Se resuelve cruzando NRO_SICOP → Sistemas/DetalleCarteles/Contratos →
  // CEDULA_INSTITUCION → InstitucionesRegistradas (ZONA_GEO_INST).

  /** Cédula jurídica de la institución compradora */
  @Column({ type: 'varchar', length: 20, name: 'institucion_cedula', nullable: true })
  institucionCedula: string | null;

  /** Nombre de la institución compradora */
  @Index()
  @Column({ type: 'varchar', length: 250, nullable: true })
  institucion: string | null;

  /** Provincia de la institución compradora */
  @Column({ type: 'varchar', length: 50, nullable: true })
  provincia: string | null;

  /** Código del cantón de la institución — FK a la tabla compartida */
  @Column({ type: 'varchar', length: 3, name: 'canton_codigo', nullable: true })
  cantonCodigo: string | null;

  @ManyToOne(() => Canton, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'canton_codigo', referencedColumnName: 'codigo' })
  canton: Canton | null;
}
