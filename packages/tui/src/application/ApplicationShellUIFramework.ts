import {
  ComponentInstance,
  PerformanceMetrics,
} from '../framework/UIFramework';

export class ApplicationShellUIFramework {
  public createComponent(
    name: string,
    props: Record<string, unknown>
  ): ComponentInstance {
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

  public getMetrics(metrics: unknown): PerformanceMetrics {
    return metrics as PerformanceMetrics;
  }
}
