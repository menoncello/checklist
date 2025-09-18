import { InputValidator } from './InputValidator';
import { InputValidationResult } from './InputValidatorCore';

export class InputValidatorHelpers {
  static validateBatch(
    validator: InputValidator,
    inputs: string[]
  ): InputValidationResult[] {
    return inputs.map((input) => validator.validate(input));
  }

  static isInputSafe(validator: InputValidator, input: string): boolean {
    const result = validator.validate(input);
    return result.isValid;
  }

  static sanitizeInput(validator: InputValidator, input: string): string {
    const result = validator.validate(input);
    return result.sanitized;
  }

  static validateAndSanitize(
    validator: InputValidator,
    input: string
  ): {
    isValid: boolean;
    sanitized: string;
  } {
    const result = validator.validate(input);
    return {
      isValid: result.isValid,
      sanitized: result.sanitized,
    };
  }
}
