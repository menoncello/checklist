export class EventBusMetrics {
  totalMessages!: number;
  messagesProcessed!: number;
  messagesDropped!: number;
  averageProcessingTime!: number;
  totalProcessingTime!: number;
  errorCount!: number;
  peakQueueSize!: number;
  uptime!: number;
}

export class BusMetrics {
  private metrics: EventBusMetrics = {
    totalMessages: 0,
    messagesProcessed: 0,
    messagesDropped: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0,
    errorCount: 0,
    peakQueueSize: 0,
    uptime: 0,
  };

  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  public recordMessage(): void {
    this.metrics.totalMessages++;
  }

  public recordProcessedMessage(processingTime: number): void {
    this.metrics.messagesProcessed++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime =
      this.metrics.totalProcessingTime / this.metrics.messagesProcessed;
  }

  public recordDroppedMessage(): void {
    this.metrics.messagesDropped++;
  }

  public recordError(): void {
    this.metrics.errorCount++;
  }

  public updatePeakQueueSize(currentSize: number): void {
    if (currentSize > this.metrics.peakQueueSize) {
      this.metrics.peakQueueSize = currentSize;
    }
  }

  public getMetrics(): EventBusMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
    };
  }

  public getProcessingRate(): number {
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    return uptimeSeconds > 0
      ? this.metrics.messagesProcessed / uptimeSeconds
      : 0;
  }

  public getErrorRate(): number {
    return this.metrics.totalMessages > 0
      ? (this.metrics.errorCount / this.metrics.totalMessages) * 100
      : 0;
  }

  public getDropRate(): number {
    return this.metrics.totalMessages > 0
      ? (this.metrics.messagesDropped / this.metrics.totalMessages) * 100
      : 0;
  }

  public getHealthScore(): number {
    const errorRate = this.getErrorRate();
    const dropRate = this.getDropRate();

    // Health score based on error and drop rates
    const healthScore = Math.max(0, 100 - errorRate * 2 - dropRate * 1.5);
    return Math.round(healthScore);
  }

  public recordSubscription(_messageType: string): void {
    // Track subscription metrics if needed
  }

  public recordUnsubscription(_messageType: string): void {
    // Track unsubscription metrics if needed
  }

  public recordPublication(_messageType: string): void {
    this.recordMessage();
  }

  public reset(): void {
    this.metrics = {
      totalMessages: 0,
      messagesProcessed: 0,
      messagesDropped: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      errorCount: 0,
      peakQueueSize: 0,
      uptime: 0,
    };
    this.startTime = Date.now();
  }

  public getSummary(): {
    throughput: number;
    errorRate: number;
    dropRate: number;
    healthScore: number;
    averageProcessingTime: number;
    uptime: number;
  } {
    return {
      throughput: this.getProcessingRate(),
      errorRate: this.getErrorRate(),
      dropRate: this.getDropRate(),
      healthScore: this.getHealthScore(),
      averageProcessingTime: this.metrics.averageProcessingTime,
      uptime: Date.now() - this.startTime,
    };
  }

  public export(): EventBusMetrics & {
    processingRate: number;
    errorRate: number;
    dropRate: number;
    healthScore: number;
  } {
    return {
      ...this.getMetrics(),
      processingRate: this.getProcessingRate(),
      errorRate: this.getErrorRate(),
      dropRate: this.getDropRate(),
      healthScore: this.getHealthScore(),
    };
  }
}
