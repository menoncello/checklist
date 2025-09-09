/**
 * Feature flags for controlling DI migration phases
 */
export enum DIFeatureFlag {
  /**
   * Main DI enablement flag
   * - 'false': DI disabled, use singleton patterns
   * - 'partial': Phase 1 - ConfigService, FileSystemService
   * - 'full': Phase 3 - All services including StateManager, WorkflowEngine
   */
  DI_ENABLED = 'DI_ENABLED',

  /**
   * Logger-specific DI flag for Phase 2
   * - true: Use DI for logger
   * - false: Keep logger as singleton
   */
  DI_LOGGER_ENABLED = 'DI_LOGGER_ENABLED',

  /**
   * Enable debug logging for DI container
   */
  DI_DEBUG = 'DI_DEBUG',

  /**
   * Enable performance monitoring for DI
   */
  DI_PERFORMANCE_MONITORING = 'DI_PERFORMANCE_MONITORING',

  /**
   * Enable automatic rollback on failure
   */
  DI_AUTO_ROLLBACK = 'DI_AUTO_ROLLBACK',
}

export type DIEnabledValue = 'false' | 'partial' | 'full';

export interface FeatureFlagConfig {
  [DIFeatureFlag.DI_ENABLED]?: DIEnabledValue;
  [DIFeatureFlag.DI_LOGGER_ENABLED]?: boolean;
  [DIFeatureFlag.DI_DEBUG]?: boolean;
  [DIFeatureFlag.DI_PERFORMANCE_MONITORING]?: boolean;
  [DIFeatureFlag.DI_AUTO_ROLLBACK]?: boolean;
  [key: string]: unknown | undefined; // Allow custom flags
}

/**
 * Feature flag manager for DI migration
 */
export class FeatureFlagManager {
  private flags: FeatureFlagConfig = {};
  private listeners: Map<string, Set<(value: unknown) => void>> = new Map();

  constructor(initialFlags?: FeatureFlagConfig) {
    // Load from environment first
    this.loadFromEnvironment();

    // Override with provided flags
    if (initialFlags) {
      this.flags = { ...this.flags, ...initialFlags };
    }
  }

  /**
   * Load feature flags from environment variables
   */
  private loadFromEnvironment(): void {
    // Check both process.env and Bun.env
    const env = { ...process.env, ...Bun.env };

    // Load DI_ENABLED
    if (env.DI_ENABLED !== undefined && env.DI_ENABLED !== '') {
      this.flags[DIFeatureFlag.DI_ENABLED] = env.DI_ENABLED as DIEnabledValue;
    }

    // Load boolean flags
    const booleanFlags = [
      DIFeatureFlag.DI_LOGGER_ENABLED,
      DIFeatureFlag.DI_DEBUG,
      DIFeatureFlag.DI_PERFORMANCE_MONITORING,
      DIFeatureFlag.DI_AUTO_ROLLBACK,
    ];

    for (const flag of booleanFlags) {
      if (env[flag] !== undefined) {
        // Use type assertion for known boolean flags
        const flagsWithIndex = this.flags as Record<string, unknown>;
        flagsWithIndex[flag] = env[flag] === 'true';
      }
    }
  }

  /**
   * Get the value of a feature flag
   */
  getFlag<T = unknown>(flag: string): T | undefined {
    return this.flags[flag] as T;
  }

  /**
   * Set a feature flag value
   */
  setFlag(flag: string, value: unknown): void {
    const oldValue = this.flags[flag];
    this.flags[flag] = value;

    // Notify listeners
    if (oldValue !== value) {
      this.notifyListeners(flag, value);
    }
  }

  /**
   * Check if a boolean flag is enabled
   */
  isEnabled(flag: string): boolean {
    const value = this.flags[flag];
    return value === true || value === 'true';
  }

  /**
   * Check DI enablement level
   */
  getDILevel(): DIEnabledValue {
    return (this.flags[DIFeatureFlag.DI_ENABLED] as DIEnabledValue) ?? 'false';
  }

  /**
   * Check if DI is enabled for a specific phase
   */
  isDIEnabledForPhase(phase: 1 | 2 | 3): boolean {
    const level = this.getDILevel();

    switch (phase) {
      case 1:
        return level === 'partial' || level === 'full';
      case 2:
        return this.isEnabled(DIFeatureFlag.DI_LOGGER_ENABLED);
      case 3:
        return level === 'full';
      default:
        return false;
    }
  }

  /**
   * Listen for flag changes
   */
  onFlagChange(flag: string, listener: (value: unknown) => void): () => void {
    if (!this.listeners.has(flag)) {
      this.listeners.set(flag, new Set());
    }

    const flagListeners = this.listeners.get(flag);
    if (flagListeners) {
      flagListeners.add(listener);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(flag);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Get all current flags
   */
  getAllFlags(): FeatureFlagConfig {
    return { ...this.flags };
  }

  /**
   * Reset flags to defaults
   */
  reset(): void {
    this.flags = {};
    this.loadFromEnvironment();

    // Notify all listeners
    for (const [flag, listeners] of this.listeners) {
      const value = this.flags[flag];
      for (const listener of listeners) {
        listener(value);
      }
    }
  }

  /**
   * Enable debug mode
   */
  enableDebugMode(): void {
    this.setFlag(DIFeatureFlag.DI_DEBUG, true);
    this.setFlag(DIFeatureFlag.DI_PERFORMANCE_MONITORING, true);
  }

  /**
   * Disable all DI features (emergency rollback)
   */
  disableAllDI(): void {
    this.setFlag(DIFeatureFlag.DI_ENABLED, 'false');
    this.setFlag(DIFeatureFlag.DI_LOGGER_ENABLED, false);
    this.setFlag(DIFeatureFlag.DI_DEBUG, false);
    this.setFlag(DIFeatureFlag.DI_PERFORMANCE_MONITORING, false);
  }

  /**
   * Enable Phase 1 migration
   */
  enablePhase1(): void {
    this.setFlag(DIFeatureFlag.DI_ENABLED, 'partial');
    this.setFlag(DIFeatureFlag.DI_LOGGER_ENABLED, false);
  }

  /**
   * Enable Phase 2 migration
   */
  enablePhase2(): void {
    this.setFlag(DIFeatureFlag.DI_ENABLED, 'partial');
    this.setFlag(DIFeatureFlag.DI_LOGGER_ENABLED, true);
  }

  /**
   * Enable Phase 3 migration (full DI)
   */
  enablePhase3(): void {
    this.setFlag(DIFeatureFlag.DI_ENABLED, 'full');
    this.setFlag(DIFeatureFlag.DI_LOGGER_ENABLED, true);
  }

  /**
   * Get migration phase status
   */
  getMigrationStatus(): {
    phase1: boolean;
    phase2: boolean;
    phase3: boolean;
    current: 'none' | 'phase1' | 'phase2' | 'phase3';
  } {
    const phase1 = this.isDIEnabledForPhase(1);
    const phase2 = this.isDIEnabledForPhase(2);
    const phase3 = this.isDIEnabledForPhase(3);

    let current: 'none' | 'phase1' | 'phase2' | 'phase3' = 'none';
    if (phase3) {
      current = 'phase3';
    } else if (phase2 && phase1) {
      current = 'phase2';
    } else if (phase1) {
      current = 'phase1';
    }

    return { phase1, phase2, phase3, current };
  }

  private notifyListeners(flag: string, value: unknown): void {
    const listeners = this.listeners.get(flag);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (_error) {
          // Error in feature flag listener - silently handle
        }
      }
    }
  }
}

// Global feature flag manager instance
export const globalFeatureFlags = new FeatureFlagManager();
