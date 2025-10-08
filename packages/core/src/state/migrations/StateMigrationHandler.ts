import { MigrationRegistry } from './MigrationRegistry';
import { StateSchema } from './types';

/**
 * Handles in-memory state migration logic
 */
export class StateMigrationHandler {
  constructor(private registry: MigrationRegistry) {}

  /**
   * Migrate state object in memory
   */
  async migrateState(
    state: StateSchema,
    fromVersion: string,
    toVersion: string
  ): Promise<StateSchema> {
    const path = this.registry.getMigrationPath(fromVersion, toVersion);
    if (path.migrations.length === 0) return state;

    let currentState = state;
    for (const m of path.migrations) {
      if (m.up == null)
        throw new Error(
          `Missing 'up' function: ${m.fromVersion} -> ${m.toVersion}`
        );
      currentState = m.up(currentState) as unknown as StateSchema;
    }
    return currentState;
  }

  /**
   * Get migration path between versions
   */
  getMigrationPath(fromVersion: string, toVersion: string) {
    return this.registry.getMigrationPath(fromVersion, toVersion);
  }
}
