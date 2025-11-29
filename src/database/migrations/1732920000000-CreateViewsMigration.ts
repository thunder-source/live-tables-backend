import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateViewsMigration1732920000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create views table
    await queryRunner.createTable(
      new Table({
        name: 'views',
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
            name: 'tableId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'baseId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'configuration',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'isPublic',
            type: 'boolean',
            default: false,
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
      'views',
      new TableForeignKey({
        columnNames: ['tableId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tables',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'views',
      new TableForeignKey({
        columnNames: ['baseId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'bases',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'views',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Create indexes
    await queryRunner.query(`CREATE INDEX "idx_views_tableId" ON "views" ("tableId")`);
    await queryRunner.query(`CREATE INDEX "idx_views_baseId" ON "views" ("baseId")`);
    await queryRunner.query(`CREATE INDEX "idx_views_createdBy" ON "views" ("createdBy")`);
    await queryRunner.query(`CREATE INDEX "idx_views_configuration_gin" ON "views" USING GIN(configuration)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    const viewsTable = await queryRunner.getTable('views');

    if (viewsTable) {
      const viewsTableFk = viewsTable.foreignKeys.find(fk => fk.columnNames.indexOf('tableId') !== -1);
      const viewsBaseFk = viewsTable.foreignKeys.find(fk => fk.columnNames.indexOf('baseId') !== -1);
      const viewsCreatedByFk = viewsTable.foreignKeys.find(fk => fk.columnNames.indexOf('createdBy') !== -1);
      
      if (viewsTableFk) await queryRunner.dropForeignKey('views', viewsTableFk);
      if (viewsBaseFk) await queryRunner.dropForeignKey('views', viewsBaseFk);
      if (viewsCreatedByFk) await queryRunner.dropForeignKey('views', viewsCreatedByFk);
    }

    // Drop table
    await queryRunner.dropTable('views', true);
  }
}
