export const version = '0.0.1';
console.log('Package @checklist/core initialized');

// Export state management modules
export { StateManager } from './state/StateManager';
export { DirectoryManager } from './state/DirectoryManager';
export { ConcurrencyManager } from './state/ConcurrencyManager';
export { TransactionCoordinator } from './state/TransactionCoordinator';
export { BackupManager } from './state/BackupManager';
export * from './state/types';
export * from './state/errors';
export * from './state/constants';
