import { TerminalCapabilities } from '../framework/UIFramework.js';

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