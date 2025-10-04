import { PerformanceMetrics } from '../framework/UIFramework';
import { TerminalManager } from '../terminal/TerminalManager';
import { ApplicationShellComponents } from './ApplicationShellComponents';
import { ApplicationShellPerformance } from './ApplicationShellPerformance';
import { ApplicationShellScreens } from './ApplicationShellScreens';

export class ApplicationShellUI {
  constructor(
    private terminalManager: TerminalManager,
    private screens: ApplicationShellScreens,
    private components: ApplicationShellComponents,
    private performance: ApplicationShellPerformance
  ) {}

  public getTerminalSize(): { width: number; height: number } {
    return this.terminalManager.getDimensions();
  }

  public isTerminalCapable(capability: string): boolean {
    return this.terminalManager.hasCapability(capability);
  }

  public getMetrics(): PerformanceMetrics {
    return this.performance.getMetrics();
  }

  public startProfiling(name: string): void {
    this.performance.startProfiling(name);
  }

  public endProfiling(name: string): number {
    return this.performance.endProfiling(name);
  }

  public getPerformanceReport(): unknown {
    return this.performance.getPerformanceReport();
  }

  public pushScreen(screen: unknown): void {
    this.screens.pushScreen(screen);
  }

  public popScreen(): void {
    this.screens.popScreen();
  }

  public replaceScreen(screen: unknown): void {
    this.screens.replaceScreen(screen);
  }

  public getCurrentScreen() {
    return this.screens.getCurrentScreen();
  }

  public registerComponent(name: string, component: unknown): void {
    this.components.registerComponent(name, component);
  }

  public createComponent(name: string, props: Record<string, unknown>) {
    return this.components.createComponent(name, props);
  }
}
