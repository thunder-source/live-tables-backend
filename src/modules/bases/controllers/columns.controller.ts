import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ColumnsService } from '../services/columns.service';
import { CreateColumnDto, UpdateColumnDto, ReorderColumnsDto } from '../dto/column.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Columns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('')
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Post('tables/:tableId/columns')
  @ApiOperation({ summary: 'Add a new column to a table' })
  @ApiResponse({ status: 201, description: 'Column created (metadata only, no schema change)' })
  async create(
    @Param('tableId') tableId: string,
    @Body() createColumnDto: CreateColumnDto,
    @Request() req: any,
  ) {
    return await this.columnsService.create(tableId, req.user.id, createColumnDto);
  }

  @Get('tables/:tableId/columns')
  @ApiOperation({ summary: 'Get all columns for a table' })
  @ApiResponse({ status: 200, description: 'Columns retrieved successfully' })
  async findAll(@Param('tableId') tableId: string) {
    return await this.columnsService.findAllByTable(tableId);
  }

  @Get('columns/:id')
  @ApiOperation({ summary: 'Get a column by ID' })
  @ApiResponse({ status: 200, description: 'Column retrieved successfully' })
  async findOne(@Param('id') id: string) {
    return await this.columnsService.findOne(id);
  }

  @Put('columns/:id')
  @ApiOperation({ summary: 'Update column metadata' })
  @ApiResponse({ status: 200, description: 'Column updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateColumnDto: UpdateColumnDto,
  ) {
    return await this.columnsService.update(id, updateColumnDto);
  }

  @Delete('columns/:id')
  @ApiOperation({ summary: 'Delete a column' })
  @ApiResponse({ status: 200, description: 'Column deleted successfully' })
  async remove(@Param('id') id: string) {
    await this.columnsService.remove(id);
    return { message: 'Column deleted successfully' };
  }

  @Put('tables/:tableId/columns/reorder')
  @ApiOperation({ summary: 'Reorder columns in a table' })
  @ApiResponse({ status: 200, description: 'Columns reordered successfully' })
  async reorder(
    @Param('tableId') tableId: string,
    @Body() reorderDto: ReorderColumnsDto,
  ) {
    await this.columnsService.reorder(tableId, reorderDto);
    return { message: 'Columns reordered successfully' };
  }
}
