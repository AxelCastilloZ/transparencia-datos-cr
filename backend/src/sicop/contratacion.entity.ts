import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';

/**
 * Registro de contratación pública de SICOP (Sistema Integrado de Compras Públicas).
 * Cada fila representa un procedimiento de contratación / adjudicación,
 * normalizado desde los reportes de Datos Abiertos de SICOP.
 *
 * Fuente: https://www.sicop.go.cr/moduloPcont/pcont/rp/CE_MOD_DATOSABIERTOSVIEW.jsp
 * (ver AGENTS.md sección 6.2)
 *
 * Caveats de la fuente a documentar en el README:
 *  - Los datos abiertos son una réplica y pueden tener hasta 24 h de desfase.
 *  - El reporte de proveedores puede excluir registros de los últimos 7 días.
 */
@Entity('contrataciones_sicop')
@Index(['cantonCodigo', 'fecha'])
export class Contratacion {
  @PrimaryGeneratedColumn()
  id: number;

  /** Número de procedimiento de contratación en SICOP */
  @Index()
  @Column({ type: 'varchar', length: 60, name: 'numero_procedimiento' })
  numeroProcedimiento: string;

  /** Institución compradora, e.g. "Caja Costarricense de Seguro Social" */
  @Column({ type: 'varchar', length: 250 })
  institucion: string;

  /** Proveedor adjudicado (si aplica); null si el procedimiento no está adjudicado */
  @Column({ type: 'varchar', length: 250, nullable: true })
  proveedor: string | null;

  /** Monto de la línea / adjudicación, en la moneda indicada */
  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  monto: string | null;

  /** Moneda del monto: "CRC", "USD", etc. */
  @Column({ type: 'varchar', length: 3, nullable: true, default: 'CRC' })
  moneda: string | null;

  /** Provincia de la institución o de la entrega (según lo que traiga la fuente) */
  @Column({ type: 'varchar', length: 50, nullable: true })
  provincia: string | null;

  /** Código del cantón — FK a la tabla compartida. Null si la fuente no lo especifica. */
  @Column({ type: 'varchar', length: 3, name: 'canton_codigo', nullable: true })
  cantonCodigo: string | null;

  @ManyToOne(() => Canton, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'canton_codigo', referencedColumnName: 'codigo' })
  canton: Canton | null;

  /** Fecha del procedimiento / adjudicación (YYYY-MM-DD) */
  @Index()
  @Column({ type: 'date', nullable: true })
  fecha: string | null;

  /** Estado del procedimiento: "Adjudicado", "En trámite", "Desierto", etc. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  estado: string | null;

  /** Categoría / clase de bien o servicio contratado */
  @Column({ type: 'varchar', length: 200, nullable: true })
  categoria: string | null;
}
