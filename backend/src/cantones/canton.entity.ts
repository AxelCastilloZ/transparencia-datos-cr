import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Tabla compartida de cantones de Costa Rica.
 * Todas las entidades de fuente (judicial, sicop, tse, datos-abiertos)
 * referencian esta tabla por clave foránea para permitir el cruce geográfico.
 *
 * Costa Rica tiene 84 cantones agrupados en 7 provincias.
 * El código sigue el formato oficial: provincia (1 dígito) + cantón (2 dígitos).
 */
@Entity('cantones')
export class Canton {
  /** Código oficial del cantón, e.g. "101" = San José central */
  @PrimaryColumn({ type: 'varchar', length: 3 })
  codigo: string;

  /** Nombre del cantón, e.g. "San José" */
  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  /** Nombre de la provincia, e.g. "San José" */
  @Column({ type: 'varchar', length: 50 })
  provincia: string;
}
