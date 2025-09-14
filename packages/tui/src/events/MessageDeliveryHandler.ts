export interface DeliveryOptions {
  async?: boolean;
  timeout?: number;
  retryCount?: number;
  onError?: (error: Error) => void;
}

export interface Subscriber {
  id: string;
  handler: (message: unknown) => void | Promise<void>;
  options?: DeliveryOptions;
}

export class MessageDeliveryHandler {
  static async deliver(
    message: unknown,
    subscribers: Subscriber[],
    emit: (event: string, data: unknown) => void
  ): Promise<void> {
    const deliveryPromises: Promise<void>[] = [];

    for (const subscriber of subscribers) {
      if (subscriber.options?.async === true) {
        deliveryPromises.push(
          this.deliverAsync(message, subscriber, emit)
        );
      } else {
        await this.deliverSync(message, subscriber, emit);
      }
    }

    if (deliveryPromises.length > 0) {
      await Promise.all(deliveryPromises);
    }
  }

  private static async deliverSync(
    message: unknown,
    subscriber: Subscriber,
    emit: (event: string, data: unknown) => void
  ): Promise<void> {
    try {
      const result = subscriber.handler(message);
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      this.handleDeliveryError(error as Error, subscriber, emit);
    }
  }

  private static async deliverAsync(
    message: unknown,
    subscriber: Subscriber,
    emit: (event: string, data: unknown) => void
  ): Promise<void> {
    try {
      const timeout = subscriber.options?.timeout ?? 5000;
      await this.withTimeout(
        subscriber.handler(message),
        timeout
      );
    } catch (error) {
      this.handleDeliveryError(error as Error, subscriber, emit);
    }
  }

  private static async withTimeout<T>(
    promise: Promise<T> | T,
    ms: number
  ): Promise<T> {
    if (!(promise instanceof Promise)) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      ),
    ]);
  }

  private static handleDeliveryError(
    error: Error,
    subscriber: Subscriber,
    emit: (event: string, data: unknown) => void
  ): void {
    if (subscriber.options?.onError) {
      subscriber.options.onError(error);
    }

    emit('deliveryError', {
      subscriberId: subscriber.id,
      error: error.message,
    });
  }
}