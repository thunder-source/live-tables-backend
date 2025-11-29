import { Test, TestingModule } from '@nestjs/testing';
import { LqpBuilderService } from './lqp-builder.service';
import { FilterOperator } from '../interfaces/filter.interface';

describe('LqpBuilderService', () => {
  let service: LqpBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LqpBuilderService],
    }).compile();

    service = module.get<LqpBuilderService>(LqpBuilderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should build a simple query for internal table', () => {
    const lqp = service
      .fromInternalTable('table-123')
      .select(['name', 'email'])
      .filter({ field: 'age', operator: 'gt' as FilterOperator, value: 18 })
      .sort({ field: 'created_at', direction: 'desc' })
      .paginate({ limit: 10, offset: 0 })
      .build();

    expect(lqp.source.type).toBe('internal_table');
    expect(lqp.source.tableId).toBe('table-123');
    expect(lqp.fields).toEqual(['name', 'email']);
    expect(lqp.filters).toHaveLength(1);
    expect(lqp.filters![0]).toEqual({ field: 'age', operator: 'gt', value: 18 });
    expect(lqp.sorts).toHaveLength(1);
    expect(lqp.sorts![0]).toEqual({ field: 'created_at', direction: 'desc' });
    expect(lqp.pagination).toEqual({ limit: 10, offset: 0 });
  });

  it('should build a query for external connection', () => {
    const lqp = service
      .fromExternalConnection('conn-456', 'users_table')
      .build();

    expect(lqp.source.type).toBe('external_connection');
    expect(lqp.source.connectionId).toBe('conn-456');
    expect(lqp.source.tableId).toBe('users_table');
  });

  it('should reset state between builds', () => {
    service.fromInternalTable('table-1').build();
    const lqp2 = service.fromInternalTable('table-2').build();

    expect(lqp2.source.tableId).toBe('table-2');
    expect(lqp2.filters).toHaveLength(0);
  });
});
