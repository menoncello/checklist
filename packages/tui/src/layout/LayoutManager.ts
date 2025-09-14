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
} from '../views/types.js';

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

    // Render header components
    const headerComponents = this.getComponentsByPosition('header');
    const header = headerComponents
      .map((component) => component.render(context))
      .join('\n');

    // Render footer components
    const footerComponents = this.getComponentsByPosition('footer');
    const footer = footerComponents
      .map((component) => component.render(context))
      .join('\n');

    // Render sidebar components
    const leftSidebarComponents = this.getComponentsByPosition('sidebar-left');
    const rightSidebarComponents =
      this.getComponentsByPosition('sidebar-right');

    const leftSidebar =
      leftSidebarComponents.length > 0
        ? leftSidebarComponents
            .map((component) => component.render(context))
            .join('\n')
        : '';

    const rightSidebar =
      rightSidebarComponents.length > 0
        ? rightSidebarComponents
            .map((component) => component.render(context))
            .join('\n')
        : '';

    // Calculate content area dimensions
    const headerHeight = this.calculateComponentHeight(
      headerComponents,
      context
    );
    const footerHeight = this.calculateComponentHeight(
      footerComponents,
      context
    );

    const contentArea = {
      x: leftSidebar.length > 0 ? 20 : 0, // Assume sidebar width of 20
      y: headerHeight,
      width:
        width -
        (leftSidebar.length > 0 ? 20 : 0) -
        (rightSidebar.length > 0 ? 20 : 0),
      height: height - headerHeight - footerHeight,
      content: currentView?.render() ?? '',
    };

    return {
      header,
      footer,
      content: contentArea,
      sidebars: {
        left: leftSidebar.length > 0 ? leftSidebar : undefined,
        right: rightSidebar.length > 0 ? rightSidebar : undefined,
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
