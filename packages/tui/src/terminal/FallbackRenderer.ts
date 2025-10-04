import { createDefaultFallbacks } from './DefaultFallbacks';
import {
  type FallbackOptions,
  type RenderFallback,
  type CompatibilityReport,
} from './FallbackTypes';
import { FallbackUtils } from './FallbackUtils';

export { type FallbackOptions, type RenderFallback, type CompatibilityReport };

export class FallbackRenderer {
  private fallbacks: RenderFallback[] = [];
  private options: FallbackOptions;

  constructor(options: Partial<FallbackOptions> = {}) {
    this.options = {
      useAsciiOnly: false,
      maxWidth: Infinity,
      maxHeight: Infinity,
      stripColors: false,
      simplifyBoxDrawing: false,
      preserveLayout: true,
      ...options,
    };

    this.setupDefaultFallbacks();
  }

  private setupDefaultFallbacks(): void {
    const defaultFallbacks = createDefaultFallbacks();

    // Add all default fallbacks - their conditions will determine when they apply
    this.fallbacks = [...defaultFallbacks];
  }

  public addFallback(fallback: RenderFallback): void {
    this.fallbacks.push(fallback);
    this.fallbacks.sort((a, b) => b.priority - a.priority);
  }

  public removeFallback(name: string): boolean {
    const index = this.fallbacks.findIndex((f) => f.name === name);
    if (index !== -1) {
      this.fallbacks.splice(index, 1);
      return true;
    }
    return false;
  }

  public render(content: string, capabilities: unknown): string {
    let result = content;
    const applicableFallbacks: string[] = [];

    // Apply fallbacks in priority order
    for (const fallback of this.fallbacks) {
      try {
        if (fallback.condition(capabilities)) {
          result = fallback.transform(result, this.options);
          applicableFallbacks.push(fallback.name);
        }
      } catch (error) {
        // Skip this fallback if it throws an error
        console.warn(`Fallback '${fallback.name}' failed:`, error);
      }
    }

    return result;
  }

  public updateOptions(newOptions: Partial<FallbackOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.setupDefaultFallbacks();
  }

  public getOptions(): Readonly<FallbackOptions> {
    return { ...this.options };
  }

  public getFallbacks(): ReadonlyArray<RenderFallback> {
    return [...this.fallbacks];
  }

  public checkCompatibility(capabilities: unknown): CompatibilityReport {
    const report: CompatibilityReport = {
      compatible: true,
      issues: [],
      recommendations: [],
      fallbacksUsed: [],
    };

    const capsObj = capabilities as Record<string, unknown> | null | undefined;

    if (!capsObj) {
      report.issues.push('No terminal capabilities provided');
      report.recommendations.push('Provide terminal capability information');
      report.compatible = false;
      return report;
    }

    this.checkCapabilitySupport(capsObj, report);
    this.checkApplicableFallbacks(capabilities, report);

    return report;
  }

  private checkCapabilitySupport(
    capsObj: Record<string, unknown>,
    report: CompatibilityReport
  ): void {
    if (!FallbackUtils.hasColorSupport(capsObj)) {
      report.issues.push('Limited or no color support detected');
      report.recommendations.push('Consider enabling stripColors option');
    }

    if (!FallbackUtils.hasUnicodeSupport(capsObj)) {
      report.issues.push('Limited Unicode support detected');
      report.recommendations.push('Consider enabling useAsciiOnly option');
    }

    if (FallbackUtils.isMinimalTerminal(capsObj)) {
      report.issues.push('Minimal terminal capabilities detected');
      report.recommendations.push('Consider enabling simplifyLayout option');
      report.compatible = false;
    }
  }

  private checkApplicableFallbacks(
    capabilities: unknown,
    report: CompatibilityReport
  ): void {
    for (const fallback of this.fallbacks) {
      try {
        if (fallback.condition(capabilities)) {
          // Special handling for limitDimensions - only count if dimensions are finite
          this.addFallbackToReport(fallback, report);
        }
      } catch (error) {
        console.warn(
          `Fallback '${fallback.name}' condition check failed:`,
          error
        );
      }
    }
  }

  public testRender(
    content: string,
    testCapabilities: Partial<Record<string, unknown>>
  ): {
    result: string;
    fallbacksApplied: string[];
    compatibilityReport: CompatibilityReport;
  } {
    const fallbacksApplied: string[] = [];
    let result = content;

    // Apply fallbacks and track which ones were used
    for (const fallback of this.fallbacks) {
      if (fallback.condition(testCapabilities)) {
        result = fallback.transform(result, this.options);
        fallbacksApplied.push(fallback.name);
      }
    }

    const compatibilityReport = this.checkCompatibility(testCapabilities);

    return {
      result,
      fallbacksApplied,
      compatibilityReport,
    };
  }

  public getCompatibilityWarnings(capabilities: unknown): string[] {
    const report = this.checkCompatibility(capabilities);
    const warnings: string[] = [];

    this.addCapabilityWarnings(capabilities, warnings);
    this.addReportWarnings(report, warnings);

    return warnings;
  }

  private addFallbackToReport(
    fallback: { name: string },
    report: { fallbacksUsed: string[] }
  ): void {
    if (fallback.name === 'limitDimensions') {
      if (isFinite(this.options.maxWidth) || isFinite(this.options.maxHeight)) {
        report.fallbacksUsed.push(fallback.name);
      }
    } else {
      report.fallbacksUsed.push(fallback.name);
    }
  }

  private addCapabilityWarnings(
    capabilities: unknown,
    warnings: string[]
  ): void {
    const caps = capabilities as Record<string, unknown> | null | undefined;
    if (!caps) return;

    this.addColorWarning(caps, warnings);
    this.addUnicodeWarning(caps, warnings);
    this.addMouseWarning(caps, warnings);
    this.addScreenWarning(caps, warnings);
    this.addCursorWarning(caps, warnings);
  }

  private addColorWarning(
    caps: Record<string, unknown>,
    warnings: string[]
  ): void {
    if (caps.color === false) {
      warnings.push('⚠ Limited color support detected');
      warnings.push('Display will be in monochrome mode');
    }
  }

  private addUnicodeWarning(
    caps: Record<string, unknown>,
    warnings: string[]
  ): void {
    if (caps.unicode === false) {
      warnings.push('⚠ Limited Unicode support detected');
      warnings.push('Box drawing characters may not display correctly');
    }
  }

  private addMouseWarning(
    caps: Record<string, unknown>,
    warnings: string[]
  ): void {
    if (caps.mouse === false) {
      warnings.push('⚠ Mouse input unavailable');
      warnings.push('Use keyboard navigation instead');
    }
  }

  private addScreenWarning(
    caps: Record<string, unknown>,
    warnings: string[]
  ): void {
    if (caps.altScreen === false) {
      warnings.push('○ Alternate screen mode not available');
    }
  }

  private addCursorWarning(
    caps: Record<string, unknown>,
    warnings: string[]
  ): void {
    if (caps.cursorShape === false) {
      warnings.push('○ Cursor shape control not available');
    }
  }

  private addReportWarnings(
    report: {
      issues: string[];
      recommendations: string[];
      fallbacksUsed: string[];
    },
    warnings: string[]
  ): void {
    warnings.push(...report.issues);
    warnings.push(...report.recommendations);

    if (report.fallbacksUsed.length > 0) {
      warnings.push(`Using fallbacks: ${report.fallbacksUsed.join(', ')}`);
    }
  }

  public static createMinimalRenderer(): FallbackRenderer {
    return new FallbackRenderer({
      useAsciiOnly: true,
      maxWidth: 80,
      maxHeight: 24,
      stripColors: true,
      simplifyBoxDrawing: true,
      preserveLayout: false,
    });
  }

  public static createModernRenderer(): FallbackRenderer {
    return new FallbackRenderer({
      useAsciiOnly: false,
      maxWidth: 120,
      maxHeight: 50,
      stripColors: false,
      simplifyBoxDrawing: false,
      preserveLayout: true,
    });
  }
}
