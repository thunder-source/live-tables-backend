import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RowsService, RowData } from '../bases/services/rows.service';
import { UpdateRowDto } from '../bases/dto/row.dto';

export interface UpdateRowPayload {
  room: string;
  tableId: string;
  rowId: string;
  data: Record<string, any>;
  version?: number;
}

export interface UpdateResult {
  success: boolean;
  data?: RowData;
  error?: {
    code: string;
    message: string;
  };
}

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(private readonly rowsService: RowsService) {}

  async handleRowUpdate(
    server: Server,
    userId: string,
    payload: UpdateRowPayload,
  ): Promise<UpdateResult> {
    try {
      const updateDto: UpdateRowDto = {
        data: payload.data,
        version: payload.version,
      };

      // Update the row with versioning check
      const updatedRow = await this.rowsService.update(
        payload.tableId,
        payload.rowId,
        userId,
        updateDto,
      );

      // Broadcast to all clients in the room (except sender)
      server.to(payload.room).emit('row_updated', {
        tableId: payload.tableId,
        rowId: payload.rowId,
        data: updatedRow.data,
        version: updatedRow.version,
        updatedBy: userId,
        updatedAt: updatedRow.updated_at,
      });

      this.logger.log(`Row ${payload.rowId} updated successfully by user ${userId}`);

      return {
        success: true,
        data: updatedRow,
      };
    } catch (error) {
      this.logger.error(`Failed to update row ${payload.rowId}: ${error.message}`);

      // Return error for client rollback
      const errorCode = error.name === 'ConflictException' ? 'VERSION_CONFLICT' : 'UPDATE_FAILED';
      
      return {
        success: false,
        error: {
          code: errorCode,
          message: error.message,
        },
      };
    }
  }

  async handleBatchUpdate(
    server: Server,
    userId: string,
    payload: { room: string; tableId: string; updates: Array<{ rowId: string; data: Record<string, any>; version?: number }> },
  ): Promise<{ successful: string[]; failed: Array<{ rowId: string; error: string }> }> {
    const successful: string[] = [];
    const failed: Array<{ rowId: string; error: string }> = [];

    for (const update of payload.updates) {
      const result = await this.handleRowUpdate(server, userId, {
        room: payload.room,
        tableId: payload.tableId,
        rowId: update.rowId,
        data: update.data,
        version: update.version,
      });

      if (result.success) {
        successful.push(update.rowId);
      } else {
        failed.push({
          rowId: update.rowId,
          error: result.error?.message || 'Unknown error',
        });
      }
    }

    this.logger.log(`Batch update: ${successful.length} successful, ${failed.length} failed`);

    return { successful, failed };
  }
}
