/**
 * Terminal Test Harness
 *
 * Provides automated testing framework for different terminal emulators
 * including Terminal.app, iTerm2, Alacritty, Windows Terminal, and others.
 */

import type { TerminalCapabilities } from '../framework/UIFramework';
import { CapabilityDetector } from './CapabilityDetector';
import { ColorSupport } from './ColorSupport';
import { FallbackRenderer } from './FallbackRenderer';
import {
  TerminalSizeValidator,
  type SizeValidationResult,
} from './TerminalSizeValidator';
import { executeTerminalTest } from './TerminalTestUtils';
import { validateCapabilities } from './helpers/CapabilityValidation';
import {
  getTerminalConfigurations,
  detectCurrentTerminal,
} from './helpers/TerminalDefinitions';
import {
  generateTestSummary,
  checkPerformance,
} from './helpers/TerminalTestHelpers';
import type {
  ColorCapabilities,
  UnicodeCapabilities,
  MouseCapabilities,
} from './types';

export interface TestTerminalCapabilities {
  color?: Partial<ColorCapabilities>;
  unicode?: Partial<UnicodeCapabilities>;
  mouse?: Partial<MouseCapabilities>;
  altScreen?: boolean;
  cursorShape?: boolean;
}

export interface TestTerminal {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  capabilities: TestTerminalCapabilities | Partial<TerminalCapabilities>;
  expectedFeatures: string[];
  version?: string;
  platform?: string;
  notes?: string;
}

export interface TestResult {
  terminal: TestTerminal;
  success: boolean;
  duration: number;
  capabilities: TerminalCapabilities;
  errors: string[];
  warnings: string[];
  performance: {
    startupTime: number;
    detectionTime: number;
    renderTime: number;
  };
}

export interface CompatibilityReport {
  timestamp: string;
  totalTerminals: number;
  passed: number;
  failed: number;
  results: TestResult[];
  summary: {
    colorSupport: { basic: number; color256: number; trueColor: number };
    unicodeSupport: { basic: number; wide: number; emoji: number };
    mouseSupport: { basic: number; advanced: number };
    sizeCompliance: number;
  };
}

export class TerminalTestHarness {
  private terminals: TestTerminal[];
  private capabilityDetector: CapabilityDetector;
  private colorSupport: ColorSupport;
  private sizeValidator: TerminalSizeValidator;
  private fallbackRenderer: FallbackRenderer;
  private originalEnv: Record<string, string | undefined>;

  constructor() {
    this.terminals = getTerminalConfigurations();
    this.capabilityDetector = new CapabilityDetector();
    this.colorSupport = new ColorSupport();
    this.sizeValidator = new TerminalSizeValidator();
    this.fallbackRenderer = new FallbackRenderer();
    this.originalEnv = {};
  }

  /**
   * Run tests on all supported terminals
   */
  public async testAllTerminals(): Promise<CompatibilityReport> {
    const results: TestResult[] = [];

    for (const terminal of this.terminals) {
      const result = await this.testTerminal(terminal);
      results.push(result);
    }

    return this.generateReport(results);
  }

  /**
   * Run test on current terminal environment
   */
  public async testCurrentTerminal(): Promise<TestResult> {
    const terminal = detectCurrentTerminal(this.terminals);
    return this.testTerminal(terminal);
  }

  /**
   * Run current terminal test (alias for testCurrentTerminal)
   */
  public async runCurrentTerminalTest(): Promise<TestResult> {
    return this.testCurrentTerminal();
  }

  /**
   * Run test on specific terminal
   */
  public async testSpecificTerminal(name: string): Promise<TestResult> {
    const terminal = this.terminals.find((t) => t.name === name);
    if (!terminal) {
      throw new Error(`Terminal ${name} not found`);
    }
    return this.testTerminal(terminal);
  }

  /**
   * Get all supported terminals
   */
  public getSupportedTerminals(): TestTerminal[] {
    return [...this.terminals];
  }

  /**
   * Test capabilities for a specific terminal (backward compatibility)
   */
  public async testCapabilities(terminalName: string): Promise<TestResult> {
    // Map common terminal names to their actual configuration names
    const nameMapping: Record<string, string> = {
      'Terminal.app': 'macOS Terminal.app',
      'iTerm.app': 'iTerm2',
      // Keep original names as fallbacks
      'macOS Terminal.app': 'macOS Terminal.app',
      iTerm2: 'iTerm2',
      Alacritty: 'Alacritty',
      'Windows Terminal': 'Windows Terminal',
    };

    const actualName = nameMapping[terminalName] || terminalName;
    return this.testSpecificTerminal(actualName);
  }

  /**
   * Test a terminal configuration (public for CompatibilityMatrixGenerator)
   */
  public async testTerminal(terminal: TestTerminal): Promise<TestResult> {
    return executeTerminalTest(terminal, {
      setupTerminalEnvironment: (t) => this.setupTerminalEnvironment(t),
      restoreTerminalEnvironment: () => this.restoreTerminalEnvironment(),
      capabilityDetector: this.capabilityDetector,
      testColorSupport: async (t) => {
        await this.testColorSupport(t);
      },
      testSizeValidation: () => this.testSizeValidation(),
      testFallbackRendering: async () => {
        await this.testFallbackRendering();
      },
      validateCapabilities: (t, c) => validateCapabilities(t, c),
      checkPerformance: (d, r) => checkPerformance(d, r),
    });
  }

  /**
   * Set up environment for terminal testing
   */
  private setupTerminalEnvironment(terminal: TestTerminal): void {
    // Store original environment
    this.originalEnv = { ...process.env };

    // Apply terminal-specific environment
    Object.assign(process.env, terminal.env);
  }

  /**
   * Restore original environment
   */
  private restoreTerminalEnvironment(): void {
    if (this.originalEnv !== null && this.originalEnv !== undefined) {
      process.env = this.originalEnv;
    }
  }

  /**
   * Test color support for terminal
   */
  private async testColorSupport(_terminal: TestTerminal): Promise<boolean> {
    const basic = this.colorSupport.detectBasicColor();
    const color256 = this.colorSupport.detect256Color();
    const trueColor = this.colorSupport.detectTrueColor();

    return basic !== false || color256 !== false || trueColor !== false;
  }

  /**
   * Test size validation
   */
  private testSizeValidation(): SizeValidationResult {
    return this.sizeValidator.validateSize();
  }

  /**
   * Test fallback rendering
   */
  private async testFallbackRendering(): Promise<boolean> {
    try {
      const testContent = 'Test: Hello, 世界! 🌟';
      const result = this.fallbackRenderer.render(testContent, 'ascii');
      return typeof result === 'string' && result.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Generate compatibility report
   */
  private generateReport(results: TestResult[]): CompatibilityReport {
    const passed = results.filter((r) => r.success).length;
    const failed = results.length - passed;

    return {
      timestamp: new Date().toISOString(),
      totalTerminals: results.length,
      passed,
      failed,
      results,
      summary: generateTestSummary(results),
    };
  }
}
