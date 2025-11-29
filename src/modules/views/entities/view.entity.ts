import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { Table } from '../../bases/entities/table.entity';
import { Base } from '../../bases/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export interface ViewConfiguration {
  filters?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';
    value: any;
  }>;
  sorts?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  visibleColumns?: string[];
  computedColumns?: Array<{
    name: string;
    formula: string;
    type: string;
  }>;
  groupBy?: string;
}

@Entity('views')
export class View extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ type: 'uuid' })
  tableId: string;

  @ManyToOne(() => Table)
  @JoinColumn({ name: 'tableId' })
  table: Table;

  @Column({ type: 'uuid' })
  baseId: string;

  @ManyToOne(() => Base)
  @JoinColumn({ name: 'baseId' })
  base: Base;

  @Column({ type: 'jsonb' })
  configuration: ViewConfiguration;

  @Column({ default: false })
  isPublic: boolean;

  @Column({ type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;
}
