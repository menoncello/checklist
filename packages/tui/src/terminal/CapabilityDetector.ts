import type { TerminalCapabilities } from '../framework/UIFramework';
import { CapabilityTester } from './CapabilityTester';
import { ColorSupport } from './ColorSupport';
import { TerminalInfo } from './TerminalInfo';
import { TestRunner } from './TestRunner';
import { EventManager } from './helpers/EventManager';
import { RateLimiter } from './helpers/RateLimiter';
import { WarningSystem } from './helpers/WarningSystem';
import {
  DetectionResult,
  CapabilityReport,
  EventHandler,
  flatToExtendedCapabilities,
  extendedToFlatCapabilities,
} from './types';

export class CapabilityDetector {
  private terminalInfo: TerminalInfo;
  private colorSupport: ColorSupport;
  private tester: CapabilityTester;
  private testRunner: TestRunner;
  private eventManager: EventManager;
  private warningSystem: WarningSystem;
  private detectionCache: DetectionResult | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamp = 0;
  private rateLimiter: RateLimiter;

  constructor() {
    this.terminalInfo = new TerminalInfo();
    this.colorSupport = new ColorSupport();
    this.tester = new CapabilityTester(this.terminalInfo, this.colorSupport);
    this.testRunner = new TestRunner(this.tester);
    this.eventManager = new EventManager();
    this.warningSystem = new WarningSystem();
    this.rateLimiter = new RateLimiter({
      maxQueries: 10,
      windowMs: 1000,
      blockDurationMs: 5000,
    });
  }

  public async detect(forceRefresh: boolean = false): Promise<DetectionResult> {
    if (!forceRefresh && this.isCacheValid()) {
      return this.getCachedResult();
    }

    // Check rate limiting
    if (!this.rateLimiter.canQuery()) {
      return this.handleRateLimitExceeded();
    }

    return this.performDetection();
  }

  private handleRateLimitExceeded(): DetectionResult {
    const status = this.rateLimiter.getStatus();
    return this.createFallbackResult(
      0,
      new Error(`Rate limit exceeded. Retry in ${status.timeUntilReset}ms`)
    );
  }

  private async performDetection(): Promise<DetectionResult> {
    const startTime = performance.now();

    try {
      this.rateLimiter.recordQuery();
      this.eventManager.emit('detectionStarted');

      const { testResults, warnings, fallbacksUsed } =
        await this.testRunner.runAllTests();
      const capabilities = this.buildCapabilitiesFromResults(testResults);
      const detectionTime = performance.now() - startTime;

      const result = this.createDetectionResult({
        capabilities,
        detectionTime,
        testResults,
        warnings,
        fallbacksUsed,
      });

      this.cacheResult(result);
      this.eventManager.emit('detectionCompleted', result);
      return result;
    } catch (error) {
      this.eventManager.emit('detectionError', error);
      return this.createFallbackResult(
        performance.now() - startTime,
        error as Error
      );
    }
  }

  private getCachedResult(): DetectionResult {
    return (
      this.detectionCache ??
      this.createFallbackResult(0, new Error('Invalid cache'))
    );
  }

  private createDetectionResult(params: {
    capabilities: TerminalCapabilities;
    detectionTime: number;
    testResults: Map<string, boolean>;
    warnings: string[];
    fallbacksUsed: string[];
  }): DetectionResult {
    const size = this.terminalInfo.getSize();
    const extendedCapabilities = flatToExtendedCapabilities(
      params.capabilities,
      {
        width: size.width,
        height: size.height,
        meetsMinimum: size.width >= 80 && size.height >= 24,
      }
    );

    return {
      capabilities: extendedCapabilities,
      detectionTime: params.detectionTime,
      testResults: new Map(params.testResults),
      warnings: params.warnings,
      fallbacksUsed: params.fallbacksUsed,
    };
  }

  private cacheResult(result: DetectionResult): void {
    this.detectionCache = result;
    this.cacheTimestamp = Date.now();
  }

  private buildCapabilitiesFromResults(
    testResults: Map<string, boolean>
  ): TerminalCapabilities {
    return {
      color: testResults.get('color') ?? false,
      color256: testResults.get('color256') ?? false,
      trueColor: testResults.get('trueColor') ?? false,
      unicode: testResults.get('unicode') ?? false,
      mouse: testResults.get('mouse') ?? false,
      altScreen: testResults.get('altScreen') ?? false,
      cursorShape: testResults.get('cursorShape') ?? false,
    };
  }

  private createFallbackResult(
    detectionTime: number,
    error: Error
  ): DetectionResult {
    const fallbackCapabilities: TerminalCapabilities = {
      color: false,
      color256: false,
      trueColor: false,
      unicode: true, // Assume Unicode support as fallback
      mouse: false,
      altScreen: false,
      cursorShape: false,
    };

    const size = this.terminalInfo.getSize();
    const extendedCapabilities = flatToExtendedCapabilities(
      fallbackCapabilities,
      {
        width: size.width,
        height: size.height,
        meetsMinimum: size.width >= 80 && size.height >= 24,
      }
    );

    return {
      capabilities: extendedCapabilities,
      detectionTime,
      testResults: new Map(),
      warnings: [`Capability detection failed: ${error.message}`],
      fallbacksUsed: ['all'],
    };
  }

  private isCacheValid(): boolean {
    if (!this.detectionCache) return false;
    return Date.now() - this.cacheTimestamp < this.cacheExpiry;
  }

  public getCachedCapabilities(): TerminalCapabilities | null {
    return this.isCacheValid() && this.detectionCache !== null
      ? extendedToFlatCapabilities(this.detectionCache.capabilities)
      : null;
  }

  public async getCapabilities(
    forceRefresh?: boolean
  ): Promise<TerminalCapabilities> {
    const result = await this.detect(forceRefresh);
    return extendedToFlatCapabilities(result.capabilities);
  }

  // Backward compatibility alias
  public async detectCapabilities(
    forceRefresh?: boolean
  ): Promise<DetectionResult> {
    return this.detect(forceRefresh);
  }

  public clearCache(): void {
    this.detectionCache = null;
    this.cacheTimestamp = 0;
  }

  public setCacheExpiry(milliseconds: number): void {
    this.cacheExpiry = milliseconds;
  }

  public getTerminalInfo(): TerminalInfo {
    return this.terminalInfo;
  }

  public getColorSupport(): ColorSupport {
    return this.colorSupport;
  }

  public async testSpecificCapability(capability: string): Promise<boolean> {
    // Apply rate limiting to individual capability tests
    if (!this.rateLimiter.canQuery()) {
      return false;
    }

    this.rateLimiter.recordQuery();
    return this.testRunner.testSpecificCapability(capability);
  }

  public getTestResults(): Map<string, boolean> {
    return this.testRunner.getTestResults();
  }

  public getSupportedCapabilities(): string[] {
    return this.testRunner.getSupportedCapabilities();
  }

  public getUnsupportedCapabilities(): string[] {
    return this.testRunner.getUnsupportedCapabilities();
  }

  public generateReport(): CapabilityReport {
    const testResults = this.getTestResults();

    return {
      terminalType: this.terminalInfo.getTerminalType(),
      terminalVersion: this.terminalInfo.getVersion(),
      platform: this.terminalInfo.getPlatform(),
      ttyInfo: this.terminalInfo.getTTYInfo(),
      environmentVars: {},
      capabilities:
        this.detectionCache?.capabilities ??
        this.createFallbackResult(0, new Error('No detection run'))
          .capabilities,
      testResults: Object.fromEntries(testResults),
      supported: this.getSupportedCapabilities(),
      unsupported: this.getUnsupportedCapabilities(),
      cacheInfo: {
        hasCache: Boolean(this.detectionCache),
        cacheAge: this.detectionCache ? Date.now() - this.cacheTimestamp : 0,
        isValid: this.isCacheValid(),
      },
    };
  }

  public on(event: string, handler: EventHandler): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler: EventHandler): void {
    this.eventManager.off(event, handler);
  }

  public getWarnings(capabilities?: TerminalCapabilities): string[] {
    const caps = capabilities ?? this.getCachedCapabilities();
    return this.warningSystem.getWarnings(caps ?? undefined);
  }

  public getSuggestions(capabilities?: TerminalCapabilities): string[] {
    const caps = capabilities ?? this.getCachedCapabilities();
    return this.warningSystem.getSuggestions(caps ?? undefined);
  }

  public getRecommendations(
    capabilities?: TerminalCapabilities,
    platform?: string
  ): string[] {
    const caps = capabilities ?? this.getCachedCapabilities();
    return this.warningSystem.getRecommendations(caps ?? undefined, platform);
  }

  public getSizeWarning(size: {
    width: number;
    height: number;
  }): string | null {
    const capabilities = this.getCachedCapabilities();
    return this.warningSystem.getSizeWarning(size, capabilities ?? undefined);
  }

  public getFeatureWarning(feature: string): string | null {
    const caps = this.getCachedCapabilities();
    return this.warningSystem.getFeatureWarning(feature, caps ?? undefined);
  }

  public getFallbackSuggestions(capabilities?: TerminalCapabilities): string[] {
    const caps = capabilities ?? this.getCachedCapabilities();
    return this.warningSystem.getFallbackSuggestions(caps ?? undefined);
  }

  public isWarningAcknowledged(warning: string): boolean {
    return this.warningSystem.isWarningAcknowledged(warning);
  }

  public acknowledgeWarning(warning: string): void {
    this.warningSystem.acknowledgeWarning(warning);
  }
}
