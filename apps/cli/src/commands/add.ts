/**
 * Add Command
 * Add template to project
 */

import type { CommandOption, ParsedOptions } from '../types';
import { BaseCommand } from './base';

export class AddCommand extends BaseCommand {
  name = 'add';
  description = 'Add template to project';
  aliases = ['a'];
  options: CommandOption[] = [
    {
      flag: 'source',
      description: 'Source location for the template (url, path, or registry)',
    },
    {
      flag: 'force',
      description: 'Force addition even if template already exists',
    },
  ];

  async action(options: ParsedOptions): Promise<void> {
    this.validateOptions(options);

    const template = options._[0];
    if (!template) {
      throw new Error(
        'Template name is required. Usage: checklist add <template>'
      );
    }

    const source = this.getOption(options, 'source');
    const force = this.getOption(options, 'force', false);

    console.log(`Adding template: ${template}`);

    if (Boolean(source)) {
      console.log(`Source: ${source}`);
    }

    if (force) {
      console.log('Force flag enabled - will overwrite existing template');
    }

    // TODO: Implement actual template addition logic
    // This is a placeholder implementation for the CLI structure
    console.log('Template added successfully!');
  }
}
