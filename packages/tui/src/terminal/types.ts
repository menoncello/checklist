export interface ColorCapabilities {
  basic: boolean;
  color256: boolean;
  trueColor: boolean;
}

export interface UnicodeCapabilities {
  basic: boolean;
  wide: boolean;
  emoji: boolean;
}

export interface MouseCapabilities {
  basic: boolean;
  advanced: boolean;
}

export interface SizeCapabilities {
  meetsMinimum: boolean;
  width: number;
  height: number;
}

export interface ExtendedTerminalCapabilities {
  color: ColorCapabilities;
  unicode: UnicodeCapabilities;
  mouse: MouseCapabilities;
  size: SizeCapabilities;
  altScreen: boolean;
  cursorShape: boolean;
}

export interface CapabilityTest {
  name: string;
  test: () => Promise<boolean>;
  fallback?: boolean;
  timeout?: number;
  description?: string;
}

export interface DetectionResult {
  capabilities: ExtendedTerminalCapabilities;
  detectionTime: number;
  testResults: Map<string, boolean>;
  warnings: string[];
  fallbacksUsed: string[];
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
  capabilities: ExtendedTerminalCapabilities;
  testResults: Record<string, boolean>;
  supported: string[];
  unsupported: string[];
  cacheInfo: {
    hasCache: boolean;
    cacheAge: number;
    isValid: boolean;
  };
}

export interface CacheInfo {
  hasCache: boolean;
  cacheAge: number;
  isValid: boolean;
}

export interface TTYInfo {
  isTTY: boolean;
  columns: number;
  rows: number;
}

export interface EventHandler {
  (data?: unknown): void;
}

export interface TerminalSize {
  width: number;
  height: number;
}

export interface TerminalDefinition {
  name: string;
  platform: string;
  version?: string;
  capabilities: ExtendedTerminalCapabilities;
  notes?: string;
}

export interface CompatibilityMatrix {
  version: string;
  lastUpdated: string;
  terminals: TerminalDefinition[];
  supportMatrix: Record<string, Record<string, boolean>>;
}

// Re-export TerminalCapabilities from UIFramework for convenience
export type { TerminalCapabilities } from '../framework/UIFramework';

export interface VisualTestResult {
  scenario: {
    name: string;
    description: string;
    content: string;
    renderModes: string[];
  };
  terminal: string;
  renderMode: string;
  output: string;
  screenshot?: string;
  dimensions: { width: number; height: number };
  metrics: {
    renderTime: number;
    characterCount: number;
    lineCount: number;
    ansiSequenceCount: number;
  };
  differences?: {
    pixelDifference?: number;
    structuralDifference?: boolean;
  };
}

/**
 * Type conversion utilities
 */
export function extendedToFlatCapabilities(
  extended: ExtendedTerminalCapabilities
): import('../framework/UIFramework').TerminalCapabilities {
  return {
    color: extended.color.basic,
    color256: extended.color.color256,
    trueColor: extended.color.trueColor,
    unicode: extended.unicode.basic,
    mouse: extended.mouse.basic,
    altScreen: extended.altScreen,
    cursorShape: extended.cursorShape,
  };
}

export function flatToExtendedCapabilities(
  flat: import('../framework/UIFramework').TerminalCapabilities,
  sizeData?: { width: number; height: number; meetsMinimum: boolean }
): ExtendedTerminalCapabilities {
  return {
    color: {
      basic: flat.color,
      color256: flat.color256,
      trueColor: flat.trueColor,
    },
    unicode: {
      basic: flat.unicode,
      wide: flat.unicode,
      emoji: flat.unicode,
    },
    mouse: {
      basic: flat.mouse,
      advanced: false,
    },
    size: sizeData ?? {
      width: 80,
      height: 24,
      meetsMinimum: true,
    },
    altScreen: flat.altScreen,
    cursorShape: flat.cursorShape,
  };
}
