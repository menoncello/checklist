export interface EventSubscriptionOptions {
  once?: boolean;
  priority?: number;
  metadata?: Record<string, unknown>;
  filter?: (data: unknown) => boolean;
}

export interface EventSubscription {
  id: string;
  handler: EventHandler;
  once: boolean;
  priority: number;
  registeredAt: number;
  metadata?: Record<string, unknown>;
  filter?: (data: unknown) => boolean;
}

export interface EventEmission {
  event: string;
  data: unknown;
  timestamp: number;
  source?: string;
  propagationStopped?: boolean;
  defaultPrevented?: boolean;
  metadata?: Record<string, unknown>;
}

export interface EventMetrics {
  subscriptionCount: number;
  emissionCount: number;
  handlerExecutions: number;
  totalHandlerTime: number;
  averageHandlerTime: number;
  errorCount: number;
  lastEmission: number;
}

export interface EventManagerStats {
  totalEvents: number;
  totalSubscriptions: number;
  totalEmissions: number;
  totalErrors: number;
  averageHandlersPerEvent: number;
  mostActiveEvents: Array<{ event: string; count: number }>;
  errorEvents: Array<{ event: string; errors: number }>;
}

export interface EventManagerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type EventHandler = (emission: EventEmission) => void | Promise<void>;
export type UnsubscribeFunction = () => void;
export type ErrorHandler = (error: Error, emission?: EventEmission) => void;
