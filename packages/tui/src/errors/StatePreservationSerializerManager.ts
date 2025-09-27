import { SerializerManager } from './StateSerializer';
import type { StateSerializer } from './StateSerializer';

/**
 * Serializer management for StatePreservation
 * Extracted to comply with max-lines ESLint rule
 */
export class StatePreservationSerializerManager {
  constructor(private serializerManager: SerializerManager) {}

  public addSerializer(serializer: StateSerializer): void {
    this.serializerManager.addSerializer(serializer);
  }

  public removeSerializer(type: string): boolean {
    return this.serializerManager.removeSerializer(type);
  }

  public getSerializer(type: string): StateSerializer | null {
    return this.serializerManager.getSerializer(type);
  }

  public listSerializers(): string[] {
    return this.serializerManager.listSerializers();
  }

  public hasSerializer(type: string): boolean {
    return this.serializerManager.hasSerializer(type);
  }

  public clear(): void {
    this.serializerManager.clear();
  }
}
