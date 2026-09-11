import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';

@Entity('tse_padron_cantonal')
export class TsePadronCantonal {
  @PrimaryColumn({ type: 'date' }) fechaCorte: string;
  @PrimaryColumn({ type: 'varchar', length: 3 }) cantonCodigo: string;
  @ManyToOne(() => Canton, { nullable: false })
  @JoinColumn({ name: 'cantonCodigo' })
  canton: Canton;
  @Column({ type: 'integer' }) total: number;
  @Column({ type: 'varchar', length: 250 }) fuente: string;
  @Column({ type: 'timestamptz' }) sincronizadoEn: Date;
}
