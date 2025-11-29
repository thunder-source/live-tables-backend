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
import { TablesService } from '../services/tables.service';
import { CreateTableDto, UpdateTableDto } from '../dto/table.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post('bases/:baseId/tables')
  @ApiOperation({ summary: 'Create a new table in a base' })
  @ApiResponse({ status: 201, description: 'Table created successfully with physical JSONB storage' })
  async create(
    @Param('baseId') baseId: string,
    @Body() createTableDto: CreateTableDto,
    @Request() req: any,
  ) {
    return await this.tablesService.create(baseId, req.user.id, createTableDto);
  }

  @Get('bases/:baseId/tables')
  @ApiOperation({ summary: 'Get all tables in a base' })
  @ApiResponse({ status: 200, description: 'Tables retrieved successfully' })
  async findAll(@Param('baseId') baseId: string) {
    return await this.tablesService.findAllByBase(baseId);
  }

  @Get('tables/:id')
  @ApiOperation({ summary: 'Get a table by ID with its schema' })
  @ApiResponse({ status: 200, description: 'Table with columns retrieved successfully' })
  async findOne(@Param('id') id: string) {
    return await this.tablesService.findOne(id);
  }

  @Put('tables/:id')
  @ApiOperation({ summary: 'Update table metadata' })
  @ApiResponse({ status: 200, description: 'Table updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateTableDto: UpdateTableDto,
  ) {
    return await this.tablesService.update(id, updateTableDto);
  }

  @Delete('tables/:id')
  @ApiOperation({ summary: 'Delete a table (drops physical table)' })
  @ApiResponse({ status: 200, description: 'Table deleted successfully' })
  async remove(@Param('id') id: string) {
    await this.tablesService.remove(id);
    return { message: 'Table deleted successfully' };
  }
}
