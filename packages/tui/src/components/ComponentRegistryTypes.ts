import { Component, ComponentInstance } from '../framework/UIFramework';

export interface ComponentRegistration {
  name: string;
  component: Component;
  registeredAt: number;
  version: string;
  metadata?: Record<string, unknown>;
}

export interface ComponentFactory {
  (props: Record<string, unknown>): ComponentInstance;
}

export interface RegistryConfig {
  maxInstances?: number;
  enableMetrics?: boolean;
  autoCleanup?: boolean;
  cleanupInterval?: number;
}

export interface ComponentQuery {
  name?: string;
  version?: string;
  metadata?: Record<string, unknown>;
  registeredAfter?: number;
  registeredBefore?: number;
}

export interface RegistryMetrics {
  totalComponents: number;
  totalInstances: number;
  activeInstances: number;
  memoryUsage: number;
  avgCreationTime: number;
  lastCleanupTime: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ComponentExport {
  name: string;
  version: string;
  metadata?: Record<string, unknown>;
  registeredAt: number;
}
