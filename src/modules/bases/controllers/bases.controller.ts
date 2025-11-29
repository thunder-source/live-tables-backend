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
import { BasesService } from '../services/bases.service';
import { CreateBaseDto, UpdateBaseDto } from '../dto/base.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Bases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('')
export class BasesController {
  constructor(private readonly basesService: BasesService) {}

  @Post('workspaces/:workspaceId/bases')
  @ApiOperation({ summary: 'Create a new base in a workspace' })
  @ApiResponse({ status: 201, description: 'Base created successfully' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() createBaseDto: CreateBaseDto,
    @Request() req: any,
  ) {
    return await this.basesService.create(workspaceId, req.user.id, createBaseDto);
  }

  @Get('workspaces/:workspaceId/bases')
  @ApiOperation({ summary: 'Get all bases in a workspace' })
  @ApiResponse({ status: 200, description: 'Bases retrieved successfully' })
  async findAll(@Param('workspaceId') workspaceId: string) {
    return await this.basesService.findAllByWorkspace(workspaceId);
  }

  @Get('bases/:id')
  @ApiOperation({ summary: 'Get a base by ID' })
  @ApiResponse({ status: 200, description: 'Base retrieved successfully' })
  async findOne(@Param('id') id: string) {
    return await this.basesService.findOne(id);
  }

  @Put('bases/:id')
  @ApiOperation({ summary: 'Update a base' })
  @ApiResponse({ status: 200, description: 'Base updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateBaseDto: UpdateBaseDto,
  ) {
    return await this.basesService.update(id, updateBaseDto);
  }

  @Delete('bases/:id')
  @ApiOperation({ summary: 'Delete a base' })
  @ApiResponse({ status: 200, description: 'Base deleted successfully' })
  async remove(@Param('id') id: string) {
    await this.basesService.remove(id);
    return { message: 'Base deleted successfully' };
  }
}
