import { Injectable, NotFoundException } from '@nestjs/common';
import { ViewsService } from './views.service';
import { FormulaEvaluatorService } from './formula-evaluator.service';
import { InternalDbExecutorService, QueryResult } from '../../bases/services/internal-db-executor.service';
import { View } from '../entities/view.entity';

interface ViewExecutionOptions {
  limit?: number;
  offset?: number;
  overrideFilters?: any[];
  overrideSorts?: any[];
}

@Injectable()
export class ViewExecutorService {
  constructor(
    private readonly viewsService: ViewsService,
    private readonly formulaEvaluator: FormulaEvaluatorService,
    private readonly internalDbExecutor: InternalDbExecutorService,
  ) {}

  /**
   * Execute a view and return data
   */
  async executeView(
    viewId: string,
    options?: ViewExecutionOptions,
  ): Promise<QueryResult> {
    const view = await this.viewsService.findOne(viewId);

    // Generate LQP from view configuration
    const lqp = this.generateLqpFromView(view, options);

    // Execute query using internal DB executor
    const result = await this.internalDbExecutor.executeQuery(view.tableId, lqp);

    // Apply computed columns if any
    if (view.configuration.computedColumns && view.configuration.computedColumns.length > 0) {
      result.rows = result.rows.map(row => 
        this.applyComputedColumns(row, view.configuration.computedColumns!)
      );
    }

    // Filter visible columns if specified
    if (view.configuration.visibleColumns && view.configuration.visibleColumns.length > 0) {
      result.rows = result.rows.map(row => 
        this.filterVisibleColumns(row, view.configuration.visibleColumns!)
      );
    }

    return result;
  }

  /**
   * Generate Logical Query Plan from view configuration
   */
  private generateLqpFromView(view: View, options?: ViewExecutionOptions): any {
    const config = view.configuration;

    return {
      source: {
        type: 'internal_table' as const,
        tableId: view.tableId,
      },
      filters: options?.overrideFilters || config.filters || [],
      sorts: options?.overrideSorts || config.sorts || [],
      pagination: {
        limit: options?.limit || 10,
        offset: options?.offset || 0,
      },
    };
  }

  /**
   * Apply computed columns to a row
   */
  private applyComputedColumns(
    row: any,
    computedColumns: Array<{ name: string; formula: string; type: string }>,
  ): any {
    const result = { ...row };

    for (const computed of computedColumns) {
      try {
        // Evaluate formula against row data
        const value = this.formulaEvaluator.evaluate(computed.formula, row.data || row);
        
        // Add computed value to data object
        if (result.data) {
          result.data[computed.name] = value;
        } else {
          result[computed.name] = value;
        }
      } catch (error) {
        // If formula fails, set to null
        if (result.data) {
          result.data[computed.name] = null;
        } else {
          result[computed.name] = null;
        }
      }
    }

    return result;
  }

  /**
   * Filter row to only include visible columns
   */
  private filterVisibleColumns(row: any, visibleColumns: string[]): any {
    if (!row.data) {
      // If no data field, filter top-level keys
      const filtered: any = {};
      for (const col of visibleColumns) {
        if (col in row) {
          filtered[col] = row[col];
        }
      }
      // Keep metadata fields
      filtered.id = row.id;
      filtered.created_at = row.created_at;
      filtered.updated_at = row.updated_at;
      return filtered;
    }

    // Filter JSONB data object
    const filteredData: any = {};
    for (const col of visibleColumns) {
      if (col in row.data) {
        filteredData[col] = row.data[col];
      }
    }

    return {
      ...row,
      data: filteredData,
    };
  }

  /**
   * Validate view configuration
   */
  async validateViewConfiguration(configuration: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate computed column formulas
    if (configuration.computedColumns) {
      for (const computed of configuration.computedColumns) {
        const validation = this.formulaEvaluator.validateFormula(computed.formula);
        if (!validation.valid) {
          errors.push(`Invalid formula for '${computed.name}': ${validation.error}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
