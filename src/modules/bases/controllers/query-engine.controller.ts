import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { InternalDbExecutorService } from '../services/internal-db-executor.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

class ExecuteQueryDto {
  filters?: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';
    value: any;
  }>;

  sorts?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;

  pagination?: {
    limit?: number;
    offset?: number;
  };
}

@ApiTags('Query Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('')
export class QueryEngineController {
  constructor(
    private readonly executorService: InternalDbExecutorService,
  ) {}

  @Post('tables/:tableId/query')
  @ApiOperation({ 
    summary: 'Execute a complex query on internal table using LQP',
    description: 'Translates Logical Query Plan to JSONB-aware SQL and executes it'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'between'] },
              value: { }
            }
          }
        },
        sorts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              direction: { type: 'string', enum: ['asc', 'desc'] }
            }
          }
        },
        pagination: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            offset: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Query executed successfully' })
  async executeQuery(
    @Param('tableId') tableId: string,
    @Body() queryDto: ExecuteQueryDto,
  ) {
    const lqp = {
      source: {
        type: 'internal_table' as const,
        tableId,
      },
      filters: queryDto.filters || [],
      sorts: queryDto.sorts || [],
      pagination: queryDto.pagination || { limit: 10, offset: 0 },
    };

    return await this.executorService.executeQuery(tableId, lqp);
  }
}
