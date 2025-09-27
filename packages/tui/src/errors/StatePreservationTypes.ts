export interface StatePreservationMetrics {
  totalStates: number;
  totalSnapshots: number;
  currentStorageSize: number;
  maxStorageSize: number;
  utilizationPercent: number;
  expiredStates: number;
  serializerCount: number;
  compressionEnabled: boolean;
  storageBackend: string;
  totalSize?: number;
  oldestState?: number | null;
  newestState?: number | null;
  compressionRatio?: number;
}
