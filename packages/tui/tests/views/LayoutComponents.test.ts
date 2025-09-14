/**
 * Layout Components Tests
 *
 * Tests for layout component management including header/footer components
 * and layout rendering functionality in the ViewSystem.
 * Addresses QA gap: AC4 (Layout patterns) - Missing header/footer component tests.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { ViewSystem } from '../../src/views/ViewSystem.js';
import { DefaultHeaderComponent } from '../../src/layout/DefaultHeaderComponent.js';
import { DefaultFooterComponent } from '../../src/layout/DefaultFooterComponent.js';
import { LayoutManager } from '../../src/layout/LayoutManager.js';
import { 
  LayoutType, 
  type View, 
  type ViewState, 
  type LayoutComponent,
  type LayoutContext
} from '../../src/views/types.js';

// Mock view implementation for testing
class MockView implements View {
  public mounted = false;
  public state: ViewState = {};

  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly canGoBack: boolean = true
  ) {}

  async onMount(): Promise<void> {
    this.mounted = true;
  }

  async onUnmount(): Promise<void> {
    this.mounted = false;
  }

  onResize(width: number, height: number): void {}

  saveState(): ViewState {
    return { ...this.state };
  }

  restoreState(state: ViewState): void {
    this.state = { ...state };
  }

  render(): string {
    return `Content of ${this.title}`;
  }

  getKeyBindings() {
    return [
      { key: 'q', description: 'Quit', action: () => {} },
      { key: 'h', description: 'Help', action: () => {} },
      { key: '?', description: 'Show keys', action: () => {} },
    ];
  }
}

// Mock layout component for testing
class MockLayoutComponent implements LayoutComponent {
  constructor(
    public readonly id: string,
    public readonly position: 'header' | 'footer' | 'sidebar-left' | 'sidebar-right'
  ) {}

  render(context: LayoutContext): string {
    return `${this.position.toUpperCase()}: ${this.id} (${context.width}x${context.height})`;
  }
}

describe('Layout Components', () => {
  let viewSystem: ViewSystem;
  let mockView: MockView;
  let headerComponent: DefaultHeaderComponent;
  let footerComponent: DefaultFooterComponent;

  beforeEach(async () => {
    viewSystem = new ViewSystem();
    await viewSystem.initialize();

    mockView = new MockView('test-view', 'Test View');
    viewSystem.registerView(mockView.id, mockView);

    headerComponent = new DefaultHeaderComponent();
    footerComponent = new DefaultFooterComponent();
  });

  describe('Default Header Component', () => {
    test('should render title correctly', () => {
      const context = {
        width: 80,
        height: 24,
        currentView: mockView,
      };

      const rendered = headerComponent.render(context);
      expect(rendered).toContain('Test View');
      expect(rendered).toContain('─'.repeat(80)); // Separator line
    });

    test('should center title within available width', () => {
      const context = {
        width: 20,
        height: 24,
        currentView: mockView,
      };

      const rendered = headerComponent.render(context);
      const lines = rendered.split('\n');
      const titleLine = lines[0];
      
      // Title should be approximately centered
      expect(titleLine.trim()).toContain('Test View');
      expect(titleLine.length).toBeLessThanOrEqual(20);
    });

    test('should truncate long titles', () => {
      const longTitleView = new MockView('long-view', 'This is a very long title that should be truncated when the terminal width is small');
      const context = {
        width: 30,
        height: 24,
        currentView: longTitleView,
      };

      const rendered = headerComponent.render(context);
      expect(rendered).toContain('...');
    });

    test('should render breadcrumbs when provided', () => {
      const context = {
        width: 80,
        height: 24,
        currentView: mockView,
        navigation: {
          canGoBack: true,
          breadcrumbs: ['Home', 'Settings', 'Display'],
        },
      };

      const rendered = headerComponent.render(context);
      expect(rendered).toContain('Home › Settings › Display');
    });

    test('should truncate breadcrumbs when too long', () => {
      const context = {
        width: 40,
        height: 24,
        currentView: mockView,
        navigation: {
          canGoBack: true,
          breadcrumbs: ['Very Long Breadcrumb Name', 'Another Long Name', 'Yet Another Very Long Breadcrumb'],
        },
      };

      const rendered = headerComponent.render(context);
      const lines = rendered.split('\n');
      const breadcrumbLine = lines.find(line => line.includes('›'));
      
      if (breadcrumbLine) {
        expect(breadcrumbLine.length).toBeLessThanOrEqual(40);
        expect(breadcrumbLine).toContain('...');
      }
    });

    test('should handle component without title', () => {
      const headerWithoutTitle = new DefaultHeaderComponent(true, false);
      const context = {
        width: 80,
        height: 24,
        currentView: mockView,
        navigation: {
          canGoBack: true,
          breadcrumbs: ['Home', 'Settings'],
        },
      };

      const rendered = headerWithoutTitle.render(context);
      expect(rendered).not.toContain('Test View');
      expect(rendered).toContain('Home › Settings');
    });

    test('should calculate correct height', () => {
      const fullHeader = new DefaultHeaderComponent(true, true);
      const titleOnly = new DefaultHeaderComponent(false, true);
      const breadcrumbsOnly = new DefaultHeaderComponent(true, false);
      const empty = new DefaultHeaderComponent(false, false);

      expect(fullHeader.getHeight()).toBe(3); // Title + breadcrumbs + separator
      expect(titleOnly.getHeight()).toBe(2); // Title + separator
      expect(breadcrumbsOnly.getHeight()).toBe(2); // Breadcrumbs + separator
      expect(empty.getHeight()).toBe(1); // Just separator
    });
  });

  describe('Default Footer Component', () => {
    test('should render key bindings correctly', () => {
      const context = {
        width: 80,
        height: 24,
        keyBindings: mockView.getKeyBindings(),
      };

      const rendered = footerComponent.render(context);
      expect(rendered).toContain('q: Quit');
      expect(rendered).toContain('h: Help');
      expect(rendered).toContain('?:');
    });

    test('should render status messages with icons', () => {
      const context = {
        width: 80,
        height: 24,
        status: {
          message: 'Operation completed successfully',
          type: 'success' as const,
        },
      };

      const rendered = footerComponent.render(context);
      expect(rendered).toContain('✓ Operation completed successfully');
    });

    test('should handle different status types', () => {
      const statusTypes = [
        { type: 'info' as const, icon: 'ℹ' },
        { type: 'warning' as const, icon: '⚠' },
        { type: 'error' as const, icon: '✗' },
        { type: 'success' as const, icon: '✓' },
      ];

      statusTypes.forEach(({ type, icon }) => {
        const context = {
          width: 80,
          height: 24,
          status: {
            message: `This is a ${type} message`,
            type,
          },
        };

        const rendered = footerComponent.render(context);
        expect(rendered).toContain(`${icon} This is a ${type} message`);
      });
    });

    test('should truncate long status messages', () => {
      const context = {
        width: 30,
        height: 24,
        status: {
          message: 'This is a very long status message that should be truncated',
          type: 'info' as const,
        },
      };

      const rendered = footerComponent.render(context);
      expect(rendered).toContain('...');
    });

    test('should limit key bindings to prevent overflow', () => {
      const manyKeyBindings = Array.from({ length: 20 }, (_, i) => ({
        key: `k${i}`,
        description: `Action ${i}`,
        action: () => {},
      }));

      const context = {
        width: 80,
        height: 24,
        keyBindings: manyKeyBindings,
      };

      const rendered = footerComponent.render(context);
      // Should not contain all 20 bindings
      expect(rendered).not.toContain('k19: Action 19');
      // Should contain separator
      expect(rendered).toContain('─'.repeat(80));
    });

    test('should calculate correct height', () => {
      const fullFooter = new DefaultFooterComponent(true, true);
      const keysOnly = new DefaultFooterComponent(true, false);
      const statusOnly = new DefaultFooterComponent(false, true);
      const separatorOnly = new DefaultFooterComponent(false, false);

      expect(fullFooter.getHeight()).toBe(3); // Separator + status + keys
      expect(keysOnly.getHeight()).toBe(2); // Separator + keys
      expect(statusOnly.getHeight()).toBe(2); // Separator + status
      expect(separatorOnly.getHeight()).toBe(1); // Just separator
    });
  });

  describe('Layout Manager', () => {
    let layoutManager: LayoutManager;
    let mockHeader: MockLayoutComponent;
    let mockFooter: MockLayoutComponent;

    beforeEach(() => {
      layoutManager = new LayoutManager();
      mockHeader = new MockLayoutComponent('test-header', 'header');
      mockFooter = new MockLayoutComponent('test-footer', 'footer');
    });

    test('should register and retrieve components', () => {
      layoutManager.registerComponent(mockHeader);
      layoutManager.registerComponent(mockFooter);

      expect(layoutManager.getComponent('test-header')).toBe(mockHeader);
      expect(layoutManager.getComponent('test-footer')).toBe(mockFooter);
    });

    test('should filter components by position', () => {
      const secondHeader = new MockLayoutComponent('header-2', 'header');
      
      layoutManager.registerComponent(mockHeader);
      layoutManager.registerComponent(mockFooter);
      layoutManager.registerComponent(secondHeader);

      const headerComponents = layoutManager.getComponentsByPosition('header');
      const footerComponents = layoutManager.getComponentsByPosition('footer');

      expect(headerComponents).toHaveLength(2);
      expect(footerComponents).toHaveLength(1);
      expect(headerComponents).toContain(mockHeader);
      expect(headerComponents).toContain(secondHeader);
    });

    test('should unregister components', () => {
      layoutManager.registerComponent(mockHeader);
      layoutManager.unregisterComponent('test-header');

      expect(layoutManager.getComponent('test-header')).toBeUndefined();
    });

    test('should render complete layout', () => {
      layoutManager.registerComponent(mockHeader);
      layoutManager.registerComponent(mockFooter);

      const layout = layoutManager.renderLayout({ width: 80, height: 24, currentView: mockView });

      expect(layout.header).toContain('HEADER: test-header (80x24)');
      expect(layout.footer).toContain('FOOTER: test-footer (80x24)');
      expect(layout.content.content).toBe('Content of Test View');
      expect(layout.content.width).toBe(80);
      expect(layout.content.height).toBeLessThan(24); // Should account for header/footer
    });

    test('should calculate content area correctly', () => {
      layoutManager.registerComponent(mockHeader);
      layoutManager.registerComponent(mockFooter);

      const layout = layoutManager.renderLayout({ width: 100, height: 30, currentView: mockView });

      expect(layout.content.x).toBe(0); // No sidebars
      expect(layout.content.y).toBeGreaterThan(0); // Header takes space
      expect(layout.content.width).toBe(100);
      expect(layout.content.height).toBeLessThan(30); // Header and footer take space
    });

    test('should provide accurate stats', () => {
      layoutManager.registerComponent(mockHeader);
      layoutManager.registerComponent(mockFooter);
      layoutManager.registerComponent(new MockLayoutComponent('sidebar', 'sidebar-left'));

      const stats = layoutManager.getStats();

      expect(stats.totalComponents).toBe(3);
      expect(stats.componentsByPosition.header).toBe(1);
      expect(stats.componentsByPosition.footer).toBe(1);
      expect(stats.componentsByPosition['sidebar-left']).toBe(1);
      expect(stats.componentsByPosition['sidebar-right']).toBe(0);
    });

    test('should clear all components', () => {
      layoutManager.registerComponent(mockHeader);
      layoutManager.registerComponent(mockFooter);

      layoutManager.clear();

      const stats = layoutManager.getStats();
      expect(stats.totalComponents).toBe(0);
    });
  });

  describe('ViewSystem Layout Integration', () => {
    beforeEach(async () => {
      await viewSystem.navigateTo(mockView.id);
    });

    test('should register and manage layout components', () => {
      viewSystem.registerLayoutComponent(headerComponent);
      viewSystem.registerLayoutComponent(footerComponent);

      expect(viewSystem.getLayoutComponent('default-header')).toBe(headerComponent);
      expect(viewSystem.getLayoutComponent('default-footer')).toBe(footerComponent);
    });

    test('should get components by position', () => {
      viewSystem.registerLayoutComponent(headerComponent);
      viewSystem.registerLayoutComponent(footerComponent);

      const headerComponents = viewSystem.getLayoutComponents('header');
      const footerComponents = viewSystem.getLayoutComponents('footer');

      expect(headerComponents).toHaveLength(1);
      expect(footerComponents).toHaveLength(1);
      expect(headerComponents[0]).toBe(headerComponent);
      expect(footerComponents[0]).toBe(footerComponent);
    });

    test('should render complete layout with view content', () => {
      viewSystem.registerLayoutComponent(headerComponent);
      viewSystem.registerLayoutComponent(footerComponent);

      const layout = viewSystem.renderLayout(80, 24);

      expect(layout.header).toContain('Test View'); // From header
      expect(layout.footer).toContain('q: Quit'); // From footer (key bindings)
      expect(layout.content.content).toBe('Content of Test View'); // From view
    });

    test('should generate breadcrumbs for navigation', async () => {
      const view2 = new MockView('view-2', 'Second View');
      viewSystem.registerView(view2.id, view2);

      // Navigate to create history
      await viewSystem.navigateTo(view2.id);

      viewSystem.registerLayoutComponent(headerComponent);
      const layout = viewSystem.renderLayout(80, 24);

      expect(layout.header).toContain('›'); // Breadcrumb separator
    });

    test('should generate breadcrumbs for tabbed layout', async () => {
      await viewSystem.addTab(mockView.id);
      viewSystem.registerLayoutComponent(headerComponent);

      const layout = viewSystem.renderLayout(80, 24);

      expect(layout.header).toContain('Tabs');
      expect(layout.header).toContain('Test View');
    });

    test('should unregister layout components', () => {
      viewSystem.registerLayoutComponent(headerComponent);
      viewSystem.unregisterLayoutComponent('default-header');

      expect(viewSystem.getLayoutComponent('default-header')).toBeUndefined();
    });

    test('should clean up layout components on destroy', async () => {
      viewSystem.registerLayoutComponent(headerComponent);
      viewSystem.registerLayoutComponent(footerComponent);

      await viewSystem.destroy();

      const layout = viewSystem.renderLayout(80, 24);
      expect(layout.header).toBe(''); // No header components
      expect(layout.footer).toBe(''); // No footer components
    });
  });

  describe('Layout Patterns Consistency', () => {
    beforeEach(async () => {
      await viewSystem.navigateTo(mockView.id);
    });

    test('should maintain consistent header/footer across different layouts', () => {
      viewSystem.registerLayoutComponent(headerComponent);
      viewSystem.registerLayoutComponent(footerComponent);
      
      const layouts = [LayoutType.SINGLE, LayoutType.SPLIT_VERTICAL, LayoutType.TABBED];
      
      layouts.forEach(layoutType => {
        viewSystem.setLayout(layoutType);
        const layout = viewSystem.renderLayout(80, 24);
        
        // Header and footer should be consistent regardless of layout
        expect(layout.header).toContain('Test View');
        expect(layout.footer).toContain('─'.repeat(80));
      });
    });

    test('should adjust content area based on layout components', () => {
      // Test without layout components
      const layoutWithoutComponents = viewSystem.renderLayout(80, 24);
      
      // Test with layout components
      viewSystem.registerLayoutComponent(headerComponent);
      viewSystem.registerLayoutComponent(footerComponent);
      const layoutWithComponents = viewSystem.renderLayout(80, 24);
      
      // Content area should be smaller when layout components are present
      expect(layoutWithComponents.content.height).toBeLessThan(layoutWithoutComponents.content.height);
      expect(layoutWithComponents.content.y).toBeGreaterThan(layoutWithoutComponents.content.y);
    });
  });
});