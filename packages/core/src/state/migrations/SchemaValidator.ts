import { StateSchema } from './types';

/**
 * Schema validation utilities
 */
export class SchemaValidator {
  /**
   * Validate v0.0.0 schema
   */
  static validateV000(state: StateSchema): boolean {
    if (!Array.isArray(state.checklists)) {
      return false;
    }

    return state.checklists.every((checklist) =>
      this.validateChecklist(checklist)
    );
  }

  /**
   * Validate v0.1.0 schema
   */
  static validateV010(state: StateSchema): boolean {
    if (!state.metadata || typeof state.metadata !== 'object') {
      return false;
    }

    const metadata = state.metadata as Record<string, unknown>;
    return (
      this.validateMetadata(metadata) &&
      this.validateChecklists(state.checklists)
    );
  }

  /**
   * Validate v0.2.0 schema
   */
  static validateV020(state: StateSchema): boolean {
    if (!state.templates || !state.variables) {
      return false;
    }

    return (
      this.validateTemplates(state.templates) &&
      this.validateVariables(state.variables)
    );
  }

  /**
   * Validate v1.0.0 schema
   */
  static validateV100(state: StateSchema): boolean {
    if (!state.schemaVersion || state.schemaVersion !== '1.0.0') {
      return false;
    }

    return this.validateCompleteSchema(state);
  }

  /**
   * Validate checklist structure
   */
  private static validateChecklist(checklist: unknown): boolean {
    if (typeof checklist !== 'object' || checklist === null) {
      return false;
    }

    const c = checklist as Record<string, unknown>;
    return c.id !== undefined && c.name !== undefined && Array.isArray(c.items);
  }

  /**
   * Validate metadata
   */
  private static validateMetadata(metadata: Record<string, unknown>): boolean {
    return metadata.createdAt !== undefined && metadata.updatedAt !== undefined;
  }

  /**
   * Validate checklists array
   */
  private static validateChecklists(checklists: unknown): boolean {
    return (
      Array.isArray(checklists) &&
      checklists.every((c) => this.validateChecklist(c))
    );
  }

  /**
   * Validate templates
   */
  private static validateTemplates(templates: unknown): boolean {
    return templates !== undefined && typeof templates === 'object';
  }

  /**
   * Validate variables
   */
  private static validateVariables(variables: unknown): boolean {
    return variables !== undefined && typeof variables === 'object';
  }

  /**
   * Validate complete schema
   */
  private static validateCompleteSchema(state: StateSchema): boolean {
    return (
      state.metadata !== undefined &&
      state.checklists !== undefined &&
      state.templates !== undefined &&
      state.variables !== undefined
    );
  }
}
