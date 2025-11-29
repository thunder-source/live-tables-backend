import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateBasesTablesMigration1732910000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create bases table
    await queryRunner.createTable(
      new Table({
        name: 'bases',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'color',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'icon',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'workspaceId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create tables table
    await queryRunner.createTable(
      new Table({
        name: 'tables',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'physicalTableName',
            type: 'varchar',
            length: '255',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'schemaVersion',
            type: 'int',
            default: 1,
          },
          {
            name: 'baseId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create columns table
    await queryRunner.createTable(
      new Table({
        name: 'columns',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'physicalColumnName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['TEXT_SHORT', 'TEXT_LONG', 'NUMBER_INT', 'NUMBER_DECIMAL', 'BOOLEAN', 'DATE', 'DATETIME'],
            isNullable: false,
          },
          {
            name: 'isRequired',
            type: 'boolean',
            default: false,
          },
          {
            name: 'defaultValue',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'validationRules',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'position',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'tableId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'bases',
      new TableForeignKey({
        columnNames: ['workspaceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'workspaces',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'bases',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'tables',
      new TableForeignKey({
        columnNames: ['baseId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'bases',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'tables',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'columns',
      new TableForeignKey({
        columnNames: ['tableId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tables',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'columns',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Create indexes
    await queryRunner.query(`CREATE INDEX "idx_bases_workspaceId" ON "bases" ("workspaceId")`);
    await queryRunner.query(`CREATE INDEX "idx_bases_createdBy" ON "bases" ("createdBy")`);
    await queryRunner.query(`CREATE INDEX "idx_tables_baseId" ON "tables" ("baseId")`);
    await queryRunner.query(`CREATE INDEX "idx_tables_createdBy" ON "tables" ("createdBy")`);
    await queryRunner.query(`CREATE INDEX "idx_columns_tableId" ON "columns" ("tableId")`);
    await queryRunner.query(`CREATE INDEX "idx_columns_createdBy" ON "columns" ("createdBy")`);
    await queryRunner.query(`CREATE INDEX "idx_columns_position" ON "columns" ("tableId", "position")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const basesTable = await queryRunner.getTable('bases');
    const tablesTable = await queryRunner.getTable('tables');
    const columnsTable = await queryRunner.getTable('columns');

    if (basesTable) {
      const basesWorkspaceFk = basesTable.foreignKeys.find(fk => fk.columnNames.indexOf('workspaceId') !== -1);
      const basesCreatedByFk = basesTable.foreignKeys.find(fk => fk.columnNames.indexOf('createdBy') !== -1);
      if (basesWorkspaceFk) await queryRunner.dropForeignKey('bases', basesWorkspaceFk);
      if (basesCreatedByFk) await queryRunner.dropForeignKey('bases', basesCreatedByFk);
    }

    if (tablesTable) {
      const tablesBaseFk = tablesTable.foreignKeys.find(fk => fk.columnNames.indexOf('baseId') !== -1);
      const tablesCreatedByFk = tablesTable.foreignKeys.find(fk => fk.columnNames.indexOf('createdBy') !== -1);
      if (tablesBaseFk) await queryRunner.dropForeignKey('tables', tablesBaseFk);
      if (tablesCreatedByFk) await queryRunner.dropForeignKey('tables', tablesCreatedByFk);
    }

    if (columnsTable) {
      const columnsTableFk = columnsTable.foreignKeys.find(fk => fk.columnNames.indexOf('tableId') !== -1);
      const columnsCreatedByFk = columnsTable.foreignKeys.find(fk => fk.columnNames.indexOf('createdBy') !== -1);
      if (columnsTableFk) await queryRunner.dropForeignKey('columns', columnsTableFk);
      if (columnsCreatedByFk) await queryRunner.dropForeignKey('columns', columnsCreatedByFk);
    }

    // Drop tables
    await queryRunner.dropTable('columns', true);
    await queryRunner.dropTable('tables', true);
    await queryRunner.dropTable('bases', true);
  }
}
