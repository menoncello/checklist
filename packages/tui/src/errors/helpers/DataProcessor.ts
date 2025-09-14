export class DataProcessor {
  constructor(
    private enableCompression: boolean = true,
    private compressionThreshold: number = 1024
  ) {}

  public processData(data: string): string {
    if (this.enableCompression && data.length > this.compressionThreshold) {
      return this.compress(data);
    }
    return data;
  }

  public deprocessData(data: string): string {
    if (this.isCompressed(data)) {
      return this.decompress(data);
    }
    return data;
  }

  private compress(data: string): string {
    // Simple compression simulation - in real implementation use actual compression
    const compressed = `COMPRESSED:${data.length}:${this.simpleCompress(data)}`;
    return compressed;
  }

  private decompress(data: string): string {
    if (!this.isCompressed(data)) return data;

    const parts = data.split(':');
    if (parts.length >= 3 && parts[0] === 'COMPRESSED') {
      return this.simpleDecompress(parts.slice(2).join(':'));
    }

    return data;
  }

  private isCompressed(data: string): boolean {
    return data.startsWith('COMPRESSED:');
  }

  private simpleCompress(data: string): string {
    // Simplified compression - replace repeated patterns
    return data
      .replace(/\s+/g, ' ')
      .replace(/(.)\1{2,}/g, (match, char) => `${char}*${match.length}`)
      .trim();
  }

  private simpleDecompress(data: string): string {
    // Reverse the simple compression
    return data.replace(/(.)\*(\d+)/g, (match, char, count) =>
      char.repeat(parseInt(count, 10))
    );
  }

  public calculateChecksum(data: string): string {
    // Simple checksum calculation - in production use crypto libraries
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  public estimateSize(data: string): number {
    // Estimate memory size (rough approximation)
    return new TextEncoder().encode(data).length;
  }

  public updateConfig(enableCompression: boolean, compressionThreshold: number): void {
    this.enableCompression = enableCompression;
    this.compressionThreshold = compressionThreshold;
  }
}