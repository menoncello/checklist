/**
 * JSON Schema definition for TemplateManifest validation
 * Uses Ajv with Draft-07 specification
 */

import type { JSONSchemaType } from 'ajv';
import type { TemplateManifest } from '../types';

/**
 * JSON Schema for TemplateManifest validation
 * Enforces required fields, patterns, and constraints
 */
export const manifestSchema: JSONSchemaType<TemplateManifest> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'name',
    'version',
    'description',
    'author',
    'repository',
    'tags',
    'license',
    'files',
  ],
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z0-9-]+$',
      minLength: 1,
      maxLength: 50,
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?$',
    },
    description: {
      type: 'string',
      minLength: 10,
      maxLength: 200,
    },
    author: {
      anyOf: [
        { type: 'string' },
        {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email', nullable: true },
            url: { type: 'string', format: 'uri', nullable: true },
          },
          additionalProperties: false,
        },
      ],
    },
    repository: {
      type: 'object',
      required: ['type', 'url'],
      properties: {
        type: { type: 'string', enum: ['git'] },
        url: { type: 'string', format: 'uri' },
        directory: { type: 'string', nullable: true },
      },
      additionalProperties: false,
    },
    dependencies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'version'],
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          optional: { type: 'boolean', nullable: true },
        },
        additionalProperties: false,
      },
      nullable: true,
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 10,
    },
    license: { type: 'string' },
    homepage: { type: 'string', format: 'uri', nullable: true },
    bugs: { type: 'string', format: 'uri', nullable: true },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
    },
    files: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    main: { type: 'string', nullable: true },
    engines: {
      type: 'object',
      properties: {
        bmad: { type: 'string', nullable: true },
      },
      additionalProperties: false,
      nullable: true,
    },
  },
  additionalProperties: false,
};
