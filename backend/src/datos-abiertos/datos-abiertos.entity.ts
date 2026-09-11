import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Personas beneficiarias del PRONAE (Programa Nacional de Empleo), según
 * modalidad de proyecto y año, normalizado desde el "cuadro 1.4" del
 * Portal Nacional de Datos Abiertos de Costa Rica.
 *
 * La fuente original es una tabla cruzada (modalidad x año). Cada fila de
 * esta entidad representa UNA combinación (modalidad, año) — una versión
 * "aplanada" de esa tabla, más apta para consultarse y agruparse.
 *
 * Este dataset no incluye provincia/cantón (es un agregado nacional), así
 * que a diferencia de `estadisticas_policiales` no tiene FK a `Canton`.
 * Funciona como panel independiente — permitido explícitamente por el
 * AGENTS.md del proyecto (sección 6.4).
 *
 * @see https://datosabiertos.gob.go.cr/dataset/mtss-personas-beneficiarias-pronae-2021-2024
 */
@Entity('pronae_beneficiarios')
@Index(['modalidad', 'anio'], { unique: true })
export class PronaeBeneficiario {
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * Modalidad del proyecto, e.g. "EMPLÉATE", "Obra comunal".
     * La fila con modalidad "Total" es la suma oficial de las demás
     * modalidades para ese año — no es una modalidad real, ver `esTotal`.
     */
    @Column({ type: 'varchar', length: 100 })
    modalidad: string;

    /** Año del dato, e.g. 2021-2024. */
    @Column({ type: 'int' })
    anio: number;

    /**
     * Cantidad de personas beneficiarias. `null` cuando la fuente marca
     * la celda como "-" (sin dato / modalidad no aplicaba ese año) — no
     * es lo mismo que 0.
     */
    @Column({ type: 'int', nullable: true })
    beneficiarios: number | null;

    /**
     * true solo para la fila "Total" del cuadro original. Se guarda aparte
     * (no como una modalidad más) para poder excluirla de los gráficos de
     * distribución por modalidad, y usarla directo en la evolución anual.
     */
    @Column({ type: 'boolean', default: false, name: 'es_total' })
    esTotal: boolean;
}