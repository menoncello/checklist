export type ErrorInfo = {
  componentStack?: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
  eventType?: string;
  [key: string]: unknown;
};

export type ErrorState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
};

export type ErrorHistoryEntry = {
  error:
    | Error
    | {
        name: string;
        message: string;
        stack?: string;
      };
  errorInfo: ErrorInfo;
  errorId: string;
  timestamp: number;
  retryCount: number;
};

export type ErrorBoundaryConfig = {
  maxRetries: number;
  retryDelay: number;
  logErrors: boolean;
  fallbackRenderer: (error: Error, errorInfo: ErrorInfo) => string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: (attempt: number, maxRetries: number) => void;
  onRecovery?: () => void;
  enableStatePreservation: boolean;
};

export type ErrorMetrics = {
  totalErrors: number;
  recentErrors: number;
  errorRate: number;
  retrySuccessRate: number;
  averageRecoveryTime: number;
  mostCommonErrors: Array<{ error: string; count: number }>;
  currentRetryCount?: number;
  hasActiveError?: boolean;
  errorFrequency?: number;
  maxRetries?: number;
};

export type ErrorRecoveryStrategy = {
  name: string;
  condition: (error: Error, errorInfo: ErrorInfo) => boolean;
  handler: (error: Error, errorInfo: ErrorInfo) => Promise<boolean> | boolean;
  priority: number;
};
