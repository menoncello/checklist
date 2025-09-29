/**
 * Compatibility Test Suite
 *
 * Comprehensive testing framework that combines capability detection,
 * visual regression testing, and terminal compatibility validation.
 */

import type { TerminalCapabilities } from '../framework/UIFramework';
import { CapabilityDetector } from './CapabilityDetector';
import {
  type DetectionResult,
  type ColorSupportResult,
  type FallbackRenderingResult,
} from './CapabilityTestUtils';
import { ColorSupport } from './ColorSupport';
import {
  runFullTestSuite,
  runQuickCheck,
  type QuickCheckResult,
} from './CompatibilityTestSuiteCore';
import { FallbackRenderer } from './FallbackRenderer';
import {
  TerminalSizeValidator,
  type SizeValidationResult,
} from './TerminalSizeValidator';
import { TerminalTestHarness, TestResult } from './TerminalTestHarness';
import {
  VisualRegressionTester,
  VisualTestResult,
} from './VisualRegressionTester';

export interface TestSuiteConfig {
  includeVisualTests: boolean;
  includePerformanceTests: boolean;
  includeCapabilityTests: boolean;
  createBaselines: boolean;
  testTimeout: number;
  parallelTests: boolean;
}

export interface ComprehensiveTestResult {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    terminal: string;
    termProgram: string;
    shell: string;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    successRate: number;
  };
  capabilityResults: {
    detector?: DetectionResult;
    colorSupport?: ColorSupportResult;
    sizeValidation?: SizeValidationResult;
    fallbackRendering?: FallbackRenderingResult[];
  };
  terminalTestResults?: TestResult[];
  visualTestResults?: VisualTestResult[];
  performanceMetrics?: {
    detectionOverhead: number;
    renderingSpeed: number;
    memoryUsage: number;
    cpuUsage?: number;
  };
  recommendations: string[];
  compliance: {
    storyRequirements: StoryRequirementCheck[];
    overallCompliance: number;
  };
}

export interface StoryRequirementCheck {
  requirement: string;
  description: string;
  implemented: boolean;
  tested: boolean;
  passed: boolean;
  details: string;
}

export class CompatibilityTestSuite {
  private terminalHarness: TerminalTestHarness;
  private visualTester: VisualRegressionTester;
  private capabilityDetector: CapabilityDetector;
  private colorSupport: ColorSupport;
  private sizeValidator: TerminalSizeValidator;
  private fallbackRenderer: FallbackRenderer;
  private config: TestSuiteConfig;

  constructor(config: Partial<TestSuiteConfig> = {}) {
    this.config = {
      includeVisualTests: true,
      includePerformanceTests: true,
      includeCapabilityTests: true,
      createBaselines: false,
      testTimeout: 30000,
      parallelTests: false,
      ...config,
    };

    this.terminalHarness = new TerminalTestHarness();
    this.visualTester = new VisualRegressionTester();
    this.capabilityDetector = new CapabilityDetector();
    this.colorSupport = new ColorSupport();
    this.sizeValidator = new TerminalSizeValidator();
    this.fallbackRenderer = new FallbackRenderer();
  }

  /**
   * Run comprehensive test suite
   */
  public async runFullSuite(): Promise<ComprehensiveTestResult> {
    return runFullTestSuite({
      config: this.config,
      terminalHarness: this.terminalHarness,
      visualTester: this.visualTester,
      capabilityDetector: this.capabilityDetector,
      sizeValidator: this.sizeValidator,
    });
  }

  /**
   * Run quick compatibility check for current terminal
   */
  public async quickCheck(): Promise<QuickCheckResult> {
    return runQuickCheck(this.capabilityDetector, this.sizeValidator);
  }

  /**
   * Generate compatibility report
   */
  public async generateReport(): Promise<string> {
    const quickCheck = await this.quickCheck();
    return this.formatReport(quickCheck);
  }

  /**
   * Format compatibility report
   */
  private formatReport(quickCheck: QuickCheckResult): string {
    const report: string[] = [];

    this.addReportHeader(report);
    this.addEnvironmentInfo(report);
    this.addCompatibilityScore(report, quickCheck);
    this.addCapabilitiesSection(report, quickCheck);
    this.addIssuesSection(report, quickCheck);
    this.addRecommendationsSection(report, quickCheck);

    return report.join('\n');
  }

  /**
   * Add report header
   */
  private addReportHeader(report: string[]): void {
    report.push('='.repeat(60));
    report.push('TERMINAL COMPATIBILITY REPORT');
    report.push('='.repeat(60));
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');
  }

  /**
   * Add environment information
   */
  private addEnvironmentInfo(report: string[]): void {
    report.push('Environment:');
    report.push(`  Platform: ${process.platform} ${process.arch}`);
    report.push(`  Node.js: ${process.version}`);
    report.push(`  Terminal: ${process.env.TERM ?? 'unknown'}`);
    report.push(`  Program: ${process.env.TERM_PROGRAM ?? 'unknown'}`);
    report.push('');
  }

  /**
   * Add compatibility score visualization
   */
  private addCompatibilityScore(
    report: string[],
    quickCheck: QuickCheckResult
  ): void {
    report.push('Compatibility Score:');
    const scoreBar =
      '█'.repeat(Math.floor(quickCheck.score / 5)) +
      '░'.repeat(20 - Math.floor(quickCheck.score / 5));
    report.push(`  [${scoreBar}] ${quickCheck.score}%`);
    report.push('');
  }

  /**
   * Add capabilities section
   */
  private addCapabilitiesSection(
    report: string[],
    quickCheck: QuickCheckResult
  ): void {
    report.push('Capabilities:');
    const sizeValidation = this.sizeValidator.validateSize();
    report.push(
      `  Size: ${sizeValidation.currentWidth}x${sizeValidation.currentHeight} ${sizeValidation.isValid ? '✓' : '✗'}`
    );
    report.push(
      `  Color: Basic ${quickCheck.capabilities.color ? '✓' : '✗'} | 256 ${quickCheck.capabilities.color256 ? '✓' : '✗'} | True ${quickCheck.capabilities.trueColor ? '✓' : '✗'}`
    );
    report.push(`  Unicode: ${quickCheck.capabilities.unicode ? '✓' : '✗'}`);
    report.push(`  Mouse: ${quickCheck.capabilities.mouse ? '✓' : '✗'}`);
    report.push('');
  }

  /**
   * Add issues section
   */
  private addIssuesSection(
    report: string[],
    quickCheck: QuickCheckResult
  ): void {
    if (quickCheck.issues.length > 0) {
      report.push('Issues:');
      quickCheck.issues.forEach((issue, index) => {
        report.push(`  ${index + 1}. ${issue}`);
      });
      report.push('');
    }
  }

  /**
   * Add recommendations section
   */
  private addRecommendationsSection(
    report: string[],
    quickCheck: QuickCheckResult
  ): void {
    report.push('Recommendations:');
    const recommendations = this.generateRecommendationsFromCapabilities(
      quickCheck.capabilities
    );
    recommendations.forEach((rec) => {
      report.push(`  • ${rec}`);
    });
  }

  /**
   * Generate recommendations from capabilities
   */
  private generateRecommendationsFromCapabilities(
    capabilities: TerminalCapabilities
  ): string[] {
    const recommendations: string[] = [];

    // Check size validation separately
    const sizeValidation = this.sizeValidator.validateSize();
    if (!sizeValidation.isValid)
      recommendations.push(
        'Resize terminal to at least 80x24 for optimal experience'
      );

    // Check capabilities and add recommendations
    if (!capabilities.trueColor)
      recommendations.push(
        'Consider upgrading to a terminal with true color support'
      );
    if (!capabilities.color)
      recommendations.push(
        'Consider using a terminal with basic color support'
      );
    if (!capabilities.unicode)
      recommendations.push('Consider using a terminal with Unicode support');
    if (!capabilities.mouse)
      recommendations.push(
        'For better interaction, use a terminal with mouse support'
      );

    if (recommendations.length === 0) {
      recommendations.push('Your terminal has excellent compatibility!');
    }

    return recommendations;
  }
}
