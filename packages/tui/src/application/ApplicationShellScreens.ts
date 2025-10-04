import { Screen } from '../framework/UIFramework';

export class ApplicationShellScreens {
  public pushScreen(_screen: unknown): void {
    // Screen management not implemented in Application Shell
  }

  public popScreen(): void {
    // Screen management not implemented in Application Shell
  }

  public replaceScreen(_screen: unknown): void {
    // Screen management not implemented in Application Shell
  }

  public getCurrentScreen(): Screen | null {
    return null;
  }
}
