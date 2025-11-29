import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Base } from './entities/base.entity';
import { Table } from './entities/table.entity';
import { TableColumn } from './entities/column.entity';
import { BasesService } from './services/bases.service';
import { TablesService } from './services/tables.service';
import { ColumnsService } from './services/columns.service';
import { RowsService } from './services/rows.service';
import { InternalDbExecutorService } from './services/internal-db-executor.service';
import { BasesController } from './controllers/bases.controller';
import { TablesController } from './controllers/tables.controller';
import { ColumnsController } from './controllers/columns.controller';
import { RowsController } from './controllers/rows.controller';
import { QueryEngineController } from './controllers/query-engine.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Base, Table, TableColumn])],
  controllers: [
    BasesController,
    TablesController,
    ColumnsController,
    RowsController,
    QueryEngineController,
  ],
  providers: [
    BasesService,
    TablesService,
    ColumnsService,
    RowsService,
    InternalDbExecutorService,
  ],
  exports: [
    BasesService,
    TablesService,
    ColumnsService,
    RowsService,
    InternalDbExecutorService,
  ],
})
export class BasesModule {}
