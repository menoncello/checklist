export interface FallbackOptions {
  useAsciiOnly: boolean;
  maxWidth: number;
  maxHeight: number;
  stripColors: boolean;
  simplifyBoxDrawing: boolean;
  preserveLayout: boolean;
}

export interface RenderFallback {
  name: string;
  condition: (capabilities: unknown) => boolean;
  transform: (content: string, options: FallbackOptions) => string;
  priority: number;
}

export interface CompatibilityReport {
  compatible: boolean;
  issues: string[];
  recommendations: string[];
  fallbacksUsed: string[];
}
