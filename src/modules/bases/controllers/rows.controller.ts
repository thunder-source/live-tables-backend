import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RowsService } from '../services/rows.service';
import { CreateRowDto, UpdateRowDto, BulkCreateRowsDto, QueryRowsDto } from '../dto/row.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Rows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('')
export class RowsController {
  constructor(private readonly rowsService: RowsService) {}

  @Post('tables/:tableId/rows')
  @ApiOperation({ summary: 'Create a new row in a table' })
  @ApiResponse({ status: 201, description: 'Row created with JSONB data' })
  async create(
    @Param('tableId') tableId: string,
    @Body() createRowDto: CreateRowDto,
    @Request() req: any,
  ) {
    return await this.rowsService.create(tableId, req.user.id, createRowDto);
  }

  @Get('tables/:tableId/rows')
  @ApiOperation({ summary: 'Get all rows in a table with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Rows retrieved successfully' })
  async findAll(
    @Param('tableId') tableId: string,
    @Query() query: QueryRowsDto,
  ) {
    return await this.rowsService.findAll(tableId, query);
  }

  @Get('tables/:tableId/rows/:rowId')
  @ApiOperation({ summary: 'Get a single row by ID' })
  @ApiResponse({ status: 200, description: 'Row retrieved successfully' })
  async findOne(
    @Param('tableId') tableId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.rowsService.findOne(tableId, rowId);
  }

  @Put('tables/:tableId/rows/:rowId')
  @ApiOperation({ summary: 'Update a row with optimistic locking' })
  @ApiResponse({ status: 200, description: 'Row updated successfully' })
  async update(
    @Param('tableId') tableId: string,
    @Param('rowId') rowId: string,
    @Body() updateRowDto: UpdateRowDto,
    @Request() req: any,
  ) {
    return await this.rowsService.update(tableId, rowId, req.user.id, updateRowDto);
  }

  @Delete('tables/:tableId/rows/:rowId')
  @ApiOperation({ summary: 'Soft delete a row' })
  @ApiResponse({ status: 200, description: 'Row deleted successfully' })
  async remove(
    @Param('tableId') tableId: string,
    @Param('rowId') rowId: string,
  ) {
    await this.rowsService.remove(tableId, rowId);
    return { message: 'Row deleted successfully' };
  }

  @Post('tables/:tableId/rows/bulk')
  @ApiOperation({ summary: 'Bulk create multiple rows in a transaction' })
  @ApiResponse({ status: 201, description: 'Rows created successfully' })
  async bulkCreate(
    @Param('tableId') tableId: string,
    @Body() bulkCreateDto: BulkCreateRowsDto,
    @Request() req: any,
  ) {
    return await this.rowsService.bulkCreate(tableId, req.user.id, bulkCreateDto);
  }
}
