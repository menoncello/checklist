import { EventEmitter } from 'events';
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
    if (fromVersion === toVersion) {
      return {
        migrations: [],
        fromVersion,
        toVersion,
        totalSteps: 0,
      };
    }

    const comparison = compareVersions(fromVersion, toVersion);
    if (comparison > 0) {
      throw new MigrationError(
        `Cannot migrate backwards from ${fromVersion} to ${toVersion}`,
        fromVersion,
        toVersion
      );
    }

    const path = this.dijkstraPath(fromVersion, toVersion);

    if (!path) {
      throw new MigrationError(
        `No migration path found from ${fromVersion} to ${toVersion}`,
        fromVersion,
        toVersion
      );
    }

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

    return {
      migrations,
      fromVersion,
      toVersion,
      totalSteps: migrations.length,
    };
  }

  private dijkstraPath(start: string, end: string): string[] | null {
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    for (const version of this.getAllVersions()) {
      distances.set(version, version === start ? 0 : Infinity);
      previous.set(version, null);
      unvisited.add(version);
    }

    if (!unvisited.has(end)) {
      unvisited.add(end);
      distances.set(end, Infinity);
      previous.set(end, null);
    }

    while (unvisited.size > 0) {
      let current: string | null = null;
      let minDistance = Infinity;

      for (const version of unvisited) {
        const distance = distances.get(version) ?? Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          current = version;
        }
      }

      if (current === null || minDistance === Infinity) {
        break;
      }

      if (current === end) {
        const path: string[] = [];
        let node: string | null = end;

        while (node !== null) {
          path.unshift(node);
          node = previous.get(node) ?? null;
        }

        return path[0] === start ? path : null;
      }

      unvisited.delete(current);

      const neighbors = this.versionGraph.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        if (unvisited.has(neighbor)) {
          const alt = (distances.get(current) ?? 0) + 1;
          if (alt < (distances.get(neighbor) ?? Infinity)) {
            distances.set(neighbor, alt);
            previous.set(neighbor, current);
          }
        }
      }
    }

    return null;
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

  toJSON(): any {
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
}
