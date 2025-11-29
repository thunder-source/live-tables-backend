import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Connection } from '../entities/connection.entity';
import { CreateConnectionDto } from '../dto/create-connection.dto';
import { UpdateConnectionDto } from '../dto/update-connection.dto';
import { EncryptionService } from './encryption.service';
import { AdapterRegistryService } from '../../dal/adapters/services/adapter-registry.service';
import { IDatabaseAdapter } from '../../dal/adapters/interfaces/database-adapter.interface';
import { PostgreSQLAdapter } from '../../dal/adapters/services/postgresql.adapter';
import { MongoDBAdapter } from '../../dal/adapters/services/mongodb.adapter';
import { MySQLAdapter } from '../../dal/adapters/services/mysql.adapter';

@Injectable()
export class ConnectionsService {
  private adapterCache = new Map<string, IDatabaseAdapter>();

  constructor(
    @InjectRepository(Connection)
    private connectionRepository: Repository<Connection>,
    private encryptionService: EncryptionService,
    private adapterRegistry: AdapterRegistryService,
  ) {
    // Register adapters
    this.adapterRegistry.register('postgresql', PostgreSQLAdapter);
    this.adapterRegistry.register('mongodb', MongoDBAdapter);
    this.adapterRegistry.register('mysql', MySQLAdapter);
  }

  /**
   * Creates a new database connection with encrypted credentials.
   */
  async create(
    createConnectionDto: CreateConnectionDto,
    workspaceId: string,
    userId: string,
  ): Promise<Connection> {
    // Encrypt the connection config
    const configJson = JSON.stringify(createConnectionDto.config);
    const { ciphertext, iv, authTag } =
      this.encryptionService.encrypt(configJson);

    const connection = this.connectionRepository.create({
      name: createConnectionDto.name,
      type: createConnectionDto.type,
      encryptedConfig: ciphertext,
      iv,
      authTag,
      workspaceId,
      createdBy: userId,
      isActive: true,
    });

    return await this.connectionRepository.save(connection);
  }

  /**
   * Retrieves all connections for a workspace.
   */
  async findAll(workspaceId: string): Promise<Connection[]> {
    return await this.connectionRepository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Retrieves a single connection by ID.
   */
  async findOne(id: string, workspaceId: string): Promise<Connection> {
    const connection = await this.connectionRepository.findOne({
      where: { id, workspaceId },
    });

    if (!connection) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }

    return connection;
  }

  /**
   * Updates a connection.
   */
  async update(
    id: string,
    updateConnectionDto: UpdateConnectionDto,
    workspaceId: string,
  ): Promise<Connection> {
    const connection = await this.findOne(id, workspaceId);

    if (updateConnectionDto.name) {
      connection.name = updateConnectionDto.name;
    }

    if (updateConnectionDto.type) {
      connection.type = updateConnectionDto.type;
    }

    if (updateConnectionDto.config) {
      // Re-encrypt the new config
      const configJson = JSON.stringify(updateConnectionDto.config);
      const { ciphertext, iv, authTag } =
        this.encryptionService.encrypt(configJson);

      connection.encryptedConfig = ciphertext;
      connection.iv = iv;
      connection.authTag = authTag;

      // Clear cache since config changed
      this.adapterCache.delete(id);
    }

    return await this.connectionRepository.save(connection);
  }

  /**
   * Deletes a connection.
   */
  async remove(id: string, workspaceId: string): Promise<void> {
    const connection = await this.findOne(id, workspaceId);

    // Disconnect and clear cache
    await this.disconnectAdapter(id);
    this.adapterCache.delete(id);

    await this.connectionRepository.remove(connection);
  }

  /**
   * Tests a connection by attempting to connect and ping the database.
   */
  async testConnection(id: string, workspaceId: string): Promise<boolean> {
    const connection = await this.findOne(id, workspaceId);

    try {
      const adapter = await this.getAdapter(connection);
      const isConnected = await adapter.testConnection();

      if (isConnected) {
        // Update last tested timestamp
        connection.lastTestedAt = new Date();
        await this.connectionRepository.save(connection);
      }

      return isConnected;
    } catch (error) {
      throw new BadRequestException(
        `Connection test failed: ${error.message}`,
      );
    }
  }

  /**
   * Discovers the schema of a database connection.
   */
  async discoverSchema(id: string, workspaceId: string, scope?: string) {
    const connection = await this.findOne(id, workspaceId);

    try {
      const adapter = await this.getAdapter(connection);
      return await adapter.discoverSchema(scope);
    } catch (error) {
      throw new InternalServerErrorException(
        `Schema discovery failed: ${error.message}`,
      );
    }
  }

  /**
   * Gets or creates an adapter instance for a connection.
   */
  async getAdapter(connection: Connection): Promise<IDatabaseAdapter> {
    // Check cache first
    if (this.adapterCache.has(connection.id)) {
      return this.adapterCache.get(connection.id)!;
    }

    // Decrypt the config
    const configJson = this.encryptionService.decrypt(
      connection.encryptedConfig,
      connection.iv,
      connection.authTag,
    );
    const config = JSON.parse(configJson);

    // Create adapter
    const adapter = this.adapterRegistry.createAdapter(connection.type);

    // Connect
    await adapter.connect(config);

    // Cache the adapter
    this.adapterCache.set(connection.id, adapter);

    return adapter;
  }

  /**
   * Disconnects and removes an adapter from cache.
   */
  private async disconnectAdapter(connectionId: string): Promise<void> {
    const adapter = this.adapterCache.get(connectionId);
    if (adapter) {
      try {
        await adapter.disconnect();
      } catch (error) {
        // Log error but don't throw
        console.error(`Error disconnecting adapter: ${error.message}`);
      }
      this.adapterCache.delete(connectionId);
    }
  }

  /**
   * Cleanup method to disconnect all adapters (call on module destroy).
   */
  async onModuleDestroy() {
    const disconnectPromises = Array.from(this.adapterCache.keys()).map((id) =>
      this.disconnectAdapter(id),
    );
    await Promise.all(disconnectPromises);
  }
}
