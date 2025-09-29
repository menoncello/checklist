import { createDefaultFallbacks } from './DefaultFallbacks';
import type {
  FallbackOptions,
  RenderFallback,
  CompatibilityReport,
} from './FallbackTypes';
import { FallbackUtils } from './FallbackUtils';

export type { FallbackOptions, RenderFallback, CompatibilityReport };

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

    // Keep all capability-based fallbacks, but filter option-based ones
    const filteredFallbacks = defaultFallbacks.map((fallback) => {
      // For limitDimensions, modify condition based on options
      if (fallback.name === 'limitDimensions') {
        const shouldApply =
          this.options.maxWidth < Infinity || this.options.maxHeight < Infinity;

        return {
          ...fallback,
          condition: () => shouldApply,
        };
      }

      // All other fallbacks keep their original conditions
      return fallback;
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

  public render(content: string, capabilitiesOrMode: unknown): string {
    // Support both capabilities object and mode string
    if (typeof capabilitiesOrMode === 'string') {
      return this.renderWithMode(content, capabilitiesOrMode);
    }

    let result = content;
    const applicableFallbacks: string[] = [];

    // Apply fallbacks in priority order
    for (const fallback of this.fallbacks) {
      if (fallback.condition(capabilitiesOrMode)) {
        result = fallback.transform(result, this.options);
        applicableFallbacks.push(fallback.name);
      }
    }

    return result;
  }

  private renderWithMode(content: string, mode: string): string {
    const modeOptions = this.getModeOptions(mode);
    const tempOptions = this.options;
    this.options = { ...this.options, ...modeOptions };
    this.setupDefaultFallbacks();

    const result = this.render(content, this.createCapabilitiesForMode(mode));

    this.options = tempOptions;
    this.setupDefaultFallbacks();
    return result;
  }

  private getModeOptions(mode: string): Partial<FallbackOptions> {
    switch (mode) {
      case 'ascii':
        return {
          useAsciiOnly: true,
          simplifyBoxDrawing: true,
          stripColors: false,
        };
      case 'monochrome':
        return {
          useAsciiOnly: false,
          stripColors: true,
        };
      case 'minimal':
        return {
          useAsciiOnly: true,
          stripColors: true,
          simplifyBoxDrawing: true,
        };
      case 'unicode':
        return {
          useAsciiOnly: false,
          stripColors: false,
          simplifyBoxDrawing: false,
        };
      default:
        return {};
    }
  }

  private createCapabilitiesForMode(mode: string): unknown {
    switch (mode) {
      case 'ascii':
        return { unicode: false, color: true };
      case 'monochrome':
        return { unicode: true, color: false };
      case 'minimal':
        return { unicode: false, color: false };
      case 'unicode':
        return { unicode: true, color: true };
      default:
        return { unicode: true, color: true };
    }
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

  public getCompatibilityWarnings(capabilities: unknown): string[] {
    const warnings: string[] = [];
    const capsObj = capabilities as Record<string, unknown> | null | undefined;

    this.addCapabilityWarnings(warnings, capsObj);
    this.addFeatureWarnings(warnings, capsObj);

    return warnings;
  }

  private addCapabilityWarnings(
    warnings: string[],
    capsObj: Record<string, unknown> | null | undefined
  ): void {
    if (!FallbackUtils.hasColorSupport(capsObj)) {
      warnings.push(
        '⚠️  Limited color support: Interface may appear in monochrome'
      );
    }
    if (!FallbackUtils.hasUnicodeSupport(capsObj)) {
      warnings.push(
        '⚠️  Limited Unicode support: Box drawing characters will be simplified'
      );
    }
    if (FallbackUtils.isMinimalTerminal(capsObj)) {
      warnings.push(
        '⚠️  Critical: Terminal has minimal capabilities - degraded experience'
      );
    }
  }

  private addFeatureWarnings(
    warnings: string[],
    capsObj: Record<string, unknown> | null | undefined
  ): void {
    const capRecord = capsObj as Record<string, unknown> | null;
    if (capRecord?.mouse === false) {
      warnings.push('⚠️  Mouse input unavailable: Use keyboard navigation');
    }
    if (capRecord?.altScreen === false) {
      warnings.push(
        '⚠️  Alternate screen buffer unavailable: May affect display'
      );
    }
    if (capRecord?.cursorShape === false) {
      warnings.push('⚠️  Cursor shape control unavailable');
    }
  }
}
