import type { TerminalCapabilities } from '../../framework/UIFramework';
import { CapabilityDetector } from '../CapabilityDetector';
import { TerminalTestHarness } from '../TerminalTestHarness';
import type { TestTerminal } from '../TerminalTestHarness';

export interface TerminalCompatibilityEntry {
  name: string;
  version?: string;
  platform: string;
  capabilities: TerminalCapabilities;
  features: {
    colors: 'none' | 'basic' | '256' | 'truecolor';
    unicode: 'none' | 'basic' | 'extended' | 'emoji';
    mouse: 'none' | 'basic' | 'advanced';
  };
  tested: boolean;
  notes?: string;
  lastUpdated: string;
}

export class TerminalDataCollector {
  private detector: CapabilityDetector;
  private testHarness: TerminalTestHarness;

  constructor(detector: CapabilityDetector, testHarness: TerminalTestHarness) {
    this.detector = detector;
    this.testHarness = testHarness;
  }

  public async collectTerminalData(): Promise<TerminalCompatibilityEntry[]> {
    const supportedTerminals = this.testHarness.getSupportedTerminals();
    const entries: TerminalCompatibilityEntry[] = [];

    for (const terminal of supportedTerminals) {
      const entry = await this.createTerminalEntry(terminal);
      entries.push(entry);
    }

    const currentEntry = await this.createCurrentTerminalEntry();
    if (!entries.some((e) => e.name === currentEntry.name)) {
      entries.push(currentEntry);
    }

    return entries;
  }

  private async createTerminalEntry(
    terminal: TestTerminal
  ): Promise<TerminalCompatibilityEntry> {
    const result = await this.testHarness.testTerminal(terminal);

    return {
      name: terminal.name,
      version: terminal.version,
      platform: terminal.platform ?? 'cross-platform',
      capabilities: result.capabilities,
      features: this.extractFeatures(result.capabilities),
      tested: true,
      notes: terminal.notes,
      lastUpdated: new Date().toISOString(),
    };
  }

  private normalizeCapabilities(capabilities: unknown): TerminalCapabilities {
    const caps = capabilities as Record<string, unknown>;
    return {
      color: (caps.color as boolean) ?? false,
      color256: (caps.color256 as boolean) ?? false,
      trueColor: (caps.trueColor as boolean) ?? false,
      unicode: (caps.unicode as boolean) ?? false,
      mouse: (caps.mouse as boolean) ?? false,
      altScreen: (caps.altScreen as boolean) ?? false,
      cursorShape: (caps.cursorShape as boolean) ?? false,
    };
  }

  private async createCurrentTerminalEntry(): Promise<TerminalCompatibilityEntry> {
    const result = await this.detector.detect();
    const normalized = this.normalizeCapabilities(result.capabilities);

    return {
      name: 'Current Terminal',
      platform: this.detector.getTerminalInfo().getPlatform(),
      capabilities: normalized,
      features: this.extractFeatures(normalized),
      tested: true,
      lastUpdated: new Date().toISOString(),
    };
  }

  private extractFeatures(capabilities: TerminalCapabilities): {
    colors: 'none' | 'basic' | '256' | 'truecolor';
    unicode: 'none' | 'basic' | 'extended' | 'emoji';
    mouse: 'none' | 'basic' | 'advanced';
  } {
    return {
      colors:
        capabilities.trueColor === true
          ? 'truecolor'
          : capabilities.color256 === true
            ? '256'
            : capabilities.color === true
              ? 'basic'
              : 'none',
      unicode: capabilities.unicode === true ? 'extended' : 'none',
      mouse: capabilities.mouse === true ? 'basic' : 'none',
    };
  }
}
