import {
  setupSnapshotChunkHandler,
  requestHeapSnapshot,
  getFeatureStatus,
  getUsageInstructions,
} from './ChromeDevToolsHelpers';

export interface HeapSnapshot {
  timestamp: number;
  totalSize: number;
  usedSize: number;
  nodes: number;
  edges: number;
}

export interface CPUProfile {
  startTime: number;
  endTime: number;
  samples: number[];
  timeDeltas: number[];
  nodes: Array<{
    id: number;
    functionName: string;
    scriptId: number;
    lineNumber: number;
    columnNumber: number;
  }>;
}

interface InspectorSession {
  connect(): void;
  post(
    method: string,
    params?: unknown,
    callback?: (err: Error | null, result?: unknown) => void
  ): void;
  on(event: string, handler: (data: unknown) => void): void;
}

interface Inspector {
  url(): string | undefined;
  Session: new () => InspectorSession;
}

export class ChromeDevToolsIntegration {
  private inspector: Inspector | null;
  private profilerEnabled = false;
  private heapProfilerEnabled = false;

  constructor() {
    // Only available in Node.js with --inspect
    try {
      this.inspector = require('inspector') as Inspector;
    } catch {
      // Not available in browser or without inspector
      this.inspector = null;
    }
  }

  isAvailable(): boolean {
    return this.inspector?.url() !== undefined;
  }

  async enableProfiler(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error(
        'Chrome DevTools is not available. Run with --inspect flag.'
      );
    }

    if (!this.profilerEnabled) {
      const session = new (this.inspector as Inspector).Session();
      session.connect();

      await new Promise<void>((resolve, reject) => {
        session.post('Profiler.enable', undefined, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.profilerEnabled = true;
    }
  }

  async enableHeapProfiler(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error(
        'Chrome DevTools is not available. Run with --inspect flag.'
      );
    }

    if (!this.heapProfilerEnabled) {
      const session = new (this.inspector as Inspector).Session();
      session.connect();

      await new Promise<void>((resolve, reject) => {
        session.post('HeapProfiler.enable', undefined, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      this.heapProfilerEnabled = true;
    }
  }

  async startCPUProfiling(_name = 'profile'): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Chrome DevTools is not available');
    }

    await this.enableProfiler();

    const session = new (this.inspector as Inspector).Session();
    session.connect();

    await new Promise<void>((resolve, reject) => {
      session.post('Profiler.start', undefined, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async stopCPUProfiling(): Promise<CPUProfile> {
    if (!this.isAvailable()) {
      throw new Error('Chrome DevTools is not available');
    }

    const session = new (this.inspector as Inspector).Session();
    session.connect();

    return new Promise<CPUProfile>((resolve, reject) => {
      session.post(
        'Profiler.stop',
        undefined,
        (err: Error | null, result?: unknown) => {
          if (err) {
            reject(err);
          } else {
            const profileResult = result as { profile: CPUProfile };
            resolve(profileResult.profile);
          }
        }
      );
    });
  }

  async takeHeapSnapshot(): Promise<HeapSnapshot> {
    if (!this.isAvailable()) {
      throw new Error('Chrome DevTools is not available');
    }

    await this.enableHeapProfiler();
    return this.captureHeapSnapshot();
  }

  private async captureHeapSnapshot(): Promise<HeapSnapshot> {
    const session = new (this.inspector as Inspector).Session();
    session.connect();

    return new Promise<HeapSnapshot>((resolve, reject) => {
      const chunks: string[] = [];

      setupSnapshotChunkHandler(session, chunks);
      requestHeapSnapshot(session, chunks, resolve, reject);
    });
  }

  async collectGCData(): Promise<{
    type: string;
    duration: number;
    before: number;
    after: number;
    freed: number;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Chrome DevTools is not available');
    }

    const beforeMemory = process.memoryUsage();

    // Force garbage collection if available
    if (global.gc) {
      const start = performance.now();
      global.gc();
      const duration = performance.now() - start;

      const afterMemory = process.memoryUsage();

      return {
        type: 'manual',
        duration,
        before: beforeMemory.heapUsed,
        after: afterMemory.heapUsed,
        freed: beforeMemory.heapUsed - afterMemory.heapUsed,
      };
    }

    throw new Error(
      'Garbage collection not available. Run with --expose-gc flag.'
    );
  }

  async startHeapProfiling(samplingInterval = 512 * 1024): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Chrome DevTools is not available');
    }

    await this.enableHeapProfiler();

    const session = new (this.inspector as Inspector).Session();
    session.connect();

    await new Promise<void>((resolve, reject) => {
      session.post(
        'HeapProfiler.startSampling',
        { samplingInterval },
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async stopHeapProfiling(): Promise<unknown> {
    if (!this.isAvailable()) {
      throw new Error('Chrome DevTools is not available');
    }

    const session = new (this.inspector as Inspector).Session();
    session.connect();

    return new Promise((resolve, reject) => {
      session.post(
        'HeapProfiler.stopSampling',
        undefined,
        (err: Error | null, result?: unknown) => {
          if (err) {
            reject(err);
          } else {
            const profileResult = result as { profile?: unknown };
            resolve(profileResult.profile);
          }
        }
      );
    });
  }

  getDebuggerUrl(): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    return (this.inspector as Inspector).url() ?? null;
  }

  generateReport(): string {
    const url = this.getDebuggerUrl();

    if (url === null) {
      return this.generateUnavailableReport();
    }

    return this.generateAvailableReport(url);
  }

  private generateUnavailableReport(): string {
    return `
Chrome DevTools Integration Report
================================

Status: NOT AVAILABLE
Reason: Inspector not enabled

To enable Chrome DevTools integration:
1. Run your application with --inspect flag:
   node --inspect your-app.js

2. For heap profiling, also add --expose-gc:
   node --inspect --expose-gc your-app.js

3. Open Chrome and navigate to: chrome://inspect
4. Click "Open dedicated DevTools for Node"
`;
  }

  private generateAvailableReport(url: string): string {
    const features = getFeatureStatus(
      this.profilerEnabled,
      this.heapProfilerEnabled
    );
    const usage = getUsageInstructions();

    return `
Chrome DevTools Integration Report
================================

Status: AVAILABLE
Debugger URL: ${url}

Features Available:
${features}

How to use:
1. Open Chrome and navigate to: chrome://inspect
2. Click "Open dedicated DevTools for Node"
3. Use the Performance and Memory tabs for profiling

Programmatic Usage:
${usage}
`;
  }
}

export const chromeDevTools = new ChromeDevToolsIntegration();
