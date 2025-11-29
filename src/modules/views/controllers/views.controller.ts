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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ViewsService } from '../services/views.service';
import { ViewExecutorService } from '../services/view-executor.service';
import { CreateViewDto, UpdateViewDto } from '../dto/view.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Views')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('')
export class ViewsController {
  constructor(
    private readonly viewsService: ViewsService,
    private readonly viewExecutor: ViewExecutorService,
  ) {}

  @Post('bases/:baseId/views')
  @ApiOperation({ summary: 'Create a new view in a base' })
  @ApiResponse({ status: 201, description: 'View created successfully' })
  async create(
    @Param('baseId') baseId: string,
    @Body() createViewDto: CreateViewDto,
    @Request() req: any,
  ) {
    // Validate view configuration
    const validation = await this.viewExecutor.validateViewConfiguration(createViewDto.configuration);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    return await this.viewsService.create(baseId, req.user.id, createViewDto);
  }

  @Get('bases/:baseId/views')
  @ApiOperation({ summary: 'Get all views in a base' })
  @ApiResponse({ status: 200, description: 'Views retrieved successfully' })
  async findAllByBase(@Param('baseId') baseId: string) {
    return await this.viewsService.findAllByBase(baseId);
  }

  @Get('tables/:tableId/views')
  @ApiOperation({ summary: 'Get all views for a table' })
  @ApiResponse({ status: 200, description: 'Views retrieved successfully' })
  async findAllByTable(@Param('tableId') tableId: string) {
    return await this.viewsService.findAllByTable(tableId);
  }

  @Get('views/:id')
  @ApiOperation({ summary: 'Get a view by ID' })
  @ApiResponse({ status: 200, description: 'View retrieved successfully' })
  async findOne(@Param('id') id: string) {
    return await this.viewsService.findOne(id);
  }

  @Put('views/:id')
  @ApiOperation({ summary: 'Update a view' })
  @ApiResponse({ status: 200, description: 'View updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateViewDto: UpdateViewDto,
  ) {
    // Validate configuration if provided
    if (updateViewDto.configuration) {
      const validation = await this.viewExecutor.validateViewConfiguration(updateViewDto.configuration);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }
    }

    return await this.viewsService.update(id, updateViewDto);
  }

  @Delete('views/:id')
  @ApiOperation({ summary: 'Delete a view' })
  @ApiResponse({ status: 200, description: 'View deleted successfully' })
  async remove(@Param('id') id: string) {
    await this.viewsService.remove(id);
    return { message: 'View deleted successfully' };
  }

  @Get('views/:id/data')
  @ApiOperation({ summary: 'Execute view and get data' })
  @ApiResponse({ status: 200, description: 'View data retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getViewData(
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Request() req?: any,
  ) {
    // Verify access
    await this.viewsService.verifyViewAccess(id, req?.user?.id);

    // Execute view
    return await this.viewExecutor.executeView(id, {
      limit: limit ? parseInt(String(limit), 10) : 10,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });
  }
}
