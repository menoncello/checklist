import { createLogger } from '@checklist/core/utils/logger';
import { CapabilityDetector } from './CapabilityDetector';
import { FallbackRenderer } from './FallbackRenderer';
import { TerminalManagerConfig } from './TerminalManagerConfig';
import { TerminalStateManager } from './TerminalStateManager';

const logger = createLogger('checklist:tui:terminal-initializer');

export class TerminalInitializer {
  constructor(
    private config: TerminalManagerConfig,
    private state: TerminalStateManager,
    private capabilityDetector: CapabilityDetector,
    private fallbackRenderer: FallbackRenderer
  ) {}

  public async initialize(): Promise<void> {
    logger.info({ msg: 'Initializing Terminal Manager' });

    try {
      await this.performInitialization();
      this.logInitializationSuccess();
    } catch (error) {
      await this.handleInitializationError(error as Error);
    }
  }

  private async performInitialization(): Promise<void> {
    // Check if TTY is available and set fallback mode if not
    if (!process.stdin.isTTY) {
      logger.warn({ msg: 'TTY not available, enabling fallback mode' });
      this.state.setFallbackMode(true);
      await this.initializeFallbackMode();
      this.state.setInitialized(true);
      return;
    }

    if (this.config.enableRawMode) {
      this.setupRawMode();
    }

    if (this.config.autoDetectCapabilities) {
      await this.detectCapabilities();
    }

    this.state.setInitialized(true);
  }

  private logInitializationSuccess(): void {
    const currentState = this.state.getState();
    logger.info({
      msg: 'Terminal Manager initialized successfully',
      supportsColor: currentState.supportsColor,
      supportsUnicode: currentState.supportsUnicode,
      width: currentState.width,
      height: currentState.height,
      fallbackMode: currentState.fallbackMode,
    });
  }

  private async handleInitializationError(error: Error): Promise<void> {
    logger.error({
      msg: 'Failed to initialize Terminal Manager',
      error: error.message,
    });

    if (this.config.fallbackRenderer) {
      logger.warn({
        msg: 'Entering fallback mode due to initialization failure',
      });
      this.state.setFallbackMode(true);
      await this.initializeFallbackMode();
    } else {
      throw error;
    }
  }

  private setupRawMode(): void {
    if (process.stdin.isTTY) {
      try {
        this.state.setOriginalMode(process.stdin.isRaw ? 1 : 0);
        process.stdin.setRawMode(true);
        logger.debug({ msg: 'Terminal raw mode enabled' });
      } catch (error) {
        logger.warn({
          msg: 'Failed to enable raw mode, continuing without it',
          error: (error as Error).message,
        });
        // Don't throw error, just continue without raw mode
      }
    }
  }

  private async detectCapabilities(): Promise<void> {
    const result = await this.capabilityDetector.detect();
    const capabilities = result.capabilities;

    const capabilityInfo = this.extractCapabilityInfo(capabilities);
    this.setCapabilities(capabilities, capabilityInfo);
    this.updateTerminalState(capabilityInfo);
  }

  private extractCapabilityInfo(capabilities: unknown): {
    hasColor: boolean;
    hasUnicode: boolean;
    columns: number;
    rows: number;
  } {
    if (this.isExtendedCapabilities(capabilities)) {
      return this.extractExtendedCapabilityInfo(capabilities);
    }

    return this.extractBasicCapabilityInfo(
      capabilities as Record<string, unknown>
    );
  }

  private extractExtendedCapabilityInfo(
    capabilities: import('./types').ExtendedTerminalCapabilities
  ): {
    hasColor: boolean;
    hasUnicode: boolean;
    columns: number;
    rows: number;
  } {
    return {
      hasColor:
        capabilities.color.basic ||
        capabilities.color.color256 ||
        capabilities.color.trueColor,
      hasUnicode: capabilities.unicode.basic,
      columns: capabilities.size.width ?? process.stdout.columns ?? 80,
      rows: capabilities.size.height ?? process.stdout.rows ?? 24,
    };
  }

  private extractBasicCapabilityInfo(capabilities: Record<string, unknown>): {
    hasColor: boolean;
    hasUnicode: boolean;
    columns: number;
    rows: number;
  } {
    return {
      hasColor: Boolean(
        capabilities.color ?? capabilities.color256 ?? capabilities.trueColor
      ),
      hasUnicode: Boolean(capabilities.unicode),
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
    };
  }

  private setCapabilities(
    capabilities: unknown,
    capabilityInfo: { hasColor: boolean; hasUnicode: boolean }
  ): void {
    if (this.isExtendedCapabilities(capabilities)) {
      this.setExtendedCapabilities(capabilities);
    } else {
      this.setBasicCapabilities(
        capabilities as Record<string, unknown>,
        capabilityInfo
      );
    }
  }

  private setExtendedCapabilities(
    capabilities: import('./types').ExtendedTerminalCapabilities
  ): void {
    this.state.setCapability(
      'color',
      capabilities.color.basic ||
        capabilities.color.color256 ||
        capabilities.color.trueColor
    );
    this.state.setCapability('color256', capabilities.color.color256);
    this.state.setCapability('trueColor', capabilities.color.trueColor);
    this.state.setCapability('unicode', capabilities.unicode.basic);
    this.state.setCapability('mouse', capabilities.mouse.basic);
    this.state.setCapability('altScreen', capabilities.altScreen);
    this.state.setCapability('cursorShape', capabilities.cursorShape);
  }

  private setBasicCapabilities(
    capabilities: Record<string, unknown>,
    capabilityInfo: { hasColor: boolean; hasUnicode: boolean }
  ): void {
    this.state.setCapability('color', capabilityInfo.hasColor);
    this.state.setCapability('color256', Boolean(capabilities.color256));
    this.state.setCapability('trueColor', Boolean(capabilities.trueColor));
    this.state.setCapability('unicode', capabilityInfo.hasUnicode);
    this.state.setCapability('mouse', Boolean(capabilities.mouse));
    this.state.setCapability('altScreen', Boolean(capabilities.altScreen));
    this.state.setCapability('cursorShape', Boolean(capabilities.cursorShape));
  }

  private updateTerminalState(capabilityInfo: {
    hasColor: boolean;
    hasUnicode: boolean;
    columns: number;
    rows: number;
  }): void {
    this.state.setSupportsColor(capabilityInfo.hasColor);
    this.state.setSupportsUnicode(capabilityInfo.hasUnicode);
    this.state.setDimensions(capabilityInfo.columns, capabilityInfo.rows);

    logger.debug({
      msg: 'Terminal capabilities detected',
      hasColor: capabilityInfo.hasColor,
      hasUnicode: capabilityInfo.hasUnicode,
      dimensions: {
        width: capabilityInfo.columns,
        height: capabilityInfo.rows,
      },
    });
  }

  private isExtendedCapabilities(
    capabilities: unknown
  ): capabilities is import('./types').ExtendedTerminalCapabilities {
    const obj = capabilities as Record<string, unknown>;
    return Boolean(
      capabilities != null &&
        typeof capabilities === 'object' &&
        obj.color != null &&
        typeof obj.color === 'object' &&
        'basic' in obj.color
    );
  }

  private async initializeFallbackMode(): Promise<void> {
    try {
      logger.info({ msg: 'Initializing fallback mode' });

      this.state.setSupportsColor(false);
      this.state.setSupportsUnicode(false);
      this.state.setDimensions(80, 24);

      logger.info({ msg: 'Fallback mode initialized successfully' });
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize fallback mode',
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
