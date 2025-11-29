import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateConnectionsTable1732877851000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'connections',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workspace_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'encrypted_config',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'iv',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'auth_tag',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'last_tested_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Add foreign key to workspaces table
    await queryRunner.createForeignKey(
      'connections',
      new TableForeignKey({
        columnNames: ['workspace_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'workspaces',
        onDelete: 'CASCADE',
      }),
    );

    // Add foreign key to users table
    await queryRunner.createForeignKey(
      'connections',
      new TableForeignKey({
        columnNames: ['created_by'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'RESTRICT',
      }),
    );

    // Create index on workspace_id for faster queries
    await queryRunner.query(
      `CREATE INDEX "IDX_connections_workspace_id" ON "connections" ("workspace_id")`,
    );

    // Create index on type
    await queryRunner.query(
      `CREATE INDEX "IDX_connections_type" ON "connections" ("type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_connections_type"`);
    await queryRunner.query(`DROP INDEX "IDX_connections_workspace_id"`);

    // Drop table (foreign keys will be dropped automatically)
    await queryRunner.dropTable('connections');
  }
}
