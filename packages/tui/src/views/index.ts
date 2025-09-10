/**
 * View System Exports
 *
 * Main entry point for the view management system.
 * Exports all public interfaces and classes.
 */

// Types and interfaces
export * from './types.js';

// Core view system
export { ViewSystem } from './ViewSystem.js';
export { BaseView } from './BaseView.js';

// Navigation components
export { NavigationStack } from '../navigation/NavigationStack.js';
export { ViewRegistry } from '../navigation/ViewRegistry.js';
export type { ViewRegistrationInfo } from '../navigation/ViewRegistry.js';
