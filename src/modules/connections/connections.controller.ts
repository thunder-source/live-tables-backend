import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ConnectionsService } from './services/connections.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { ConnectionResponseDto } from './dto/connection-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { plainToInstance } from 'class-transformer';

@ApiTags('connections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new database connection' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Connection created successfully',
    type: ConnectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input',
  })
  async create(
    @Body() createConnectionDto: CreateConnectionDto,
    @Request() req: any,
  ) {
    const connection = await this.connectionsService.create(
      createConnectionDto,
      req.workspace.id,
      req.user.id,
    );

    return plainToInstance(ConnectionResponseDto, connection, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all database connections for workspace' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of connections',
    type: [ConnectionResponseDto],
  })
  async findAll(@Request() req: any) {
    const connections = await this.connectionsService.findAll(
      req.workspace.id,
    );

    return plainToInstance(ConnectionResponseDto, connections, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a database connection by ID' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Connection details',
    type: ConnectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Connection not found',
  })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const connection = await this.connectionsService.findOne(
      id,
      req.workspace.id,
    );

    return plainToInstance(ConnectionResponseDto, connection, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a database connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Connection updated successfully',
    type: ConnectionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Connection not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateConnectionDto: UpdateConnectionDto,
    @Request() req: any,
  ) {
    const connection = await this.connectionsService.update(
      id,
      updateConnectionDto,
      req.workspace.id,
    );

    return plainToInstance(ConnectionResponseDto, connection, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a database connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Connection deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Connection not found',
  })
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.connectionsService.remove(id, req.workspace.id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a database connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Connection test result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Connection test failed',
  })
  async testConnection(@Param('id') id: string, @Request() req: any) {
    const success = await this.connectionsService.testConnection(
      id,
      req.workspace.id,
    );

    return {
      success,
      message: success
        ? 'Connection successful'
        : 'Connection failed - unable to reach database',
    };
  }

  @Get(':id/schema')
  @ApiOperation({ summary: 'Discover schema of a database connection' })
  @ApiParam({ name: 'id', description: 'Connection ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Database schema information',
    schema: {
      type: 'object',
      properties: {
        tables: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              columns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    isNullable: { type: 'boolean' },
                    isPrimaryKey: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Schema discovery failed',
  })
  async discoverSchema(@Param('id') id: string, @Request() req: any) {
    return await this.connectionsService.discoverSchema(id, req.workspace.id);
  }
}
