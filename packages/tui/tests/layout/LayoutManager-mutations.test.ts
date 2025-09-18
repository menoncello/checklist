/**
 * Mutation Tests for LayoutManager
 * 
 * These tests are specifically designed to kill mutations in LayoutManager.ts
 * by providing exact value assertions, boundary conditions, and comprehensive
 * coverage of all branches and conditions.
 */

import { test, expect, beforeEach, describe } from 'bun:test';
import { LayoutManager } from '../../src/layout/LayoutManager';
import type { LayoutComponent, LayoutContext, View } from '../../src/views/types';

describe('LayoutManager Mutation Tests', () => {
  let layoutManager: LayoutManager;

  beforeEach(() => {
    layoutManager = new LayoutManager();
  });

  describe('String Literal Mutations - Exact Position Values', () => {
    test('should register component with exact header position string', () => {
      const component: LayoutComponent = {
        id: 'test-header',
        position: 'header',
        render: () => 'Header Content'
      };

      layoutManager.registerComponent(component);
      const retrieved = layoutManager.getComponent('test-header');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-header');
      expect(retrieved?.position).toBe('header'); // Kill string mutations
    });

    test('should register component with exact footer position string', () => {
      const component: LayoutComponent = {
        id: 'test-footer',
        position: 'footer',
        render: () => 'Footer Content'
      };

      layoutManager.registerComponent(component);
      const retrieved = layoutManager.getComponent('test-footer');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.position).toBe('footer'); // Kill string mutations
    });

    test('should register component with exact sidebar-left position string', () => {
      const component: LayoutComponent = {
        id: 'test-sidebar-left',
        position: 'sidebar-left',
        render: () => 'Left Sidebar'
      };

      layoutManager.registerComponent(component);
      const retrieved = layoutManager.getComponent('test-sidebar-left');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.position).toBe('sidebar-left'); // Kill string mutations
    });

    test('should register component with exact sidebar-right position string', () => {
      const component: LayoutComponent = {
        id: 'test-sidebar-right',
        position: 'sidebar-right',
        render: () => 'Right Sidebar'
      };

      layoutManager.registerComponent(component);
      const retrieved = layoutManager.getComponent('test-sidebar-right');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.position).toBe('sidebar-right'); // Kill string mutations
    });

    test('should join components with exact newline separator', () => {
      const comp1: LayoutComponent = {
        id: 'header-1',
        position: 'header',
        render: () => 'Line 1'
      };
      
      const comp2: LayoutComponent = {
        id: 'header-2',
        position: 'header',
        render: () => 'Line 2'
      };

      layoutManager.registerComponent(comp1);
      layoutManager.registerComponent(comp2);

      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Verify exact newline character joining
      expect(result.header).toBe('Line 1\nLine 2'); // Kill string mutations on '\n'
    });
  });

  describe('Boolean and Conditional Mutations', () => {
    test('should handle exactly zero components - boundary condition', () => {
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      expect(result.header).toBe('');
      expect(result.footer).toBe('');
      expect(result.sidebars.left).toBeUndefined();
      expect(result.sidebars.right).toBeUndefined();
    });

    test('should handle exactly one component per position', () => {
      const headerComp: LayoutComponent = {
        id: 'single-header',
        position: 'header',
        render: () => 'Single Header'
      };

      layoutManager.registerComponent(headerComp);
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      expect(result.header).toBe('Single Header');
    });

    test('should handle left sidebar length > 0 condition exactly', () => {
      const leftSidebarComp: LayoutComponent = {
        id: 'left-sidebar',
        position: 'sidebar-left',
        render: () => 'Left'
      };

      layoutManager.registerComponent(leftSidebarComp);
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Test the exact condition: leftSidebar.length > 0
      expect(result.sidebars.left).toBe('Left');
      expect(result.content.x).toBe(20); // Should be 20 when sidebar exists
      expect(result.content.width).toBe(60); // 80 - 20 (left sidebar)
    });

    test('should handle left sidebar length = 0 condition exactly', () => {
      // No left sidebar registered
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Test the exact condition: leftSidebar.length = 0
      expect(result.sidebars.left).toBeUndefined();
      expect(result.content.x).toBe(0); // Should be 0 when no sidebar
      expect(result.content.width).toBe(80); // Full width when no sidebars
    });

    test('should handle right sidebar length > 0 condition exactly', () => {
      const rightSidebarComp: LayoutComponent = {
        id: 'right-sidebar',
        position: 'sidebar-right',
        render: () => 'Right'
      };

      layoutManager.registerComponent(rightSidebarComp);
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Test the exact condition: rightSidebar.length > 0
      expect(result.sidebars.right).toBe('Right');
      expect(result.content.width).toBe(60); // 80 - 20 (right sidebar)
    });

    test('should handle right sidebar length = 0 condition exactly', () => {
      // No right sidebar registered
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Test the exact condition: rightSidebar.length = 0
      expect(result.sidebars.right).toBeUndefined();
      expect(result.content.width).toBe(80); // Full width
    });

    test('should handle both sidebars present condition', () => {
      const leftComp: LayoutComponent = {
        id: 'left',
        position: 'sidebar-left',
        render: () => 'L'
      };
      
      const rightComp: LayoutComponent = {
        id: 'right',
        position: 'sidebar-right',
        render: () => 'R'
      };

      layoutManager.registerComponent(leftComp);
      layoutManager.registerComponent(rightComp);
      
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Test both conditions true
      expect(result.sidebars.left).toBe('L');
      expect(result.sidebars.right).toBe('R');
      expect(result.content.x).toBe(20); // Left sidebar offset
      expect(result.content.width).toBe(40); // 80 - 20 - 20 = 40
    });
  });

  describe('Arithmetic Operator Mutations - Exact Numeric Values', () => {
    test('should calculate exact sidebar width of 20', () => {
      const leftComp: LayoutComponent = {
        id: 'left',
        position: 'sidebar-left',
        render: () => 'Sidebar'
      };

      layoutManager.registerComponent(leftComp);
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Test exact arithmetic: x = 20 (not 19, 21, 0)
      expect(result.content.x).toBe(20);
      // Test exact subtraction: 80 - 20 = 60 (not 59, 61)
      expect(result.content.width).toBe(60);
    });

    test('should calculate width with both sidebars - exact arithmetic', () => {
      const leftComp: LayoutComponent = {
        id: 'left',
        position: 'sidebar-left',
        render: () => 'L'
      };
      
      const rightComp: LayoutComponent = {
        id: 'right',
        position: 'sidebar-right',
        render: () => 'R'
      };

      layoutManager.registerComponent(leftComp);
      layoutManager.registerComponent(rightComp);
      
      const result = layoutManager.renderLayout({ width: 100, height: 24 });
      
      // Test exact calculation: 100 - 20 - 20 = 60
      expect(result.content.width).toBe(60);
      // Verify not 59 or 61 (kill + - mutations)
      expect(result.content.width).not.toBe(59);
      expect(result.content.width).not.toBe(61);
    });

    test('should calculate height with header and footer - exact subtraction', () => {
      const headerComp: LayoutComponent = {
        id: 'header',
        position: 'header',
        render: () => 'Header Line 1\nHeader Line 2' // 2 lines
      };
      
      const footerComp: LayoutComponent = {
        id: 'footer',
        position: 'footer',
        render: () => 'Footer Line' // 1 line
      };

      layoutManager.registerComponent(headerComp);
      layoutManager.registerComponent(footerComp);
      
      const result = layoutManager.renderLayout({ width: 80, height: 30 });
      
      // Header height = 2, Footer height = 1
      // Content height = 30 - 2 - 1 = 27
      expect(result.content.height).toBe(27);
      // Verify exact calculation (kill arithmetic mutations)
      expect(result.content.height).not.toBe(26); // 30 - 2 - 2
      expect(result.content.height).not.toBe(28); // 30 - 1 - 1
      expect(result.content.height).not.toBe(29); // 30 - 2 + 1
    });

    test('should calculate header Y position exactly', () => {
      const headerComp: LayoutComponent = {
        id: 'header',
        position: 'header',
        render: () => 'H1\nH2\nH3' // 3 lines
      };

      layoutManager.registerComponent(headerComp);
      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Content Y should start after header (3 lines)
      expect(result.content.y).toBe(3);
      // Kill arithmetic mutations
      expect(result.content.y).not.toBe(2);
      expect(result.content.y).not.toBe(4);
    });
  });

  describe('Array Method Mutations - Collection Operations', () => {
    test('should handle empty components map', () => {
      const headerComponents = layoutManager.getComponentsByPosition('header');
      
      expect(headerComponents).toEqual([]); // Exact empty array
      expect(headerComponents.length).toBe(0); // Exact zero length
    });

    test('should filter components by position - exact array operations', () => {
      const headerComp1: LayoutComponent = {
        id: 'h1',
        position: 'header',
        render: () => 'H1'
      };
      
      const headerComp2: LayoutComponent = {
        id: 'h2',
        position: 'header',
        render: () => 'H2'
      };
      
      const footerComp: LayoutComponent = {
        id: 'f1',
        position: 'footer',
        render: () => 'F1'
      };

      layoutManager.registerComponent(headerComp1);
      layoutManager.registerComponent(headerComp2);
      layoutManager.registerComponent(footerComp);

      const headerComponents = layoutManager.getComponentsByPosition('header');
      const footerComponents = layoutManager.getComponentsByPosition('footer');
      
      // Test exact array filtering
      expect(headerComponents.length).toBe(2); // Exactly 2, not 1 or 3
      expect(footerComponents.length).toBe(1); // Exactly 1, not 0 or 2
      
      // Verify exact component IDs
      const headerIds = headerComponents.map(c => c.id);
      expect(headerIds).toContain('h1');
      expect(headerIds).toContain('h2');
      expect(headerIds).not.toContain('f1');
    });

    test('should map components correctly - exact array transformation', () => {
      const comp1: LayoutComponent = {
        id: 'c1',
        position: 'header',
        render: () => 'Content1'
      };
      
      const comp2: LayoutComponent = {
        id: 'c2',
        position: 'header',
        render: () => 'Content2'
      };

      layoutManager.registerComponent(comp1);
      layoutManager.registerComponent(comp2);

      const result = layoutManager.renderLayout({ width: 80, height: 24 });
      
      // Test exact mapping and joining
      expect(result.header).toBe('Content1\nContent2');
      // Verify array operations worked correctly
      expect(result.header.split('\n')).toEqual(['Content1', 'Content2']);
    });

    test('should reduce height calculation correctly - exact array reduction', () => {
      const comp1: LayoutComponent = {
        id: 'c1',
        position: 'header',
        render: () => 'Line1\nLine2' // 2 lines
      };
      
      const comp2: LayoutComponent = {
        id: 'c2',
        position: 'header',
        render: () => 'Line3' // 1 line
      };

      layoutManager.registerComponent(comp1);
      layoutManager.registerComponent(comp2);

      const result = layoutManager.renderLayout({ width: 80, height: 20 });
      
      // Header height should be 2 + 1 = 3 lines
      // Content Y should be 3
      expect(result.content.y).toBe(3);
      // Content height should be 20 - 3 - 0 = 17
      expect(result.content.height).toBe(17);
    });
  });

  describe('Map Operations - Exact Key-Value Behavior', () => {
    test('should set and get components with exact key matching', () => {
      const component: LayoutComponent = {
        id: 'exact-key',
        position: 'header',
        render: () => 'Content'
      };

      layoutManager.registerComponent(component);
      
      // Test exact key retrieval
      const retrieved = layoutManager.getComponent('exact-key');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('exact-key');
      
      // Test non-matching key
      const notFound = layoutManager.getComponent('different-key');
      expect(notFound).toBeUndefined();
    });

    test('should delete components with exact key matching', () => {
      const component: LayoutComponent = {
        id: 'to-delete',
        position: 'header',
        render: () => 'Content'
      };

      layoutManager.registerComponent(component);
      expect(layoutManager.getComponent('to-delete')).toBeDefined();
      
      layoutManager.unregisterComponent('to-delete');
      expect(layoutManager.getComponent('to-delete')).toBeUndefined();
    });

    test('should clear all components - exact map clearing', () => {
      const comp1: LayoutComponent = { id: '1', position: 'header', render: () => 'H' };
      const comp2: LayoutComponent = { id: '2', position: 'footer', render: () => 'F' };

      layoutManager.registerComponent(comp1);
      layoutManager.registerComponent(comp2);
      
      expect(layoutManager.getStats().totalComponents).toBe(2);
      
      layoutManager.clear();
      expect(layoutManager.getStats().totalComponents).toBe(0);
      expect(layoutManager.getComponent('1')).toBeUndefined();
      expect(layoutManager.getComponent('2')).toBeUndefined();
    });
  });

  describe('Boundary Value Testing - Edge Cases', () => {
    test('should handle minimum dimensions - 1x1', () => {
      const result = layoutManager.renderLayout({ width: 1, height: 1 });
      
      expect(result.content.width).toBe(1);
      expect(result.content.height).toBe(1);
      expect(result.content.x).toBe(0);
      expect(result.content.y).toBe(0);
    });

    test('should handle zero dimensions', () => {
      const result = layoutManager.renderLayout({ width: 0, height: 0 });
      
      expect(result.content.width).toBe(0);
      expect(result.content.height).toBe(0);
    });

    test('should handle negative dimensions gracefully', () => {
      const result = layoutManager.renderLayout({ width: -10, height: -5 });
      
      expect(result.content.width).toBe(-10);
      expect(result.content.height).toBe(-5);
    });

    test('should handle large dimensions', () => {
      const result = layoutManager.renderLayout({ width: 1000, height: 500 });
      
      expect(result.content.width).toBe(1000);
      expect(result.content.height).toBe(500);
    });
  });

  describe('Optional Chaining and Null Safety Mutations', () => {
    test('should handle undefined currentView safely', () => {
      // No current view provided
      const result = layoutManager.renderLayout({ width: 80, height: 24, currentView: undefined });
      
      expect(result.content.content).toBe(''); // Should be empty string, not null/undefined
    });

    test('should handle currentView with render method', () => {
      const mockView: View = {
        id: 'test-view',
        title: 'Test',
        canGoBack: false,
        onMount: () => {},
        onUnmount: () => {},
        onResize: () => {},
        saveState: () => ({}),
        restoreState: () => {},
        render: () => 'View Content',
        getKeyBindings: () => []
      };
      
      const result = layoutManager.renderLayout({ width: 80, height: 24, currentView: mockView });
      
      expect(result.content.content).toBe('View Content');
    });

    test('should handle currentView with getKeyBindings returning empty array', () => {
      const mockView: View = {
        id: 'test-view',
        title: 'Test',
        canGoBack: false,
        onMount: () => {},
        onUnmount: () => {},
        onResize: () => {},
        saveState: () => ({}),
        restoreState: () => {},
        render: () => 'Content',
        getKeyBindings: () => []
      };
      
      const result = layoutManager.renderLayout({ width: 80, height: 24, currentView: mockView });
      
      expect(result.content.content).toBe('Content');
      // Should handle empty key bindings
      expect(() => {
        layoutManager.renderLayout({ width: 80, height: 24, currentView: mockView });
      }).not.toThrow();
    });
  });

  describe('Stats Method - Exact Counting', () => {
    test('should return exact component counts', () => {
      const headerComp: LayoutComponent = { id: '1', position: 'header', render: () => 'H' };
      const footerComp1: LayoutComponent = { id: '2', position: 'footer', render: () => 'F1' };
      const footerComp2: LayoutComponent = { id: '3', position: 'footer', render: () => 'F2' };
      const leftComp: LayoutComponent = { id: '4', position: 'sidebar-left', render: () => 'L' };

      layoutManager.registerComponent(headerComp);
      layoutManager.registerComponent(footerComp1);
      layoutManager.registerComponent(footerComp2);
      layoutManager.registerComponent(leftComp);

      const stats = layoutManager.getStats();
      
      expect(stats.totalComponents).toBe(4); // Exact count
      expect(stats.componentsByPosition.header).toBe(1); // Exact count
      expect(stats.componentsByPosition.footer).toBe(2); // Exact count
      expect(stats.componentsByPosition['sidebar-left']).toBe(1); // Exact count
      expect(stats.componentsByPosition['sidebar-right']).toBe(0); // Exact zero
    });

    test('should initialize component counts to exact zero', () => {
      const stats = layoutManager.getStats();
      
      expect(stats.totalComponents).toBe(0);
      expect(stats.componentsByPosition.header).toBe(0);
      expect(stats.componentsByPosition.footer).toBe(0);
      expect(stats.componentsByPosition['sidebar-left']).toBe(0);
      expect(stats.componentsByPosition['sidebar-right']).toBe(0);
    });
  });

  describe('Complex Scenario Testing', () => {
    test('should handle full layout with all positions', () => {
      const components: LayoutComponent[] = [
        { id: 'h1', position: 'header', render: () => 'Header 1\nHeader 2' },
        { id: 'f1', position: 'footer', render: () => 'Footer' },
        { id: 'sl', position: 'sidebar-left', render: () => 'Left\nSidebar' },
        { id: 'sr', position: 'sidebar-right', render: () => 'Right' }
      ];

      components.forEach(comp => layoutManager.registerComponent(comp));

      const mockView: View = {
        id: 'full-view',
        title: 'Full Layout',
        canGoBack: false,
        onMount: () => {},
        onUnmount: () => {},
        onResize: () => {},
        saveState: () => ({}),
        restoreState: () => {},
        render: () => 'Main Content Area',
        getKeyBindings: () => [{ key: 'q', description: 'Quit', action: () => {} }]
      };

      const result = layoutManager.renderLayout({ width: 120, height: 30, currentView: mockView });

      // Verify exact calculations
      expect(result.header).toBe('Header 1\nHeader 2');
      expect(result.footer).toBe('Footer');
      expect(result.sidebars.left).toBe('Left\nSidebar');
      expect(result.sidebars.right).toBe('Right');
      expect(result.content.content).toBe('Main Content Area');
      
      // Verify exact dimensions
      expect(result.content.x).toBe(20); // Left sidebar offset
      expect(result.content.y).toBe(2); // Header height (2 lines)
      expect(result.content.width).toBe(80); // 120 - 20 - 20
      expect(result.content.height).toBe(27); // 30 - 2 - 1
    });
  });
});