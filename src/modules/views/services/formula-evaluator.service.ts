import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FormulaEvaluatorService {
  /**
   * Evaluate a formula against row data
   * Supports:
   * - Field references: {fieldName}
   * - Basic operators: +, -, *, /, %
   * - Functions: UPPER(), LOWER(), CONCAT(), IF()
   */
  evaluate(formula: string, row: Record<string, any>): any {
    try {
      // Replace field references {fieldName} with actual values
      let processedFormula = this.replaceFieldReferences(formula, row);

      // Handle string functions
      processedFormula = this.evaluateStringFunctions(processedFormula, row);

      // Handle conditional functions
      processedFormula = this.evaluateConditionalFunctions(processedFormula, row);

      // Evaluate mathematical expression
      return this.evaluateMathExpression(processedFormula);
    } catch (error) {
      throw new BadRequestException(`Formula evaluation failed: ${error.message}`);
    }
  }

  /**
   * Replace {fieldName} with actual row values
   */
  private replaceFieldReferences(formula: string, row: Record<string, any>): string {
    return formula.replace(/\{([^}]+)\}/g, (match, fieldName) => {
      const value = row[fieldName.trim()];
      if (value === null || value === undefined) {
        return 'null';
      }
      // Quote strings
      if (typeof value === 'string') {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return String(value);
    });
  }

  /**
   * Evaluate string functions like UPPER(), LOWER(), CONCAT()
   */
  private evaluateStringFunctions(formula: string, row: Record<string,any>): string {
    // UPPER(value)
    formula = formula.replace(/UPPER\(([^)]+)\)/gi, (match: string, arg: string) => {
      const value = this.evaluateExpression(arg, row);
      return `"${String(value).toUpperCase()}"`;
    });

    // LOWER(value)
    formula = formula.replace(/LOWER\(([^)]+)\)/gi, (match: string, arg: string) => {
      const value = this.evaluateExpression(arg, row);
      return `"${String(value).toLowerCase()}"`;
    });

    // CONCAT(arg1, arg2, ...)
    formula = formula.replace(/CONCAT\(([^)]+)\)/gi, (match: string, args: string) => {
      const parts = args.split(',').map(arg => {
        const value = this.evaluateExpression(arg.trim(), row);
        return String(value);
      });
      return `"${parts.join('')}"`;
    });

    return formula;
  }

  /**
   * Evaluate conditional functions like IF(condition, trueValue, falseValue)
   */
  private evaluateConditionalFunctions(formula: string, row: Record<string, any>): string {
    // Simple IF function: IF(condition, trueValue, falseVal)
    formula = formula.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (match: string, condition: string, trueVal: string, falseVal: string) => {
      const conditionResult = this.evaluateCondition(condition.trim(), row);
      return conditionResult ? trueVal.trim() : falseVal.trim();
    });

    return formula;
  }

  /**
   * Evaluate a simple condition (e.g., "{status} = 'active'")
   */
  private evaluateCondition(condition: string, row: Record<string, any>): boolean {
    // Replace field references
    let processed = this.replaceFieldReferences(condition, row);

    // Handle equality
    if (processed.includes('=')) {
      const [left, right] = processed.split('=').map(s => s.trim());
      return this.cleanValue(left) === this.cleanValue(right);
    }

    // Handle inequality
    if (processed.includes('!=')) {
      const [left, right] = processed.split('!=').map(s => s.trim());
      return this.cleanValue(left) !== this.cleanValue(right);
    }

    // Handle greater than
    if (processed.includes('>')) {
      const [left, right] = processed.split('>').map(s => s.trim());
      return Number(this.cleanValue(left)) > Number(this.cleanValue(right));
    }

    // Handle less than
    if (processed.includes('<')) {
      const [left, right] = processed.split('<').map(s => s.trim());
      return Number(this.cleanValue(left)) < Number(this.cleanValue(right));
    }

    return false;
  }

  /**
   * Evaluate a simple expression (field reference or literal)
   */
  private evaluateExpression(expr: string, row: Record<string, any>): any {
    const processed = this.replaceFieldReferences(expr, row);
    return this.cleanValue(processed);
  }

  /**
   * Clean quotes from values
   */
  private cleanValue(value: string): any {
    const trimmed = value.trim();
    // Remove surrounding quotes
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    // Try to parse as number
    if (!isNaN(Number(trimmed))) {
      return Number(trimmed);
    }
    // Handle null
    if (trimmed === 'null') {
      return null;
    }
    return trimmed;
  }

  /**
   * Evaluate mathematical expression safely
   */
  private evaluateMathExpression(expression: string): any {
    // Remove all quotes around the expression if it's purely a string
    const trimmed = expression.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }

    // If expression contains only numbers and operators, evaluate it
    if (/^[\d\s+\-*\/.()%]+$/.test(trimmed)) {
      try {
        // Use Function constructor for safe evaluation (no eval)
        const result = new Function(`return ${trimmed}`)();
        return result;
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  /**
   * Validate formula syntax
   */
  validateFormula(formula: string): { valid: boolean; error?: string } {
    try {
      // Check for balanced braces
      const openBraces = (formula.match(/\{/g) || []).length;
      const closeBraces = (formula.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        return { valid: false, error: 'Unbalanced braces in formula' };
      }

      // Check for balanced parentheses
      const openParens = (formula.match(/\(/g) || []).length;
      const closeParens = (formula.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        return { valid: false, error: 'Unbalanced parentheses in formula' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
