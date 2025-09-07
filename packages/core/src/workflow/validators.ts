import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { StepValidation, ValidationResult, StepContext } from './types';

export async function validateStep(
  validation: StepValidation,
  context: StepContext
): Promise<ValidationResult> {
  switch (validation.type) {
    case 'command':
      return await validateCommand(validation.check);

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

async function validateCommand(command: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const child = spawn(command, [], {
      shell: true,
      timeout: 5000,
    });

    let errorOutput = '';

    child.stdout?.on('data', () => {
      // Collect output but don't use it (satisfies linting)
    });

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ valid: true });
      } else {
        resolve({
          valid: false,
          error: errorOutput || `Command exited with code ${code}`,
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        valid: false,
        error: error.message,
      });
    });
  });
}

function validateFileExists(path: string): ValidationResult {
  const exists = existsSync(path);

  return {
    valid: exists,
    error: exists ? undefined : `File not found: ${path}`,
  };
}

async function validateCustom(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _validationCode: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: StepContext
): Promise<ValidationResult> {
  // For MVP, custom validation is disabled for security
  // This can be enabled post-MVP with proper sandboxing
  return {
    valid: true,
    error: 'Custom validation not implemented in MVP',
  };
}
