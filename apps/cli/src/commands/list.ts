/**
 * List Command
 * List available templates
 */

import type { CommandOption, ParsedOptions } from '../types';
import { BaseCommand } from './base';

export class ListCommand extends BaseCommand {
  name = 'list';
  description = 'List available templates';
  aliases = ['ls'];
  options: CommandOption[] = [
    {
      flag: 'format',
      description: 'Output format (text, json, yaml)',
      default: 'text',
    },
    {
      flag: 'filter',
      description: 'Filter templates by pattern',
    },
  ];

  async action(options: ParsedOptions): Promise<void> {
    this.validateOptions(options);

    const format = this.getOption(options, 'format', 'text');
    const filter = this.getOption(options, 'filter');

    console.log('Available Templates:');

    if (Boolean(filter)) {
      console.log(`Filter: ${filter}`);
    }

    console.log(`Format: ${format}`);

    // TODO: Implement actual template listing logic
    // This is a placeholder implementation for the CLI structure
    const mockTemplates = [
      'default - Basic checklist template',
      'development - Software development workflow',
      'deployment - Application deployment checklist',
    ];

    for (const template of mockTemplates) {
      if (!Boolean(filter) || template.includes(filter as string)) {
        console.log(`  ${template}`);
      }
    }
  }
}
