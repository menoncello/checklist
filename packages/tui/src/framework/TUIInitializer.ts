import type { ComponentRegistry } from '../components/ComponentRegistry';
import type { DebugIntegration } from '../debug';
import type { ErrorBoundary } from '../errors/ErrorBoundary';
import type { EventManager } from '../events/EventManager';
import type { KeyboardHandler } from '../events/KeyboardHandler';
import type { PerformanceManager } from '../performance';
import type { ScreenManager } from '../screens/ScreenManager';
import type { CapabilityDetector } from '../terminal/CapabilityDetector';
import type { ApplicationLoop } from './ApplicationLoop';
import type { LifecycleManager } from './Lifecycle';
import type { TerminalCanvas } from './TerminalCanvas';

export interface TUIComponents {
  canvas: TerminalCanvas;
  applicationLoop: ApplicationLoop;
  lifecycle: LifecycleManager;
  screenManager: ScreenManager;
  componentRegistry: ComponentRegistry;
  eventManager: EventManager;
  keyboardHandler: KeyboardHandler;
  capabilityDetector?: CapabilityDetector;
  errorBoundary?: ErrorBoundary;
  performanceManager?: PerformanceManager;
  debugIntegration?: DebugIntegration;
}
