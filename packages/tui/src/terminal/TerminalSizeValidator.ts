import {
  generateValidationMessage,
  generateSizeSuggestions,
  generateSizeErrorMessage,
} from './helpers/TerminalSizeHelpers';
export interface SizeValidationResult {
  isValid: boolean;
  currentWidth: number;
  currentHeight: number;
  requiredWidth: number;
  requiredHeight: number;
  message: string;
  suggestions: string[];
  canResize: boolean;
  errors?: string[];
  canRender?: boolean;
}
export interface SizeValidationConfig {
  minWidth: number;
  minHeight: number;
  enableSuggestions: boolean;
  enableAutoResize: boolean;
  checkOnStartup: boolean;
}
export class TerminalSizeValidator {
  private config: SizeValidationConfig;
  private resizeHandler: unknown;
  constructor(config: Partial<SizeValidationConfig> = {}) {
    // Disable startup validation in test environment to avoid error messages
    const isTest = process.env.NODE_ENV === 'test';

    this.config = {
      minWidth: 80,
      minHeight: 24,
      enableSuggestions: true,
      enableAutoResize: false,
      checkOnStartup: !isTest, // Disable in tests
      ...config,
    };
    if (this.config.checkOnStartup && !isTest) {
      this.validateOnStartup();
    }
  }
  public validateSize(size?: {
    width: number;
    height: number;
  }): SizeValidationResult {
    if (size) {
      return this.buildValidationResult(size.width, size.height);
    }
    const currentWidth = process.stdout.columns ?? 80;
    const currentHeight = process.stdout.rows ?? 24;
    return this.buildValidationResult(currentWidth, currentHeight);
  }
  public validate(size?: {
    width: number;
    height: number;
  }): SizeValidationResult {
    return size
      ? this.buildValidationResult(size.width, size.height)
      : this.validateSize();
  }
  private createSizeParams(width: number, height: number) {
    return {
      width,
      height,
      minWidth: this.config.minWidth,
      minHeight: this.config.minHeight,
    };
  }
  private createValidationConfig() {
    return {
      minWidth: this.config.minWidth,
      minHeight: this.config.minHeight,
      enableSuggestions: this.config.enableSuggestions,
    };
  }
  private collectSizeErrors(width: number, height: number): string[] {
    const errors: string[] = [];
    if (width < this.config.minWidth) {
      errors.push('Terminal width too small');
    }
    if (height < this.config.minHeight) {
      errors.push('Terminal height too small');
    }
    return errors;
  }
  private buildValidationResult(
    width: number,
    height: number
  ): SizeValidationResult {
    const isValid =
      width >= this.config.minWidth && height >= this.config.minHeight;
    const sizeParams = this.createSizeParams(width, height);
    const config = this.createValidationConfig();
    const errors = this.collectSizeErrors(width, height);
    return {
      isValid,
      currentWidth: width,
      currentHeight: height,
      requiredWidth: this.config.minWidth,
      requiredHeight: this.config.minHeight,
      message: generateValidationMessage(sizeParams, isValid),
      suggestions: generateSizeSuggestions({ width, height }, config),
      canResize: this.canResizeTerminal(),
      errors: errors.length > 0 ? errors : undefined,
      canRender: isValid,
    };
  }
  public meetsMinimumSize(): boolean {
    const result = this.validateSize();
    return result.isValid;
  }
  public generateErrorMessage(): string {
    const result = this.validateSize();
    return generateSizeErrorMessage(
      { width: result.currentWidth, height: result.currentHeight },
      {
        minWidth: this.config.minWidth,
        minHeight: this.config.minHeight,
        enableSuggestions: this.config.enableSuggestions,
      }
    );
  }
  public displayValidation(): void {
    const result = this.validateSize();
    if (result.isValid) {
      console.log(
        `✓ Terminal size OK: ${result.currentWidth}x${result.currentHeight}`
      );
      return;
    }
    const errorMsg = this.generateErrorMessage();
    console.error('\n' + '='.repeat(60));
    console.error('TERMINAL SIZE ERROR');
    console.error('='.repeat(60));
    console.error(errorMsg);
    console.error('='.repeat(60) + '\n');
  }
  private canResizeTerminal(): boolean {
    return false;
  }
  private validateOnStartup(): void {
    if (!this.validateSize().isValid && process.stdout.isTTY === true) {
      this.displayValidation();
    }
  }
  public updateConfig(newConfig: Partial<SizeValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  public getConfig(): SizeValidationConfig {
    return { ...this.config };
  }
  public getCurrentSize(): { width: number; height: number } {
    return {
      width: process.stdout.columns ?? 80,
      height: process.stdout.rows ?? 24,
    };
  }
  public isInteractive(): boolean {
    return process.stdout.isTTY === true;
  }
  public getErrorMessage(size?: { width: number; height: number }): string {
    const result = size ? this.validate(size) : this.validateSize();
    if (result.isValid) {
      return '';
    }
    return result.message;
  }
  public getResizeSuggestion(size?: { width: number; height: number }): string {
    const result = size ? this.validate(size) : this.validateSize();
    if (result.isValid || result.suggestions.length === 0) {
      return '';
    }
    return result.suggestions[0];
  }
  public validateForLayout(layoutConfig: {
    type: string;
    minWidth: number;
    currentSize: { width: number; height: number };
  }): SizeValidationResult & { reason?: string } {
    const minWidth = Math.max(layoutConfig.minWidth, this.config.minWidth);
    const tempConfig = { ...this.config, minWidth };
    const oldConfig = this.config;
    this.config = tempConfig;
    const result = this.validate(layoutConfig.currentSize);
    this.config = oldConfig;
    const withReason = result as SizeValidationResult & { reason?: string };
    if (result.canRender !== true) {
      withReason.reason =
        result.currentWidth < minWidth
          ? `Insufficient width for ${layoutConfig.type} layout`
          : `Insufficient height for ${layoutConfig.type} layout`;
    }
    return withReason;
  }
  public validateForList(listConfig: {
    minVisibleItems: number;
    currentSize: { width: number; height: number };
  }): SizeValidationResult & { reason?: string } {
    const minHeight = Math.max(
      listConfig.minVisibleItems,
      this.config.minHeight
    );
    const tempConfig = { ...this.config, minHeight };
    const oldConfig = this.config;
    this.config = tempConfig;
    const result = this.validate(listConfig.currentSize);
    this.config = oldConfig;
    const withReason = result as SizeValidationResult & { reason?: string };
    if (result.canRender !== true) {
      withReason.reason =
        result.currentHeight < minHeight
          ? `Insufficient height to display ${listConfig.minVisibleItems} items`
          : `Insufficient width for list display`;
    }
    return withReason;
  }
  public getResizeSuggestions(platform: string): string[] {
    const result = this.validateSize();
    if (result.isValid) {
      return [];
    }
    const baseSuggestions = [
      '• Resize your terminal window',
      '• Adjust terminal font size',
      `• Minimum required: ${this.config.minWidth}x${this.config.minHeight}`,
      `• Current size: ${result.currentWidth}x${result.currentHeight}`,
    ];
    // Add platform-specific suggestions
    const platformSuggestions: string[] = [];
    if (platform === 'darwin') {
      platformSuggestions.push('• Use Cmd+ or Cmd- to zoom in/out');
      platformSuggestions.push('• Try Terminal > Preferences to adjust font');
    } else if (platform === 'win32') {
      platformSuggestions.push('• Right-click title bar > Properties > Layout');
      platformSuggestions.push('• Use Ctrl+Plus or Ctrl+Minus to zoom');
    } else {
      platformSuggestions.push('• Use Ctrl+Plus or Ctrl+Minus to zoom');
      platformSuggestions.push('• Check terminal preferences for font size');
    }
    return [...baseSuggestions, ...platformSuggestions];
  }
  public async attemptResize(): Promise<{
    success: boolean;
    newSize?: { width: number; height: number };
  }> {
    if (!this.config.enableAutoResize) {
      return { success: false };
    }
    // Mock resize attempt - in real implementation this would try to resize the terminal
    const currentSize = this.getCurrentSize();
    if (
      currentSize.width >= this.config.minWidth &&
      currentSize.height >= this.config.minHeight
    ) {
      return { success: true, newSize: currentSize };
    }
    return { success: false };
  }
  public getSizeAdjustmentNeeded(): {
    needed: boolean;
    widthAdjustment: number;
    heightAdjustment: number;
    suggestions: string[];
  } {
    const currentSize = this.getCurrentSize();
    const widthAdjustment = Math.max(
      0,
      this.config.minWidth - currentSize.width
    );
    const heightAdjustment = Math.max(
      0,
      this.config.minHeight - currentSize.height
    );
    const needed = widthAdjustment > 0 || heightAdjustment > 0;
    const suggestions: string[] = [];
    if (widthAdjustment > 0) {
      suggestions.push(`Increase width by ${widthAdjustment} columns`);
    }
    if (heightAdjustment > 0) {
      suggestions.push(`Increase height by ${heightAdjustment} rows`);
    }
    return {
      needed,
      widthAdjustment,
      heightAdjustment,
      suggestions,
    };
  }
}
