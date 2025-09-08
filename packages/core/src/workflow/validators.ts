import { existsSync } from 'fs';
import { StepValidation, ValidationResult, StepContext } from './types';

export async function validateStep(
  validation: StepValidation,
  context: StepContext
): Promise<ValidationResult> {
  switch (validation.type) {
    case 'command':
      // Command validation disabled for security reasons
      // Using spawn with shell: true is a security risk
      return {
        valid: false,
        error: 'Command validation is disabled for security reasons in MVP',
      };

    case 'file_exists':
      return validateFileExists(validation.check);

    case 'custom':
      return await validateCustom(validation.check, context);

    default:
      return {
        valid: false,
        error: `Unknown validation type: ${validation.type}`,
      };
  }
}

function validateFileExists(path: string): ValidationResult {
  const exists = existsSync(path);

  return {
    valid: exists,
    error: exists ? undefined : `File not found: ${path}`,
  };
}

async function validateCustom(
  _validationCode: string,

  _context: StepContext
): Promise<ValidationResult> {
  // For MVP, custom validation is disabled for security
  // This can be enabled post-MVP with proper sandboxing
  return {
    valid: true,
    error: 'Custom validation not implemented in MVP',
  };
}
