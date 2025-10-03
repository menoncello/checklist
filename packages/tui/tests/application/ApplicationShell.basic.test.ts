import { describe, expect, it, beforeEach } from 'bun:test';
import { ApplicationShell } from '../../src/application/ApplicationShell';
import { ApplicationShellConfig } from '../../src/application/ApplicationShellConfig';

// Test ID: 2.5-UNIT-001 - ApplicationShell constructor initializes
describe('ApplicationShell Basic Test', () => {
  let config: ApplicationShellConfig;

  beforeEach(() => {
    config = {
      version: '1.0.0',
      splitRatio: 0.7,
    };
  });

  it('should initialize with valid configuration', () => {
    // Given: Application is initialized with valid configuration
    // When: ApplicationShell constructor is called
    const applicationShell = new ApplicationShell(config);

    // Then: ApplicationShell should be properly initialized
    expect(applicationShell).toBeDefined();
    expect(applicationShell.render).toBeDefined();
    expect(applicationShell.initialize).toBeDefined();
  });
});