import { TerminalCapabilities } from '../framework/UIFramework.js';
import { CapabilityTester } from './CapabilityTester.js';
import { ColorSupport } from './ColorSupport.js';
import { TerminalInfo } from './TerminalInfo.js';
import { TestRunner } from './TestRunner.js';
import { DetectionResult, CapabilityReport, EventHandler } from './types.js';

export class CapabilityDetector {
  private terminalInfo: TerminalInfo;
  private colorSupport: ColorSupport;
  private tester: CapabilityTester;
  private testRunner: TestRunner;
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private detectionCache: DetectionResult | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamp = 0;

  constructor() {
    this.terminalInfo = new TerminalInfo();
    this.colorSupport = new ColorSupport();
    this.tester = new CapabilityTester(this.terminalInfo, this.colorSupport);
    this.testRunner = new TestRunner(this.tester);
  }

  public async detect(forceRefresh: boolean = false): Promise<DetectionResult> {
    if (!forceRefresh && this.isCacheValid()) {
      return this.getCachedResult();
    }

    const startTime = performance.now();

    try {
      this.emit('detectionStarted');

      const { testResults, warnings, fallbacksUsed } = await this.testRunner.runAllTests();
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
      this.emit('detectionCompleted', result);
      return result;
    } catch (error) {
      this.emit('detectionError', error);
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
    return {
      capabilities: params.capabilities,
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

  private buildCapabilitiesFromResults(testResults: Map<string, boolean>): TerminalCapabilities {
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

    return {
      capabilities: fallbackCapabilities,
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
      ? this.detectionCache.capabilities
      : null;
  }

  public async getCapabilities(
    forceRefresh?: boolean
  ): Promise<TerminalCapabilities> {
    const result = await this.detect(forceRefresh);
    return result.capabilities;
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
    const cached = this.getCachedCapabilities();
    const testResults = this.getTestResults();

    return {
      terminalType: this.terminalInfo.getTerminalType(),
      terminalVersion: this.terminalInfo.getVersion(),
      platform: this.terminalInfo.getPlatform(),
      ttyInfo: this.terminalInfo.getTTYInfo(),
      environmentVars: this.terminalInfo.getRelevantEnvVars(),
      capabilities:
        cached ??
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
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (_error) {
          console.error(
            `Error in capability detector event handler for '${event}':`,
            _error
          );
        }
      });
    }
  }
}

