export interface SpikeResult {
  approach: string;
  success: boolean;
  metrics: {
    startupTime: number;
    renderTime: number;
    memoryUsed: number;
    fps: number;
  };
  issues: string[];
  platformResults: {
    macOS: boolean;
    linux: boolean;
    windows: boolean;
    ssh: boolean;
    tmux: boolean;
  };
  bunCompatible: boolean;
  score: number;
}

export interface ApproachTest {
  name: string;
  run(): Promise<SpikeResult>;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  memoryBefore: number;
  memoryAfter: number;
  frameCount: number;
}