import { ViewSystem } from '../views/ViewSystem';
import {
  NavigationCommand,
  NavigationCommandExecutor,
} from './NavigationCommands';

/**
 * NavigationModalHelper - Handles modal dialogs for navigation
 */
export class NavigationModalHelper {
  constructor(
    private viewSystem: ViewSystem,
    private commandExecutor: NavigationCommandExecutor
  ) {}

  public async showConfirmationDialog(
    command: NavigationCommand
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = {
        id: 'navigation-confirmation',
        title: 'Confirm Action',
        content: `Are you sure you want to ${command.description.toLowerCase()}?`,
        buttons: [
          { label: 'Yes', action: () => resolve(true) },
          { label: 'No', action: () => resolve(false) },
        ],
      };

      this.viewSystem.showModal(modal);
    });
  }

  public async showHelpOverlay(commands: NavigationCommand[]): Promise<void> {
    const helpContent = this.generateHelpContent(commands);

    const helpModal = {
      id: 'navigation-help',
      title: 'Navigation Help',
      content: helpContent,
      buttons: [
        {
          label: 'Close',
          action: () => this.viewSystem.hideModal(),
        },
      ],
    };

    await this.viewSystem.showModal(helpModal);
  }

  public async showQuitConfirmation(hasUnsavedChanges: boolean): Promise<void> {
    if (hasUnsavedChanges) {
      const modal = {
        id: 'quit-confirmation',
        title: 'Unsaved Changes',
        content:
          'You have unsaved changes. Do you want to save before quitting?',
        buttons: [
          {
            label: 'Save & Quit',
            action: () => this.commandExecutor.saveAndQuit(),
          },
          {
            label: 'Quit Without Saving',
            action: () => this.commandExecutor.forceQuit(),
          },
          {
            label: 'Cancel',
            action: () => this.viewSystem.hideModal(),
          },
        ],
      };

      await this.viewSystem.showModal(modal);
    } else {
      this.commandExecutor.forceQuit();
    }
  }

  private generateHelpContent(commands: NavigationCommand[]): string {
    let content = 'Navigation Commands:\n\n';

    for (const command of commands) {
      const key = command.key === 'Enter' ? '↵' : command.key;
      content += `${key.padEnd(8)} - ${command.description}\n`;
    }

    return content;
  }
}
