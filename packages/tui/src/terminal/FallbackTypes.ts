export type FallbackOptions = {
  useAsciiOnly: boolean;
  maxWidth: number;
  maxHeight: number;
  stripColors: boolean;
  simplifyBoxDrawing: boolean;
  preserveLayout: boolean;
};

export type RenderFallback = {
  name: string;
  condition: (capabilities: unknown) => boolean;
  transform: (content: string, options: FallbackOptions) => string;
  priority: number;
};

export type CompatibilityReport = {
  compatible: boolean;
  issues: string[];
  recommendations: string[];
  fallbacksUsed: string[];
};
