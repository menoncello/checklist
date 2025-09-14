/**
 * View System Exports
 *
 * Main entry point for the view management system.
 * Exports all public interfaces and classes.
 */

// Types and interfaces
export * from './types';

// Core view system
export { ViewSystem } from './ViewSystem';
export { BaseView } from './BaseView';

// Navigation components
export { NavigationStack } from '../navigation/NavigationStack';
export { ViewRegistry } from '../navigation/ViewRegistry';
export type { ViewRegistrationInfo } from '../navigation/ViewRegistry';
