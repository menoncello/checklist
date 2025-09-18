import { createDefaultFallbacks } from './DefaultFallbacks';
import {
  FallbackOptions,
  RenderFallback,
  CompatibilityReport,
} from './FallbackTypes';
import { FallbackUtils } from './FallbackUtils';

export { FallbackOptions, RenderFallback, CompatibilityReport };

export class FallbackRenderer {
  private fallbacks: RenderFallback[] = [];
  private options: FallbackOptions;

  constructor(options: Partial<FallbackOptions> = {}) {
    this.options = {
      useAsciiOnly: false,
      maxWidth: 120,
      maxHeight: 50,
      stripColors: false,
      simplifyBoxDrawing: false,
      preserveLayout: true,
      ...options,
    };

    this.setupDefaultFallbacks();
  }

  private setupDefaultFallbacks(): void {
    const defaultFallbacks = createDefaultFallbacks();

    // Apply user preferences to filter fallbacks
    const filteredFallbacks = defaultFallbacks.filter((fallback) => {
      switch (fallback.name) {
        case 'stripColors':
          return this.options.stripColors;
        case 'asciiOnly':
          return this.options.useAsciiOnly;
        case 'simplifyBoxDrawing':
          return this.options.simplifyBoxDrawing;
        case 'limitDimensions':
          return (
            this.options.maxWidth < Infinity ||
            this.options.maxHeight < Infinity
          );
        case 'simplifyLayout':
          return !this.options.preserveLayout;
        default:
          return true;
      }
    });

    this.fallbacks = filteredFallbacks;
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
      if (fallback.condition(capabilities)) {
        result = fallback.transform(result, this.options);
        applicableFallbacks.push(fallback.name);
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

    // Check for compatibility issues
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

    // Check which fallbacks would be applied
    for (const fallback of this.fallbacks) {
      if (fallback.condition(capabilities)) {
        report.fallbacksUsed.push(fallback.name);
      }
    }

    return report;
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
