export { DebugManager } from './DebugManager';
export { DebugOverlay } from './DebugOverlay';

export type {
  DebugConfig,
  DebugLogEntry,
  DebugMetrics,
  ComponentDebugInfo,
} from './DebugManager';

export type { DebugOverlayConfig, DebugPanel } from './DebugOverlay';

export interface DebugIntegrationConfig {
  enableInProduction: boolean;
  defaultLogLevel: 'debug' | 'info' | 'warn' | 'error';
  enableKeyboardShortcuts: boolean;
  enablePerformanceIntegration: boolean;
  overlayConfig: Partial<import('./DebugOverlay').DebugOverlayConfig>;
  managerConfig: Partial<import('./DebugManager').DebugConfig>;
}
