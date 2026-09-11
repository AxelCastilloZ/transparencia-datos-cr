import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Canton } from '../cantones/canton.entity.js';

@Entity('tse_padron_distrital')
export class TsePadronDistrital {
  @PrimaryColumn({ type: 'date' }) fechaCorte: string;
  @PrimaryColumn({ type: 'varchar', length: 6 }) distritoCodigo: string;
  @Column({ type: 'varchar', length: 3 }) cantonCodigo: string;
  @ManyToOne(() => Canton, { nullable: false })
  @JoinColumn({ name: 'cantonCodigo' })
  canton: Canton;
  @Column({ type: 'varchar', length: 100 }) distrito: string;
  @Column({ type: 'integer' }) total: number;
}
