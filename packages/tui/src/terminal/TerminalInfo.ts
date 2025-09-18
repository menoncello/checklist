import {
  EnvironmentDetector,
  EnvironmentInfo,
} from './helpers/EnvironmentDetector';
import { TTYInfoProvider, TTYInfo } from './helpers/TTYInfoProvider';
import { TerminalCapabilitiesDetector } from './helpers/TerminalCapabilitiesDetector';
import { TerminalVersionDetector } from './helpers/TerminalVersionDetector';

export { TTYInfo, EnvironmentInfo };

export class TerminalInfo {
  private environmentInfo: EnvironmentInfo;
  private ttyInfo: TTYInfo;
  private platformInfo: NodeJS.Platform;

  constructor() {
    this.platformInfo = process.platform;
    this.environmentInfo = EnvironmentDetector.gatherEnvironmentInfo();
    this.ttyInfo = TTYInfoProvider.gatherTTYInfo();
  }

  public getTerminalType(): string {
    return TerminalVersionDetector.getTerminalType(this.environmentInfo);
  }

  public getTerminalProgram(): string | undefined {
    return EnvironmentDetector.getTerminalProgram(this.environmentInfo);
  }

  public getVersion(): string | null {
    return TerminalVersionDetector.getVersion(this.environmentInfo);
  }

  public getPlatform(): string {
    return this.platformInfo;
  }

  public getTTYInfo(): TTYInfo {
    return TTYInfoProvider.getFreshTTYInfo();
  }

  public isTTY(): boolean {
    return this.ttyInfo.isTTY;
  }

  public getSize(): { width: number; height: number } {
    return TTYInfoProvider.getCurrentSize();
  }

  public supportsColor(): boolean {
    return TerminalCapabilitiesDetector.supportsColor(this.environmentInfo);
  }

  public supports256Colors(): boolean {
    return TerminalCapabilitiesDetector.supports256Colors(this.environmentInfo);
  }

  public supportsTrueColor(): boolean {
    return TerminalCapabilitiesDetector.supportsTrueColor(this.environmentInfo);
  }

  public supportsUnicode(): boolean {
    return TerminalCapabilitiesDetector.supportsUnicode(this.environmentInfo);
  }

  public supportsMouseReporting(): boolean {
    return TerminalCapabilitiesDetector.supportsMouseReporting(
      this.environmentInfo
    );
  }

  public getColorDepth(): number | undefined {
    return this.ttyInfo.colorDepth;
  }

  public getColorDepthLevel(): 'monochrome' | 'basic' | '256' | 'truecolor' {
    return TerminalCapabilitiesDetector.getColorDepthLevel(
      this.ttyInfo.colorDepth
    );
  }

  public isRemoteSession(): boolean {
    return EnvironmentDetector.isRemoteSession(this.environmentInfo);
  }

  public getSessionType(): string {
    return EnvironmentDetector.getSessionType(this.environmentInfo);
  }

  public detectTerminalFamily(): string {
    return TerminalVersionDetector.detectTerminalFamily(this.environmentInfo);
  }

  public isKnownTerminal(): boolean {
    return TerminalVersionDetector.isKnownTerminal(this.environmentInfo);
  }

  public getTerminalFeatures(): {
    supportsImages: boolean;
    supportsHyperlinks: boolean;
    supportsNotifications: boolean;
  } {
    return TerminalVersionDetector.getTerminalFeatures(this.environmentInfo);
  }

  public getEnvironmentInfo(): EnvironmentInfo {
    return { ...this.environmentInfo };
  }

  public generateReport(): string {
    const sections = [
      this.generateHeaderSection(),
      this.generateTTYSection(),
      this.generateCapabilitiesSection(),
      this.generateAdvancedFeaturesSection(),
    ];

    return sections.join('');
  }

  private generateHeaderSection(): string {
    return [
      'Terminal Information Report',
      '============================',
      '',
      `Platform: ${this.getPlatform()}`,
      `Terminal Type: ${this.getTerminalType()}`,
      `Terminal Family: ${this.detectTerminalFamily()}`,
      `Version: ${this.getVersion() ?? 'Unknown'}`,
      `Session Type: ${this.getSessionType()}`,
      '',
    ].join('\n');
  }

  private generateTTYSection(): string {
    return [
      'TTY Information:',
      `  Is TTY: ${this.isTTY()}`,
      `  Size: ${this.getSize().width}x${this.getSize().height}`,
      `  Color Depth: ${this.getColorDepth() ?? 'Unknown'}`,
      `  Color Level: ${this.getColorDepthLevel()}`,
      '',
    ].join('\n');
  }

  private generateCapabilitiesSection(): string {
    return [
      'Capabilities:',
      `  Color Support: ${this.supportsColor()}`,
      `  256 Colors: ${this.supports256Colors()}`,
      `  True Color: ${this.supportsTrueColor()}`,
      `  Unicode: ${this.supportsUnicode()}`,
      `  Mouse Reporting: ${this.supportsMouseReporting()}`,
      '',
    ].join('\n');
  }

  private generateAdvancedFeaturesSection(): string {
    const features = this.getTerminalFeatures();
    return [
      'Advanced Features:',
      `  Images: ${features.supportsImages}`,
      `  Hyperlinks: ${features.supportsHyperlinks}`,
      `  Notifications: ${features.supportsNotifications}`,
    ].join('\n');
  }
}
