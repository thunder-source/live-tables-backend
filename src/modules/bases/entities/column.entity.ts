import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Table } from './table.entity';
import { User } from '../../users/entities/user.entity';

export enum ColumnType {
  TEXT_SHORT = 'TEXT_SHORT',
  TEXT_LONG = 'TEXT_LONG',
  NUMBER_INT = 'NUMBER_INT',
  NUMBER_DECIMAL = 'NUMBER_DECIMAL',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
}

@Entity('columns')
export class TableColumn extends BaseEntity {
  @Column()
  name: string;

  @Column()
  physicalColumnName: string;

  @Column({ type: 'enum', enum: ColumnType })
  type: ColumnType;

  @Column({ default: false })
  isRequired: boolean;

  @Column({ nullable: true, type: 'text' })
  defaultValue?: string;

  @Column({ type: 'jsonb', nullable: true })
  validationRules?: Record<string, any>;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'uuid' })
  tableId: string;

  @ManyToOne(() => Table, (table) => table.columns)
  @JoinColumn({ name: 'tableId' })
  table: Table;

  @Column({ type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;
}
