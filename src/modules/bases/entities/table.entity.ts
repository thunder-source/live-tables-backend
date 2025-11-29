import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Base } from './base.entity';
import { User } from '../../users/entities/user.entity';
import { TableColumn } from './column.entity';

@Entity('tables')
export class Table extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ unique: true })
  physicalTableName: string;

  @Column({ type: 'int', default: 1 })
  schemaVersion: number;

  @Column({ type: 'uuid' })
  baseId: string;

  @ManyToOne(() => Base, (base) => base.tables)
  @JoinColumn({ name: 'baseId' })
  base: Base;

  @Column({ type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @OneToMany(() => TableColumn, (column) => column.table)
  columns: TableColumn[];
}
