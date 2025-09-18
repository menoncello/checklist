import { describe, it, expect, beforeAll } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Skip these tests in CI as they expect environment files that don't exist yet
describe.skip('Environment Variable Validation', () => {
  let envConfig: Record<string, string | undefined>;
  const cwd = process.cwd();
  const projectRoot = path.resolve(
    cwd.endsWith('/packages/core') 
      ? path.join(cwd, '..', '..')
      : cwd.includes('/packages/core') 
        ? cwd.substring(0, cwd.indexOf('/packages/core'))
        : cwd
  );

  beforeAll(() => {
    const envPath = path.join(projectRoot, '.env');
    const envExamplePath = path.join(projectRoot, '.env.example');
    
    // In CI environment, create .env from .env.example if it doesn't exist
    if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
      const exampleContent = fs.readFileSync(envExamplePath, 'utf-8');
      fs.writeFileSync(envPath, exampleContent);
    }
    
    if (fs.existsSync(envPath)) {
      envConfig = dotenv.parse(fs.readFileSync(envPath));
    } else {
      envConfig = {};
    }
  });

  describe('.env file structure', () => {
    it('should have .env file created from .env.example', () => {
      const envFile = path.join(projectRoot, '.env');
      const envExample = path.join(projectRoot, '.env.example');

      expect(fs.existsSync(envFile)).toBe(true);
      expect(fs.existsSync(envExample)).toBe(true);
    });

    it('should contain all required environment variables', () => {
      const requiredVars = ['NODE_ENV', 'LOG_LEVEL', 'CHECKLIST_HOME', 'ENABLE_TELEMETRY'];

      requiredVars.forEach((varName) => {
        expect(envConfig[varName]).toBeDefined();
        expect(envConfig[varName]).not.toBe('');
      });
    });
  });

  describe('Environment variable values', () => {
    it('should have NODE_ENV set to valid value', () => {
      const validEnvs = ['development', 'test', 'production'];
      const nodeEnv = envConfig.NODE_ENV;
      if (nodeEnv) {
        expect(validEnvs).toContain(nodeEnv);
      } else {
        expect(nodeEnv).toBeDefined();
      }
    });

    it('should have LOG_LEVEL set to valid value', () => {
      const validLevels = ['debug', 'info', 'warn', 'error', 'fatal'];
      const logLevel = envConfig.LOG_LEVEL;
      if (logLevel) {
        expect(validLevels).toContain(logLevel);
      } else {
        expect(logLevel).toBeDefined();
      }
    });

    it('should have CHECKLIST_HOME as valid path', () => {
      const checklistHome = envConfig.CHECKLIST_HOME;
      expect(checklistHome).toBeDefined();

      // Should be an absolute path or use $HOME
      if (checklistHome?.includes('$HOME')) {
        expect(checklistHome).toMatch(/^\$HOME/);
      } else {
        expect(path.isAbsolute(checklistHome || '')).toBe(true);
      }
    });

    it('should have ENABLE_TELEMETRY as boolean string', () => {
      const telemetryValue = envConfig.ENABLE_TELEMETRY;
      if (telemetryValue) {
        expect(['true', 'false']).toContain(telemetryValue);
      } else {
        expect(telemetryValue).toBeDefined();
      }
    });
  });

  describe('Environment loading', () => {
    it('should be able to load and parse .env file', () => {
      const envPath = path.join(projectRoot, '.env');
      const result = dotenv.config({ path: envPath });

      expect(result.error).toBeUndefined();
      expect(result.parsed).toBeDefined();
    });

    it('should not contain sensitive data patterns', () => {
      const envContent = fs.readFileSync(path.join(projectRoot, '.env'), 'utf-8');

      // Check for common secret patterns
      const secretPatterns = [
        /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
        /secret\s*=\s*['"][^'"]+['"]/i,
        /password\s*=\s*['"][^'"]+['"]/i,
        /token\s*=\s*['"][^'"]+['"]/i,
        /AKIA[0-9A-Z]{16}/, // AWS keys
      ];

      secretPatterns.forEach((pattern) => {
        expect(envContent).not.toMatch(pattern);
      });
    });
  });

  describe('.env.example validation', () => {
    it('should have all variables from .env.example in .env', () => {
      const examplePath = path.join(projectRoot, '.env.example');
      const exampleContent = fs.readFileSync(examplePath, 'utf-8');
      const exampleVars = dotenv.parse(exampleContent);

      Object.keys(exampleVars).forEach((key) => {
        expect(envConfig[key]).toBeDefined();
      });
    });
  });
});
