import type { HeapSnapshot } from './ChromeDevToolsIntegration';

interface InspectorSession {
  connect(): void;
  post(
    method: string,
    params?: unknown,
    callback?: (err: Error | null, result?: unknown) => void
  ): void;
  on(event: string, handler: (data: unknown) => void): void;
}

export function extractSnapshotMetrics(snapshotData: unknown): HeapSnapshot {
  const data = snapshotData as {
    snapshot?: {
      meta?: { total_size?: number; used_size?: number };
      node_count?: number;
      edge_count?: number;
    };
  };

  const meta = data.snapshot?.meta;
  const snapshot = data.snapshot;

  return {
    timestamp: Date.now(),
    totalSize: meta?.total_size ?? 0,
    usedSize: meta?.used_size ?? 0,
    nodes: snapshot?.node_count ?? 0,
    edges: snapshot?.edge_count ?? 0,
  };
}

export function setupSnapshotChunkHandler(
  session: InspectorSession,
  chunks: string[]
): void {
  session.on('HeapProfiler.addHeapSnapshotChunk', (data: unknown) => {
    const chunkData = data as { chunk: string };
    chunks.push(chunkData.chunk);
  });
}

export function requestHeapSnapshot(
  session: InspectorSession,
  chunks: string[],
  resolve: (value: HeapSnapshot) => void,
  reject: (reason: unknown) => void
): void {
  session.post(
    'HeapProfiler.takeHeapSnapshot',
    { reportProgress: false },
    (err: Error | null) => {
      if (err) {
        reject(err);
      } else {
        processSnapshotData(chunks, resolve, reject);
      }
    }
  );
}

export function processSnapshotData(
  chunks: string[],
  resolve: (value: HeapSnapshot) => void,
  reject: (reason: unknown) => void
): void {
  try {
    const snapshotData = JSON.parse(chunks.join(''));
    const snapshot = extractSnapshotMetrics(snapshotData);
    resolve(snapshot);
  } catch (parseErr) {
    reject(parseErr);
  }
}

export function getFeatureStatus(
  profilerEnabled: boolean,
  heapProfilerEnabled: boolean
): string {
  const cpuStatus = profilerEnabled ? 'ENABLED' : 'Available';
  const heapStatus = heapProfilerEnabled ? 'ENABLED' : 'Available';
  const gcStatus = global.gc ? 'Available' : 'Not Available (add --expose-gc)';

  return `- CPU Profiling: ${cpuStatus}
- Heap Profiling: ${heapStatus}
- Memory Snapshots: Available
- Garbage Collection: ${gcStatus}`;
}

export function getUsageInstructions(): string {
  return `- await chromeDevTools.startCPUProfiling()
- await chromeDevTools.stopCPUProfiling()
- await chromeDevTools.takeHeapSnapshot()
- await chromeDevTools.collectGCData()`;
}
