export type LifecyclePhase =
  | 'created'
  | 'initializing'
  | 'initialized'
  | 'mounting'
  | 'mounted'
  | 'rendering'
  | 'rendered'
  | 'updating'
  | 'updated'
  | 'unmounting'
  | 'unmounted'
  | 'destroying'
  | 'destroyed'
  | 'error';

export interface LifecycleTransition {
  from: LifecyclePhase;
  to: LifecyclePhase;
  timestamp: number;
  duration?: number;
  error?: Error;
}

export interface LifecycleHooks {
  onPhaseChange?: (from: LifecyclePhase, to: LifecyclePhase) => void;
  onError?: (error: Error, phase: LifecyclePhase) => void;
  onTransition?: (transition: LifecycleTransition) => void;
}

export interface LifecycleState {
  currentPhase: LifecyclePhase;
  previousPhase: LifecyclePhase | null;
  transitionHistory: LifecycleTransition[];
  error: Error | null;
  createdAt: number;
  lastTransitionTime: number;
}

export type LifecycleHook = (phase: LifecyclePhase, data?: unknown) => void;
export type LifecyclePhaseTransition = LifecycleTransition;

export interface LifecycleEvent {
  type: string;
  phase: LifecyclePhase;
  timestamp: number;
  data?: unknown;
}

export interface LifecycleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface LifecycleMetrics {
  componentId: string;
  currentPhase: LifecyclePhase;
  previousPhase: LifecyclePhase | null;
  age: number;
  timeInCurrentPhase: number;
  timeSinceLastTransition: number;
  transitionCount: number;
  errorCount: number;
  hasError: boolean;
  error?: string;
  phaseDistribution: Record<LifecyclePhase, number>;
  averagePhaseTime: number;
  isInActivePhase: boolean;
  isInDestroyedState: boolean;
  validNextPhases: LifecyclePhase[];
}
