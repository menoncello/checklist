export class StatePreservationCompressionManager {
  compress(data: unknown): Buffer {
    return Buffer.from(JSON.stringify(data));
  }

  decompress(buffer: Buffer): unknown {
    return JSON.parse(buffer.toString());
  }
}
