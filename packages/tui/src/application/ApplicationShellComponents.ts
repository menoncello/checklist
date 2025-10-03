import { createLogger } from '@checklist/core/utils/logger';
import { ComponentInstance } from '../framework/UIFramework';

const logger = createLogger('checklist:tui:application-shell-components');

export class ApplicationShellComponents {
  public registerComponent(_name: string, _component: unknown): void {
    logger.warn({
      msg: 'registerComponent not implemented in Application Shell',
    });
  }

  public createComponent(
    name: string,
    props: Record<string, unknown>
  ): ComponentInstance {
    logger.warn({
      msg: 'createComponent not implemented in Application Shell',
    });
    return {
      component: {
        id: name,
        render: () => `[Component: ${name}]`,
      },
      props,
      mounted: false,
      render: () => `[Component: ${name}]`,
      destroy: () => {},
    };
  }
}
