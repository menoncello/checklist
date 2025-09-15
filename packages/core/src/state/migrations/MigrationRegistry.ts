import { EventEmitter } from 'events';
import { PathFinder } from './PathFinder';
import {
  Migration,
  MigrationPath,
  MigrationError,
  compareVersions,
} from './types';

export class MigrationRegistry extends EventEmitter {
  private migrations: Map<string, Migration> = new Map();
  private versionGraph: Map<string, Set<string>> = new Map();

  constructor() {
    super();
  }

  registerMigration(migration: Migration): void {
    const key = `${migration.fromVersion}->${migration.toVersion}`;

    if (this.migrations.has(key)) {
      throw new Error(`Migration ${key} already registered`);
    }

    this.migrations.set(key, migration);

    if (!this.versionGraph.has(migration.fromVersion)) {
      this.versionGraph.set(migration.fromVersion, new Set());
    }
    const versionSet = this.versionGraph.get(migration.fromVersion);
    if (versionSet) {
      versionSet.add(migration.toVersion);
    }

    this.emit('migration:registered', migration);
  }

  getMigration(fromVersion: string, toVersion: string): Migration | undefined {
    const key = `${fromVersion}->${toVersion}`;
    return this.migrations.get(key);
  }

  getAllMigrations(): Migration[] {
    return Array.from(this.migrations.values());
  }

  findPath(fromVersion: string, toVersion: string): MigrationPath {
    if (this.isSameVersion(fromVersion, toVersion)) {
      return this.createEmptyPath(fromVersion, toVersion);
    }

    this.validateMigrationDirection(fromVersion, toVersion);
    const path = this.findShortestPath(fromVersion, toVersion);
    const migrations = this.buildMigrationChain(path);

    return {
      migrations,
      fromVersion,
      toVersion,
      totalSteps: migrations.length,
    };
  }

  /**
   * Check if versions are the same
   */
  private isSameVersion(fromVersion: string, toVersion: string): boolean {
    return fromVersion === toVersion;
  }

  /**
   * Create empty migration path for same versions
   */
  private createEmptyPath(
    fromVersion: string,
    toVersion: string
  ): MigrationPath {
    return {
      migrations: [],
      fromVersion,
      toVersion,
      totalSteps: 0,
    };
  }

  /**
   * Validate that migration direction is forward
   */
  private validateMigrationDirection(
    fromVersion: string,
    toVersion: string
  ): void {
    const comparison = compareVersions(fromVersion, toVersion);
    if (comparison > 0) {
      throw new MigrationError(
        `Cannot migrate backwards from ${fromVersion} to ${toVersion}`,
        fromVersion,
        toVersion
      );
    }
  }

  /**
   * Find shortest path using Dijkstra's algorithm
   */
  private findShortestPath(fromVersion: string, toVersion: string): string[] {
    const path = this.dijkstraPath(fromVersion, toVersion);

    if (!path) {
      throw new MigrationError(
        `No migration path found from ${fromVersion} to ${toVersion}`,
        fromVersion,
        toVersion
      );
    }

    return path;
  }

  /**
   * Build migration chain from path
   */
  private buildMigrationChain(path: string[]): Migration[] {
    const migrations: Migration[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const migration = this.getMigration(path[i], path[i + 1]);
      if (!migration) {
        throw new MigrationError(
          `Missing migration from ${path[i]} to ${path[i + 1]}`,
          path[i],
          path[i + 1]
        );
      }
      migrations.push(migration);
    }
    return migrations;
  }

  private dijkstraPath(start: string, end: string): string[] | null {
    const pathFinder = new PathFinder(
      this.versionGraph,
      Array.from(this.getAllVersions())
    );
    return pathFinder.findPath(start, end);
  }

  private getAllVersions(): Set<string> {
    const versions = new Set<string>();

    for (const migration of this.migrations.values()) {
      versions.add(migration.fromVersion);
      versions.add(migration.toVersion);
    }

    return versions;
  }

  canMigrate(fromVersion: string, toVersion: string): boolean {
    try {
      this.findPath(fromVersion, toVersion);
      return true;
    } catch {
      return false;
    }
  }

  getAvailableTargets(fromVersion: string): string[] {
    const targets: string[] = [];

    for (const version of this.getAllVersions()) {
      if (version !== fromVersion && this.canMigrate(fromVersion, version)) {
        targets.push(version);
      }
    }

    return targets.sort((a, b) => compareVersions(b, a));
  }

  clear(): void {
    this.migrations.clear();
    this.versionGraph.clear();
    this.emit('registry:cleared');
  }

  toJSON(): unknown {
    return {
      migrations: Array.from(this.migrations.entries()).map(
        ([key, migration]) => ({
          key,
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          description: migration.description,
        })
      ),
      versionGraph: Array.from(this.versionGraph.entries()).map(
        ([from, toSet]) => ({
          from,
          to: Array.from(toSet),
        })
      ),
    };
  }

  getMigrationPath(
    fromVersion: string,
    toVersion: string
  ): {
    migrations: Migration[];
    totalSteps: number;
  } {
    // Use findPath to get the correct migration path
    const path = this.findPath(fromVersion, toVersion);
    return {
      migrations: path.migrations,
      totalSteps: path.totalSteps,
    };
  }
}
