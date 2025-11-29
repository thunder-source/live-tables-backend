import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Base } from './entities/base.entity';
import { Table } from './entities/table.entity';
import { TableColumn } from './entities/column.entity';
import { BasesService } from './services/bases.service';
import { TablesService } from './services/tables.service';
import { ColumnsService } from './services/columns.service';
import { RowsService } from './services/rows.service';
import { BasesController } from './controllers/bases.controller';
import { TablesController } from './controllers/tables.controller';
import { ColumnsController } from './controllers/columns.controller';
import { RowsController } from './controllers/rows.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Base, Table, TableColumn])],
  controllers: [
    BasesController,
    TablesController,
    ColumnsController,
    RowsController,
  ],
  providers: [
    BasesService,
    TablesService,
    ColumnsService,
    RowsService,
  ],
  exports: [
    BasesService,
    TablesService,
    ColumnsService,
    RowsService,
  ],
})
export class BasesModule {}
