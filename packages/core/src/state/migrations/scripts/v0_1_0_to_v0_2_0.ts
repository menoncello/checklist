import { Migration } from '../types';

export const migration_v0_1_0_to_v0_2_0: Migration = {
  fromVersion: '0.1.0',
  toVersion: '0.2.0',
  description: 'Add support for templates and variables',

  up: (state: unknown) => {
    const s = state as Record<string, unknown>;
    const now = new Date().toISOString();

    return {
      ...s,
      version: '0.2.0',
      schemaVersion: '0.2.0',
      templates: (s.templates as unknown[] | undefined) ?? [],
      variables: (s.variables as Record<string, unknown> | undefined) ?? {},
      metadata: {
        ...(s.metadata as Record<string, unknown> | undefined),
        modified: now,
        templatesAdded: now,
      },
      lastModified: now,
    };
  },

  down: (state: unknown) => {
    const s = state as Record<string, unknown>;
    const { templates: _templates, variables: _variables, ...rest } = s;

    if (
      (rest.metadata as Record<string, unknown>)?.templatesAdded !== undefined
    ) {
      delete (rest.metadata as Record<string, unknown>).templatesAdded;
    }

    return {
      ...rest,
      version: '0.1.0',
      schemaVersion: '0.1.0',
      lastModified: new Date().toISOString(),
    };
  },

  validate: (state: unknown): boolean => {
    const s = state as Record<string, unknown>;
    if (!Array.isArray(s.templates)) return false;
    if (typeof s.variables !== 'object' || s.variables === null) return false;
    if (s.version === null || s.version === undefined || s.version !== '0.2.0')
      return false;
    if (
      s.metadata === null ||
      s.metadata === undefined ||
      typeof s.metadata !== 'object'
    )
      return false;

    return true;
  },
};
