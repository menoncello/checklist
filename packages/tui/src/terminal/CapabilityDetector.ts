import { TerminalCapabilities } from '../framework/UIFramework.js';
import { ColorSupport } from './ColorSupport.js';
import { TerminalInfo } from './TerminalInfo.js';

export interface CapabilityTest {
  name: string;
  test: () => Promise<boolean>;
  fallback?: boolean;
  timeout?: number;
  description?: string;
}

export interface DetectionResult {
  capabilities: TerminalCapabilities;
  detectionTime: number;
  testResults: Map<string, boolean>;
  warnings: string[];
  fallbacksUsed: string[];
}

export class CapabilityDetector {
  private terminalInfo: TerminalInfo;
  private colorSupport: ColorSupport;
  private testResults = new Map<string, boolean>();
  private eventHandlers = new Map<string, Set<Function>>();
  private detectionCache: DetectionResult | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamp = 0;

  constructor() {
    this.terminalInfo = new TerminalInfo();
    this.colorSupport = new ColorSupport();
  }

  public async detect(forceRefresh: boolean = false): Promise<DetectionResult> {
    if (!forceRefresh && this.isCacheValid()) {
      return (
        this.detectionCache ??
        this.createFallbackResult(0, new Error('Invalid cache'))
      );
    }

    const startTime = performance.now();
    const warnings: string[] = [];
    const fallbacksUsed: string[] = [];

    try {
      this.emit('detectionStarted');

      // Run all capability tests
      const testPromises = this.createCapabilityTests().map((test) =>
        this.runTest(test, warnings, fallbacksUsed)
      );

      await Promise.all(testPromises);

      // Build capabilities object
      const capabilities = this.buildCapabilities();

      const endTime = performance.now();
      const detectionTime = endTime - startTime;

      const result: DetectionResult = {
        capabilities,
        detectionTime,
        testResults: new Map(this.testResults),
        warnings,
        fallbacksUsed,
      };

      // Cache the result
      this.detectionCache = result;
      this.cacheTimestamp = Date.now();

      this.emit('detectionCompleted', result);
      return result;
    } catch (error) {
      this.emit('detectionError', error);
      // Return fallback capabilities
      return this.createFallbackResult(
        performance.now() - startTime,
        error as Error
      );
    }
  }

  private createCapabilityTests(): CapabilityTest[] {
    return [
      {
        name: 'color',
        test: () => this.testColorSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Basic color support (16 colors)',
      },
      {
        name: 'color256',
        test: () => this.testColor256Support(),
        fallback: false,
        timeout: 1000,
        description: '256 color support',
      },
      {
        name: 'trueColor',
        test: () => this.testTrueColorSupport(),
        fallback: false,
        timeout: 1000,
        description: '24-bit true color support',
      },
      {
        name: 'unicode',
        test: () => this.testUnicodeSupport(),
        fallback: true,
        timeout: 500,
        description: 'Unicode character support',
      },
      {
        name: 'mouse',
        test: () => this.testMouseSupport(),
        fallback: false,
        timeout: 2000,
        description: 'Mouse event support',
      },
      {
        name: 'altScreen',
        test: () => this.testAlternateScreenSupport(),
        fallback: false,
        timeout: 1500,
        description: 'Alternate screen buffer support',
      },
      {
        name: 'cursorShape',
        test: () => this.testCursorShapeSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Cursor shape modification support',
      },
      {
        name: 'windowTitle',
        test: () => this.testWindowTitleSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Window title modification support',
      },
      {
        name: 'clipboard',
        test: () => this.testClipboardSupport(),
        fallback: false,
        timeout: 1500,
        description: 'Clipboard access support',
      },
    ];
  }

  private async runTest(
    test: CapabilityTest,
    warnings: string[],
    fallbacksUsed: string[]
  ): Promise<void> {
    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(
          () => reject(new Error('Test timeout')),
          test.timeout ?? 1000
        );
      });

      const testResult = await Promise.race([test.test(), timeoutPromise]);

      this.testResults.set(test.name, testResult);
    } catch (error) {
      const fallback = test.fallback ?? false;
      this.testResults.set(test.name, fallback);

      if (fallback) {
        fallbacksUsed.push(test.name);
      } else {
        warnings.push(
          `Failed to detect ${test.name}: ${(error as Error).message}`
        );
      }
    }
  }

  private async testColorSupport(): Promise<boolean> {
    // Check environment variables first
    const colorSupport = this.colorSupport.detectBasicColor();
    if (colorSupport !== null) return colorSupport;

    // Fallback to terminal type detection
    return this.terminalInfo.supportsColor();
  }

  private async testColor256Support(): Promise<boolean> {
    const colorSupport = this.colorSupport.detect256Color();
    if (colorSupport !== null) return colorSupport;

    // Check terminal capabilities
    const term = this.terminalInfo.getTerminalType();
    return term.includes('256color') || term.includes('xterm');
  }

  private async testTrueColorSupport(): Promise<boolean> {
    const trueColorSupport = this.colorSupport.detectTrueColor();
    if (trueColorSupport !== null) return trueColorSupport;

    // Query terminal for true color support
    return this.queryTerminalCapability('\x1b[48;2;1;2;3m\x1b[0m', 1000);
  }

  private async testUnicodeSupport(): Promise<boolean> {
    try {
      // Test Unicode environment
      const lang = Bun.env.LANG ?? '';
      if (lang.includes('UTF-8') || lang.includes('utf8')) return true;

      // Test if we can output Unicode characters
      return this.testUnicodeOutput();
    } catch {
      return false;
    }
  }

  private async testUnicodeOutput(): Promise<boolean> {
    // This would ideally test actual Unicode rendering
    // For now, check encoding support
    try {
      const testString = '▲△▼▽◆◇○●★☆';
      const encoded = Buffer.from(testString, 'utf8');
      const decoded = encoded.toString('utf8');
      return decoded === testString;
    } catch {
      return false;
    }
  }

  private async testMouseSupport(): Promise<boolean> {
    // Check if terminal supports mouse events
    const term = this.terminalInfo.getTerminalType();

    // Known terminals with mouse support
    const mouseCapableTerminals = [
      'xterm',
      'screen',
      'tmux',
      'alacritty',
      'kitty',
    ];

    if (mouseCapableTerminals.some((t) => term.includes(t))) {
      return this.queryTerminalCapability('\x1b[?1000h\x1b[?1000l', 500);
    }

    return false;
  }

  private async testAlternateScreenSupport(): Promise<boolean> {
    const term = this.terminalInfo.getTerminalType();

    // Most modern terminals support alternate screen
    if (
      term.includes('xterm') ||
      term.includes('screen') ||
      term.includes('tmux')
    ) {
      return true;
    }

    // Test by attempting to switch to alternate screen briefly
    return this.queryTerminalCapability('\x1b[?1049h\x1b[?1049l', 500);
  }

  private async testCursorShapeSupport(): Promise<boolean> {
    const term = this.terminalInfo.getTerminalType();

    // Check for known terminals with cursor shape support
    const cursorShapeTerminals = [
      'xterm',
      'gnome-terminal',
      'alacritty',
      'kitty',
    ];
    return cursorShapeTerminals.some((t) => term.includes(t));
  }

  private async testWindowTitleSupport(): Promise<boolean> {
    // Only test if we're in a graphical terminal
    if (
      (Bun.env.SSH_TTY !== undefined && Bun.env.SSH_TTY.length > 0) ||
      (Bun.env.SSH_CONNECTION !== undefined &&
        Bun.env.SSH_CONNECTION.length > 0)
    )
      return false;

    const term = this.terminalInfo.getTerminalType();
    return (
      term.includes('xterm') ||
      term.includes('gnome') ||
      term.includes('alacritty')
    );
  }

  private async testClipboardSupport(): Promise<boolean> {
    // Check for OSC 52 clipboard support
    const term = this.terminalInfo.getTerminalType();
    const clipboardCapableTerminals = [
      'xterm',
      'alacritty',
      'kitty',
      'wezterm',
    ];

    return clipboardCapableTerminals.some((t) => term.includes(t));
  }

  private async queryTerminalCapability(
    sequence: string,
    timeout: number
  ): Promise<boolean> {
    if (process.stdin.isTTY !== true || process.stdout.isTTY !== true)
      return false;

    return new Promise((resolve) => {
      let responded = false;

      const responseHandler = (_data: Buffer) => {
        if (responded) return;
        responded = true;
        process.stdin.off('data', responseHandler);
        resolve(true);
      };

      const timeoutHandle = setTimeout(() => {
        if (responded) return;
        responded = true;
        process.stdin.off('data', responseHandler);
        resolve(false);
      }, timeout);

      // Set up response handler
      process.stdin.on('data', responseHandler);

      // Send query sequence
      process.stdout.write(sequence);

      // Clean up timeout on resolution
      Promise.resolve().then(() => {
        clearTimeout(timeoutHandle);
      });
    });
  }

  private buildCapabilities(): TerminalCapabilities {
    return {
      color: this.testResults.get('color') ?? false,
      color256: this.testResults.get('color256') ?? false,
      trueColor: this.testResults.get('trueColor') ?? false,
      unicode: this.testResults.get('unicode') ?? false,
      mouse: this.testResults.get('mouse') ?? false,
      altScreen: this.testResults.get('altScreen') ?? false,
      cursorShape: this.testResults.get('cursorShape') ?? false,
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
    const test = this.createCapabilityTests().find(
      (t) => t.name === capability
    );
    if (test === undefined) {
      throw new Error(`Unknown capability: ${capability}`);
    }

    try {
      return await test.test();
    } catch (_error) {
      return test.fallback ?? false;
    }
  }

  public getTestResults(): Map<string, boolean> {
    return new Map(this.testResults);
  }

  public getSupportedCapabilities(): string[] {
    const capabilities: string[] = [];

    for (const [capability, supported] of this.testResults) {
      if (supported) {
        capabilities.push(capability);
      }
    }

    return capabilities;
  }

  public getUnsupportedCapabilities(): string[] {
    const capabilities: string[] = [];

    for (const [capability, supported] of this.testResults) {
      if (!supported) {
        capabilities.push(capability);
      }
    }

    return capabilities;
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

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers !== undefined) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
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

export interface CapabilityReport {
  terminalType: string;
  terminalVersion: string | null;
  platform: string;
  ttyInfo: {
    isTTY: boolean;
    columns: number;
    rows: number;
  };
  environmentVars: Record<string, string>;
  capabilities: TerminalCapabilities;
  testResults: Record<string, boolean>;
  supported: string[];
  unsupported: string[];
  cacheInfo: {
    hasCache: boolean;
    cacheAge: number;
    isValid: boolean;
  };
}
