/**
 * Dependency Injection Module
 *
 * Exports the IoC container and dependency tokens for the TUI package.
 */

export {
  Container,
  Lifecycle,
  globalContainer,
  type Token,
  type Factory,
} from './Container';
export * from './tokens';
