import { describe, expect, it, beforeEach, afterEach, spyOn } from 'bun:test';
import { SplitPaneLayout, SplitPaneLayoutConfig } from '../../src/layout/SplitPaneLayout';
import { LayoutDimensions } from '../../src/layout/SplitPaneLayoutDimensions';

// Test IDs: 2.5-UNIT-003, 2.5-UNIT-004, 2.5-UNIT-005, 2.5-UNIT-014
describe('SplitPaneLayout', () => {
  let splitPaneLayout: SplitPaneLayout;

  afterEach(async () => {
    if (splitPaneLayout) {
      await splitPaneLayout.onShutdown();
    }
  });

  describe('Layout Configuration (AC2)', () => {
    // Test ID: 2.5-UNIT-003 - SplitPaneLayout calculates dimensions correctly
    it('should calculate dimensions correctly with default 70/30 split', async () => {
      // Given: SplitPaneLayout with default configuration
      splitPaneLayout = new SplitPaneLayout(0.7); // 70/30 split
      await splitPaneLayout.onInitialize();

      // When: Layout dimensions are calculated for specific terminal size
      const terminalWidth = 100;
      const terminalHeight = 30;
      splitPaneLayout.resize(terminalWidth, terminalHeight);

      // Then: Dimensions should reflect 70/30 ratio
      const dimensions: LayoutDimensions = splitPaneLayout.getDimensions();

      expect(dimensions).toBeDefined();
      expect(dimensions.leftPanelWidth).toBeDefined();
      expect(dimensions.rightPanelWidth).toBeDefined();

      // Left panel should be approximately 70% (allowing for border)
      const expectedLeftWidth = Math.floor(terminalWidth * 0.7);
      expect(dimensions.leftPanelWidth).toBeCloseTo(expectedLeftWidth, 2);

      // Right panel should be approximately 30% (allowing for border)
      const expectedRightWidth = terminalWidth - dimensions.leftPanelWidth - 1; // -1 for border
      expect(dimensions.rightPanelWidth).toBeCloseTo(expectedRightWidth, 2);

      // Heights should match terminal height
      expect(dimensions.leftPanelHeight).toBe(terminalHeight);
      expect(dimensions.rightPanelHeight).toBe(terminalHeight);
    });

    it('should calculate dimensions correctly with custom ratios', async () => {
      // Given: SplitPaneLayout with custom ratio (60/40)
      splitPaneLayout = new SplitPaneLayout(0.6);
      await splitPaneLayout.onInitialize();

      // When: Layout is resized
      const terminalWidth = 120;
      const terminalHeight = 40;
      splitPaneLayout.resize(terminalWidth, terminalHeight);

      // Then: Dimensions should reflect 60/40 ratio
      const dimensions = splitPaneLayout.getDimensions();

      const expectedLeftWidth = Math.floor(terminalWidth * 0.6);
      expect(dimensions.leftPanelWidth).toBeCloseTo(expectedLeftWidth, 2);

      const totalPanelWidth = dimensions.leftPanelWidth + dimensions.rightPanelWidth;
      expect(totalPanelWidth).toBeLessThanOrEqual(terminalWidth);
    });

    it('should handle small terminal dimensions gracefully', async () => {
      // Given: SplitPaneLayout with minimum viable terminal size
      splitPaneLayout = new SplitPaneLayout(0.7);
      await splitPaneLayout.onInitialize();

      // When: Very small terminal dimensions are set
      const minWidth = 20;
      const minHeight = 5;
      splitPaneLayout.resize(minWidth, minHeight);

      // Then: Layout should still provide valid dimensions
      const dimensions = splitPaneLayout.getDimensions();

      expect(dimensions.leftPanelWidth).toBeGreaterThan(0);
      expect(dimensions.rightPanelWidth).toBeGreaterThan(0);
      expect(dimensions.leftPanelHeight).toBe(minHeight);
      expect(dimensions.rightPanelHeight).toBe(minHeight);
    });
  });

  describe('Ratio Validation (AC2)', () => {
    // Test ID: 2.5-UNIT-004 - Layout ratio validation (0.0 to 1.0)
    it('should validate ratio within 0.0 to 1.0 range', async () => {
      // Given: SplitPaneLayout with valid ratio
      splitPaneLayout = new SplitPaneLayout(0.5);
      await splitPaneLayout.onInitialize();

      // When: Valid ratios are set
      const validRatios = [0.1, 0.3, 0.5, 0.7, 0.9];

      for (const ratio of validRatios) {
        splitPaneLayout.setSplitRatio(ratio);

        // Then: Ratio should be accepted and applied
        const config = splitPaneLayout.getConfig();
        expect(config.splitRatio).toBeCloseTo(ratio, 2);
      }
    });

    it('should handle boundary values correctly', async () => {
      // Given: SplitPaneLayout with extreme ratios (5/95, 95/5)
      splitPaneLayout = new SplitPaneLayout(0.05); // 5/95 split
      await splitPaneLayout.onInitialize();

      // When: Layout dimensions are calculated with extreme ratio
      splitPaneLayout.resize(100, 30);

      // Then: Minimum pane sizes should be enforced
      const dimensions = splitPaneLayout.getDimensions();
      const config = splitPaneLayout.getConfig();

      expect(dimensions.leftPanelWidth).toBeGreaterThanOrEqual(config.minPanelWidth);
      expect(dimensions.rightPanelWidth).toBeGreaterThanOrEqual(config.minPanelWidth);

      // Test other extreme
      splitPaneLayout.setSplitRatio(0.95); // 95/5 split
      splitPaneLayout.resize(100, 30);

      const extremeDimensions = splitPaneLayout.getDimensions();
      expect(extremeDimensions.leftPanelWidth).toBeGreaterThanOrEqual(config.minPanelWidth);
      expect(extremeDimensions.rightPanelWidth).toBeGreaterThanOrEqual(config.minPanelWidth);
    });

    it('should clamp invalid ratios to valid range', async () => {
      // Given: SplitPaneLayout
      splitPaneLayout = new SplitPaneLayout(0.7);
      await splitPaneLayout.onInitialize();

      // When: Invalid ratios are attempted
      const invalidRatios = [-0.1, 1.1, 2.0, -1.0];

      for (const invalidRatio of invalidRatios) {
        splitPaneLayout.setSplitRatio(invalidRatio);

        // Then: Ratio should be clamped to valid range
        const config = splitPaneLayout.getConfig();
        expect(config.splitRatio).toBeGreaterThanOrEqual(0.0);
        expect(config.splitRatio).toBeLessThanOrEqual(1.0);
      }
    });

    it('should maintain consistency across ratio changes', async () => {
      // Given: SplitPaneLayout with established dimensions
      splitPaneLayout = new SplitPaneLayout(0.5);
      await splitPaneLayout.onInitialize();
      splitPaneLayout.resize(100, 30);

      const initialDimensions = splitPaneLayout.getDimensions();
      const totalInitialWidth = initialDimensions.leftPanelWidth + initialDimensions.rightPanelWidth;

      // When: Ratio is changed
      splitPaneLayout.setSplitRatio(0.8);

      // Then: Total panel width should remain consistent (accounting for borders)
      const newDimensions = splitPaneLayout.getDimensions();
      const totalNewWidth = newDimensions.leftPanelWidth + newDimensions.rightPanelWidth;

      expect(totalNewWidth).toBeCloseTo(totalInitialWidth, 1);
    });
  });

  describe('Panel State Management (AC2)', () => {
    // Test ID: 2.5-UNIT-005 - Panel state management
    beforeEach(async () => {
      splitPaneLayout = new SplitPaneLayout(0.7);
      await splitPaneLayout.onInitialize();
    });

    it('should manage panel state correctly', () => {
      // Given: SplitPaneLayout with initialized panels
      // When: Panel content is set
      splitPaneLayout.updateLeftPanelContent(['Left panel line']);
      splitPaneLayout.updateRightPanelContent(['Right panel line']);

      // Then: Panel content should be retrievable
      const leftContent = splitPaneLayout.getLeftPanelContent();
      const rightContent = splitPaneLayout.getRightPanelContent();

      expect(leftContent).toEqual(['Left panel line']);
      expect(rightContent).toEqual(['Right panel line']);
    });

    it('should persist panel states across resizes', () => {
      // Given: SplitPaneLayout with content in panels
      splitPaneLayout.updateLeftPanelContent(['Line 1', 'Line 2']);
      splitPaneLayout.updateRightPanelContent(['Right Line 1']);

      // When: Layout is resized
      splitPaneLayout.resize(150, 40);

      // Then: Panel content should be preserved
      expect(splitPaneLayout.getLeftPanelContent()).toEqual(['Line 1', 'Line 2']);
      expect(splitPaneLayout.getRightPanelContent()).toEqual(['Right Line 1']);
    });

    it('should handle panel focus states', () => {
      // Given: SplitPaneLayout with focusable panels
      // When: Focus is set on left panel
      splitPaneLayout.setFocusedPanel('left');

      // Then: Left panel should be focused
      expect(splitPaneLayout.getFocusedPanel()).toBe('left');

      // When: Focus is switched to right panel
      splitPaneLayout.setFocusedPanel('right');

      // Then: Right panel should be focused
      expect(splitPaneLayout.getFocusedPanel()).toBe('right');
    });

    it('should handle panel content updates', () => {
      // Given: SplitPaneLayout with initial content
      splitPaneLayout.updateLeftPanelContent(['Initial']);
      splitPaneLayout.updateRightPanelContent(['Initial Right']);

      // When: Panel content is updated
      splitPaneLayout.updateLeftPanelContent(['Updated']);
      splitPaneLayout.updateRightPanelContent(['Updated Right']);

      // Then: New content should be reflected
      expect(splitPaneLayout.getLeftPanelContent()).toEqual(['Updated']);
      expect(splitPaneLayout.getRightPanelContent()).toEqual(['Updated Right']);
    });
  });

  describe('Resize Handling (AC6)', () => {
    // Test ID: 2.5-UNIT-014 - Layout resize calculation under 50ms
    beforeEach(async () => {
      splitPaneLayout = new SplitPaneLayout(0.7);
      await splitPaneLayout.onInitialize();
    });

    it('should complete resize operations within 50ms', () => {
      // Given: SplitPaneLayout ready for resize operations
      const testSizes = [
        { width: 80, height: 24 },
        { width: 120, height: 40 },
        { width: 200, height: 60 },
        { width: 300, height: 80 },
      ];

      // When: Multiple resize operations are performed
      for (const size of testSizes) {
        const startTime = performance.now();

        splitPaneLayout.resize(size.width, size.height);

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Then: Each resize should complete within performance budget
        expect(duration).toBeLessThan(50); // <50ms requirement
      }
    });

    it('should handle rapid resize events efficiently', () => {
      // Given: SplitPaneLayout that may receive rapid resize events
      const resizeStartTime = performance.now();

      // When: Rapid resize events occur (simulating terminal resize)
      for (let i = 0; i < 10; i++) {
        const width = 80 + i * 5;
        const height = 24 + i * 2;
        splitPaneLayout.resize(width, height);
      }

      const resizeEndTime = performance.now();
      const totalDuration = resizeEndTime - resizeStartTime;

      // Then: All resizes should complete efficiently
      expect(totalDuration).toBeLessThan(100); // Total time for 10 resizes

      // Verify final state is correct
      const finalDimensions = splitPaneLayout.getDimensions();
      expect(finalDimensions).toBeDefined();
    });

    it('should not resize unnecessarily when dimensions unchanged', () => {
      // Given: SplitPaneLayout with established dimensions
      splitPaneLayout.resize(100, 30);
      const initialDimensions = splitPaneLayout.getDimensions();

      // When: Same dimensions are set again
      const startTime = performance.now();
      splitPaneLayout.resize(100, 30);
      const endTime = performance.now();

      // Then: Operation should be very fast (optimized away)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5); // Should be near-instant

      // Dimensions should remain unchanged
      const unchangedDimensions = splitPaneLayout.getDimensions();
      expect(unchangedDimensions).toEqual(initialDimensions);
    });

    it('should handle reflow marking correctly', () => {
      // Given: SplitPaneLayout tracking reflow needs
      splitPaneLayout.resize(100, 30);

      // When: Resize triggers reflow need
      splitPaneLayout.resize(120, 30);

      // Then: Reflow should be marked as needed
      expect(splitPaneLayout.needsLayoutReflow()).toBe(true);

      // When: Content is rendered (which processes reflow)
      splitPaneLayout.render(['left content'], ['right content']);

      // Then: Reflow flag should be cleared
      expect(splitPaneLayout.needsLayoutReflow()).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should provide access to current configuration', async () => {
      // Given: SplitPaneLayout with specific configuration
      splitPaneLayout = new SplitPaneLayout(0.6);
      await splitPaneLayout.onInitialize();

      // When: Configuration is requested
      const config = splitPaneLayout.getConfig();

      // Then: Configuration should reflect initialization values
      expect(config.splitRatio).toBe(0.6);
      expect(config.minPanelWidth).toBeGreaterThan(0);
      expect(typeof config.resizable).toBe('boolean');
    });

    it('should update configuration dynamically', async () => {
      // Given: SplitPaneLayout with initial configuration
      splitPaneLayout = new SplitPaneLayout(0.5);
      await splitPaneLayout.onInitialize();

      const newConfig: Partial<SplitPaneLayoutConfig> = {
        splitRatio: 0.8,
        minPanelWidth: 15,
        borderColor: 'blue',
        focusColor: 'yellow',
      };

      // When: Configuration is updated
      splitPaneLayout.updateConfig(newConfig);

      // Then: Configuration should reflect changes
      const updatedConfig = splitPaneLayout.getConfig();
      expect(updatedConfig.splitRatio).toBe(0.8);
      expect(updatedConfig.minPanelWidth).toBe(15);
      expect(updatedConfig.borderColor).toBe('blue');
      expect(updatedConfig.focusColor).toBe('yellow');
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize correctly', async () => {
      // Given: SplitPaneLayout in uninitialized state
      splitPaneLayout = new SplitPaneLayout(0.7);

      // When: Initialization occurs
      await splitPaneLayout.onInitialize();

      // Then: Layout should be ready for use
      expect(() => splitPaneLayout.resize(100, 30)).not.toThrow();
      expect(splitPaneLayout.getDimensions()).toBeDefined();
    });

    it('should shutdown gracefully', async () => {
      // Given: SplitPaneLayout in initialized state
      splitPaneLayout = new SplitPaneLayout(0.7);
      await splitPaneLayout.onInitialize();
      splitPaneLayout.resize(100, 30);

      // When: Shutdown occurs
      await splitPaneLayout.onShutdown();

      // Then: Resources should be cleaned up
      expect(splitPaneLayout.needsLayoutReflow()).toBe(false);
    });

    it('should register with lifecycle manager', () => {
      // Given: SplitPaneLayout and mock lifecycle manager
      splitPaneLayout = new SplitPaneLayout(0.7);

      const registerHooksSpy = {
        registerHooks: (_: any) => {},
      };
      const mockLifecycleManager = {
        registerHooks: spyOn(registerHooksSpy, 'registerHooks'),
      };

      // When: Hooks are registered
      splitPaneLayout.registerHooks(mockLifecycleManager as any);

      // Then: SplitPaneLayout should register itself
      expect(mockLifecycleManager.registerHooks).toHaveBeenCalledWith(splitPaneLayout);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      splitPaneLayout = new SplitPaneLayout(0.7);
      await splitPaneLayout.onInitialize();
    });

    it('should handle invalid dimensions gracefully', () => {
      // Given: SplitPaneLayout ready for operations
      // When: Invalid dimensions are provided
      const invalidDimensions = [
        { width: -10, height: 30 },
        { width: 100, height: -5 },
        { width: 0, height: 0 },
      ];

      for (const { width, height } of invalidDimensions) {
        // Then: Should handle gracefully without throwing
        expect(() => splitPaneLayout.resize(width, height)).not.toThrow();
      }
    });

    it('should handle concurrent resize operations', () => {
      // Given: SplitPaneLayout that may receive concurrent operations
      const resizePromises = [];

      // When: Multiple concurrent resize operations occur
      for (let i = 0; i < 5; i++) {
        resizePromises.push(
          new Promise<void>((resolve) => {
            splitPaneLayout.resize(100 + i * 10, 30);
            resolve();
          })
        );
      }

      // Then: All operations should complete without conflicts
      return Promise.all(resizePromises).then(() => {
        expect(splitPaneLayout.getDimensions()).toBeDefined();
      });
    });
  });
});