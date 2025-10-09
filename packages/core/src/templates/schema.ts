/**
 * JSON Schema for ChecklistTemplate validation
 */

export const TEMPLATE_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'version', 'steps'],
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    description: { type: 'string' },
    variables: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'type', 'required', 'description'],
        properties: {
          name: {
            type: 'string',
            pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
          },
          type: {
            type: 'string',
            enum: ['string', 'number', 'boolean', 'array'],
          },
          required: { type: 'boolean' },
          default: {},
          description: { type: 'string' },
          validation: { type: 'string' },
        },
      },
    },
    steps: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'title', 'type', 'commands', 'executionMode'],
        properties: {
          id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'task',
              'confirmation',
              'input',
              'automated',
              'multi-command',
            ],
          },
          commands: {
            type: 'array',
            items: {
              type: 'object',
              required: [
                'id',
                'type',
                'content',
                'dangerous',
                'requiresConfirmation',
              ],
              properties: {
                id: { type: 'string' },
                type: {
                  type: 'string',
                  enum: ['bash', 'node', 'python', 'custom'],
                },
                content: { type: 'string' },
                dangerous: { type: 'boolean' },
                requiresConfirmation: { type: 'boolean' },
              },
            },
          },
          condition: { type: 'string' },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
          },
          validation: { type: 'object' },
          executionMode: {
            type: 'string',
            enum: ['sequential', 'parallel'],
          },
          continueOnError: { type: 'boolean' },
        },
      },
    },
    metadata: {
      type: 'object',
      required: ['author', 'tags', 'visibility', 'created', 'updated'],
      properties: {
        author: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
        visibility: {
          type: 'string',
          enum: ['public', 'private', 'internal'],
        },
        created: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' },
        parent: { type: 'string' },
      },
    },
  },
} as const;
