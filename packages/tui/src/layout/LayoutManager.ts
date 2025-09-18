/**
 * Layout Manager
 *
 * Manages layout components and coordinates the rendering of header,
 * footer, and content areas with proper positioning and sizing.
 */

import type {
  LayoutComponent,
  LayoutContext,
  LayoutRender,
  View,
} from '../views/types';

export class LayoutManager {
  private readonly components = new Map<string, LayoutComponent>();

  registerComponent(component: LayoutComponent): void {
    this.components.set(component.id, component);
  }

  unregisterComponent(componentId: string): void {
    this.components.delete(componentId);
  }

  getComponent(componentId: string): LayoutComponent | undefined {
    return this.components.get(componentId);
  }

  getComponentsByPosition(
    position: LayoutComponent['position']
  ): LayoutComponent[] {
    return Array.from(this.components.values()).filter(
      (component) => component.position === position
    );
  }

  renderLayout(options: {
    width: number;
    height: number;
    currentView?: View;
    navigation?: {
      canGoBack: boolean;
      breadcrumbs: string[];
    };
    status?: {
      message: string;
      type: 'info' | 'warning' | 'error' | 'success';
    };
  }): LayoutRender {
    const { width, height, currentView, navigation, status } = options;
    const context: LayoutContext = {
      width,
      height,
      currentView,
      navigation,
      status,
      keyBindings: currentView?.getKeyBindings() ?? [],
    };

    const renderedComponents = this.renderAllComponents(context);
    const contentArea = this.calculateContentArea(options, renderedComponents);

    return this.buildLayoutRender(renderedComponents, contentArea);
  }

  private renderAllComponents(context: LayoutContext) {
    return {
      header: this.renderComponentsByPosition('header', context) as string,
      footer: this.renderComponentsByPosition('footer', context) as string,
      leftSidebar: this.renderComponentsByPosition(
        'sidebar-left',
        context
      ) as string[],
      rightSidebar: this.renderComponentsByPosition(
        'sidebar-right',
        context
      ) as string[],
    };
  }

  private renderComponentsByPosition(
    position: 'header' | 'footer' | 'sidebar-left' | 'sidebar-right',
    context: LayoutContext
  ): string | string[] {
    const components = this.getComponentsByPosition(position);
    const rendered = components.map((component) => component.render(context));

    // Return arrays for sidebars, joined strings for header/footer
    if (position === 'sidebar-left' || position === 'sidebar-right') {
      return rendered;
    }
    return rendered.join('\n');
  }

  private calculateContentArea(
    options: {
      width: number;
      height: number;
      currentView?: { render(): string };
    },
    renderedComponents: {
      leftSidebar: string[];
      rightSidebar: string[];
      header: string;
      footer: string;
    }
  ) {
    const { width, height, currentView } = options;
    const { leftSidebar, rightSidebar } = renderedComponents;
    const layoutCtx = { width, height } as LayoutContext;
    const heights = this.calculateHeaderFooterHeights(layoutCtx);
    return this.buildContentArea({
      width,
      height,
      headerHeight: heights.header,
      footerHeight: heights.footer,
      leftSidebar,
      rightSidebar,
      currentView,
    });
  }

  private calculateHeaderFooterHeights(layoutCtx: LayoutContext) {
    return {
      header: this.calculateComponentHeight(
        this.getComponentsByPosition('header'),
        layoutCtx
      ),
      footer: this.calculateComponentHeight(
        this.getComponentsByPosition('footer'),
        layoutCtx
      ),
    };
  }

  private buildContentArea(params: {
    width: number;
    height: number;
    headerHeight: number;
    footerHeight: number;
    leftSidebar: string[];
    rightSidebar: string[];
    currentView?: { render(): string };
  }) {
    const leftOffset = params.leftSidebar.length > 0 ? 20 : 0;
    const rightOffset = params.rightSidebar.length > 0 ? 20 : 0;

    return {
      x: leftOffset,
      y: params.headerHeight,
      width: params.width - leftOffset - rightOffset,
      height: params.height - params.headerHeight - params.footerHeight,
      content: params.currentView?.render() ?? '',
    };
  }

  private buildLayoutRender(
    renderedComponents: {
      header: string;
      footer: string;
      leftSidebar: string[];
      rightSidebar: string[];
    },
    contentArea: {
      x: number;
      y: number;
      width: number;
      height: number;
      content: string;
    }
  ) {
    const { header, footer, leftSidebar, rightSidebar } = renderedComponents;
    return {
      header,
      footer,
      content: contentArea,
      sidebars: {
        left: leftSidebar.length > 0 ? leftSidebar.join('\n') : undefined,
        right: rightSidebar.length > 0 ? rightSidebar.join('\n') : undefined,
      },
    };
  }

  private calculateComponentHeight(
    components: LayoutComponent[],
    context: LayoutContext
  ): number {
    if (components.length === 0) return 0;

    // For now, estimate height based on rendered content
    // In a real implementation, components might provide getHeight() method
    return components.reduce((total, component) => {
      const rendered = component.render(context);
      const lines = rendered.split('\n').length;
      return total + lines;
    }, 0);
  }

  clear(): void {
    this.components.clear();
  }

  getStats(): {
    totalComponents: number;
    componentsByPosition: Record<LayoutComponent['position'], number>;
  } {
    const componentsByPosition: Record<LayoutComponent['position'], number> = {
      header: 0,
      footer: 0,
      'sidebar-left': 0,
      'sidebar-right': 0,
    };

    for (const component of this.components.values()) {
      componentsByPosition[component.position]++;
    }

    return {
      totalComponents: this.components.size,
      componentsByPosition,
    };
  }
}
