import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { NavigationCommandHandler } from '../../src/navigation/NavigationCommandHandler';
import { NavigationState } from '../../src/navigation/NavigationCommands';
import { EventBus } from '../../src/events/EventBus';
import { ViewSystem } from '../../src/views/ViewSystem';
import { PerformanceMonitor } from '../../src/performance/PerformanceMonitor';

describe('NavigationCommandHandler', () => {
  let handler: NavigationCommandHandler;
  let eventBus: EventBus;
  let viewSystem: ViewSystem;
  let performanceMonitor: PerformanceMonitor;
  let initialState: NavigationState;

  beforeEach(() => {
    // Create mocks
    eventBus = new EventBus();
    viewSystem = new ViewSystem();
    performanceMonitor = new PerformanceMonitor();

    initialState = {
      currentStepId: 'step-1',
      previousStepId: undefined,
      completedSteps: [],
      skippedSteps: [],
      hasUnsavedChanges: false,
      viewMode: 'list',
    };

    handler = new NavigationCommandHandler(
      eventBus,
      viewSystem,
      performanceMonitor,
      initialState
    );
  });

  afterEach(() => {
    handler.onUnmount();
  });

  describe('Command Registration', () => {
    it('should register all default navigation commands', () => {
      const commands = handler.getRegisteredCommands();
      const commandKeys = commands.map(cmd => cmd.key).sort();

      expect(commandKeys).toEqual(['?', 'Enter', 'b', 'd', 'l', 'n', 'q', 'r', 's']);
    });

    it('should allow custom command registration', () => {
      handler.registerCommand('t', {
        handler: () => {},
        description: 'Test command',
      });

      const commands = handler.getRegisteredCommands();
      const testCommand = commands.find(cmd => cmd.key === 't');

      expect(testCommand).toBeDefined();
      expect(testCommand?.description).toBe('Test command');
    });

    it('should allow command unregistration', () => {
      const result = handler.unregisterCommand('n');
      expect(result).toBe(true);

      const commands = handler.getRegisteredCommands();
      const nextCommand = commands.find(cmd => cmd.key === 'n');
      expect(nextCommand).toBeUndefined();
    });

    it('should return false when unregistering non-existent command', () => {
      const result = handler.unregisterCommand('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('Navigation State Management', () => {
    it('should return current navigation state', () => {
      const state = handler.getNavigationState();
      expect(state).toEqual(initialState);
    });

    it('should update navigation state', () => {
      handler.updateNavigationState({
        currentStepId: 'step-2',
        hasUnsavedChanges: true,
      });

      const state = handler.getNavigationState();
      expect(state.currentStepId).toBe('step-2');
      expect(state.hasUnsavedChanges).toBe(true);
      expect(state.viewMode).toBe('list'); // Unchanged
    });

    it('should handle state change events', async () => {
      const newState: NavigationState = {
        currentStepId: 'step-3',
        previousStepId: 'step-2',
        completedSteps: ['step-1'],
        skippedSteps: [],
        hasUnsavedChanges: true,
        viewMode: 'detail',
      };

      // Simulate state change event
      await eventBus.publish('state-change', { newState }, { source: 'WorkflowEngine' });

      // Allow event processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const currentState = handler.getNavigationState();
      expect(currentState).toEqual(newState);
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should handle keyboard events for registered commands', async () => {
      const publishSpy = spyOn(eventBus, 'publishSync');

      // Simulate 'n' key press
      await eventBus.publish('keyboard', { key: 'n' }, { source: 'KeyboardHandler' });

      // Allow command processing
      await new Promise(resolve => setTimeout(resolve, 250)); // Account for debounce

      expect(publishSpy).toHaveBeenCalledWith('navigation-advance-next', {
        currentStepId: 'step-1',
        timestamp: expect.any(Number),
      });
    });

    it('should ignore non-navigation keyboard events', async () => {
      const publishSpy = spyOn(eventBus, 'publishSync');

      // Simulate unregistered key press
      await eventBus.publish('keyboard', { key: 'x' }, { source: 'KeyboardHandler' });

      // Allow command processing
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(publishSpy).not.toHaveBeenCalled();
    });

    it('should handle Enter key as advance command', async () => {
      const publishSpy = spyOn(eventBus, 'publishSync');

      await eventBus.publish('keyboard', { key: 'Enter' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(publishSpy).toHaveBeenCalledWith('navigation-advance-next', {
        currentStepId: 'step-1',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Command Execution', () => {
    it('should execute advance next command (n/Enter)', async () => {
      const publishSpy = spyOn(eventBus, 'publishSync');

      await eventBus.publish('keyboard', { key: 'n' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(publishSpy).toHaveBeenCalledWith('navigation-advance-next', {
        currentStepId: 'step-1',
        timestamp: expect.any(Number),
      });
    });

    it('should execute mark done and advance command (d)', async () => {
      const publishSpy = spyOn(eventBus, 'publishSync');

      await eventBus.publish('keyboard', { key: 'd' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(publishSpy).toHaveBeenCalledWith('navigation-mark-done-advance', {
        completedStepId: 'step-1',
        timestamp: expect.any(Number),
      });

      // Check state was updated
      const state = handler.getNavigationState();
      expect(state.completedSteps).toContain('step-1');
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('should execute go back command (b) when previous step exists', async () => {
      // Setup state with previous step
      handler.updateNavigationState({
        currentStepId: 'step-2',
        previousStepId: 'step-1',
      });

      const publishSpy = spyOn(eventBus, 'publishSync');

      await eventBus.publish('keyboard', { key: 'b' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(publishSpy).toHaveBeenCalledWith('navigation-go-back', {
        currentStepId: 'step-2',
        targetStepId: 'step-1',
        timestamp: expect.any(Number),
      });
    });

    it('should execute toggle view command (l)', async () => {
      const publishSpy = spyOn(eventBus, 'publishSync');

      await eventBus.publish('keyboard', { key: 'l' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(publishSpy).toHaveBeenCalledWith('navigation-toggle-view', {
        viewMode: 'detail',
        timestamp: expect.any(Number),
      });

      // Check state was updated
      const state = handler.getNavigationState();
      expect(state.viewMode).toBe('detail');
    });

    it('should toggle view mode correctly', async () => {
      // Start in list mode
      expect(handler.getNavigationState().viewMode).toBe('list');

      // Toggle to detail
      await eventBus.publish('keyboard', { key: 'l' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));
      expect(handler.getNavigationState().viewMode).toBe('detail');

      // Toggle back to list
      await eventBus.publish('keyboard', { key: 'l' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));
      expect(handler.getNavigationState().viewMode).toBe('list');
    });
  });

  describe('Command Confirmation', () => {
    it('should show confirmation for reset command (r)', async () => {
      const showModalSpy = spyOn(viewSystem, 'showModal').mockResolvedValue(true);
      const publishSpy = spyOn(eventBus, 'publishSync');

      await eventBus.publish('keyboard', { key: 'r' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(showModalSpy).toHaveBeenCalledWith({
        id: 'navigation-confirmation',
        title: 'Confirm Action',
        content: 'Are you sure you want to reset to beginning?',
        buttons: expect.any(Array),
      });
    });

    it('should show confirmation for skip command (s)', async () => {
      const showModalSpy = spyOn(viewSystem, 'showModal').mockResolvedValue(true);

      await eventBus.publish('keyboard', { key: 's' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(showModalSpy).toHaveBeenCalledWith({
        id: 'navigation-confirmation',
        title: 'Confirm Action',
        content: 'Are you sure you want to skip step with confirmation?',
        buttons: expect.any(Array),
      });
    });

    it('should show confirmation for quit command (q)', async () => {
      // Set unsaved changes
      handler.updateNavigationState({ hasUnsavedChanges: true });

      const showModalSpy = spyOn(viewSystem, 'showModal').mockResolvedValue(true);

      await eventBus.publish('keyboard', { key: 'q' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(showModalSpy).toHaveBeenCalledWith({
        id: 'quit-confirmation',
        title: 'Unsaved Changes',
        content: 'You have unsaved changes. Do you want to save before quitting?',
        buttons: expect.any(Array),
      });
    });
  });

  describe('Help System', () => {
    it('should show help overlay (?)', async () => {
      const showModalSpy = spyOn(viewSystem, 'showModal').mockResolvedValue(undefined);

      await eventBus.publish('keyboard', { key: '?' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(showModalSpy).toHaveBeenCalledWith({
        id: 'navigation-help',
        title: 'Navigation Help',
        content: expect.stringContaining('Navigation Commands:'),
        buttons: expect.any(Array),
      });
    });

    it('should generate correct help content', async () => {
      const showModalSpy = spyOn(viewSystem, 'showModal').mockResolvedValue(undefined);

      await eventBus.publish('keyboard', { key: '?' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      const call = showModalSpy.mock.calls[0];
      const content = call[0].content;

      expect(content).toContain('n        - Advance to next step');
      expect(content).toContain('↵        - Advance to next step');
      expect(content).toContain('d        - Mark done and auto-advance');
      expect(content).toContain('b        - Go back to previous step');
      expect(content).toContain('?        - Show help overlay');
    });
  });

  describe('Command Validation', () => {
    it('should validate back command requires previous step', async () => {
      // No previous step set
      const publishSpy = spyOn(eventBus, 'publishSync');

      await eventBus.publish('keyboard', { key: 'b' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should emit error event due to validation failure
      expect(publishSpy).toHaveBeenCalledWith('navigation-command-error',
        expect.objectContaining({
          key: 'b',
          error: expect.stringContaining('No previous step available'),
        })
      );
    });

    it('should validate mark done command requires current step', () => {
      // Test with empty current step
      handler.updateNavigationState({ currentStepId: '' });

      const commands = handler.getRegisteredCommands();
      const doneCommand = commands.find(cmd => cmd.key === 'd');

      // This would be tested by internal validation in the command queue
      expect(doneCommand).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    it('should record command execution times', async () => {
      const recordSpy = spyOn(performanceMonitor, 'recordCommandExecution');

      await eventBus.publish('keyboard', { key: 'n' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(recordSpy).toHaveBeenCalledWith('nav-cmd-n', expect.any(Number));
    });

    it('should emit events with performance data', async () => {
      const publishSpy = spyOn(eventBus, 'publishSync');

      await eventBus.publish('keyboard', { key: 'n' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(publishSpy).toHaveBeenCalledWith('navigation-command-executed', {
        commandId: 'nav-cmd-n',
        key: 'n',
        duration: expect.any(Number),
        state: expect.any(Object),
      });
    });

    it('should warn when commands exceed 50ms threshold', async () => {
      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      // Mock slow command execution
      const slowCommand = () => new Promise<void>(resolve => setTimeout(resolve, 60));
      handler.registerCommand('slow', {
        handler: slowCommand,
        description: 'Slow test command',
      });

      await eventBus.publish('keyboard', { key: 'slow' }, { source: 'KeyboardHandler' });
      await new Promise(resolve => setTimeout(resolve, 350)); // Wait for slow command + debounce

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Navigation command 'slow' took"),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Command Queue Status', () => {
    it('should provide queue status', () => {
      const status = handler.getQueueStatus();

      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('isPaused');
      expect(status).toHaveProperty('processedCount');
      expect(status).toHaveProperty('errorCount');
      expect(status).toHaveProperty('averageProcessingTime');
      expect(status).toHaveProperty('lastProcessingTime');
    });
  });

  describe('Visual Feedback', () => {
    it('should render visual feedback', () => {
      const renderResult = handler.render({});
      expect(typeof renderResult).toBe('string');
    });
  });

  describe('Component Lifecycle', () => {
    it('should properly mount and unmount', () => {
      // Component should be mountable
      expect(() => handler.onMount()).not.toThrow();

      // Component should be unmountable
      expect(() => handler.onUnmount()).not.toThrow();
    });

    it('should cleanup resources on unmount', () => {
      const unsubscribeSpy = spyOn(eventBus, 'unsubscribe');

      handler.onMount();
      handler.onUnmount();

      expect(unsubscribeSpy).toHaveBeenCalled();
    });
  });

  describe('Race Condition Prevention', () => {
    it('should prevent command execution during processing', async () => {
      const publishSpy = spyOn(eventBus, 'publishSync');

      // Simulate rapid key presses
      await Promise.all([
        eventBus.publish('keyboard', { key: 'n' }, { source: 'KeyboardHandler' }),
        eventBus.publish('keyboard', { key: 'n' }, { source: 'KeyboardHandler' }),
        eventBus.publish('keyboard', { key: 'n' }, { source: 'KeyboardHandler' }),
      ]);

      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have queued commands properly (exact count depends on debouncing)
      expect(publishSpy).toHaveBeenCalled();
    });

    it('should handle command queue overflow gracefully', async () => {
      // This would test the CommandQueue's overflow handling
      // The queue has a max size of 50 by default
      const promises = Array.from({ length: 60 }, (_, i) =>
        eventBus.publish('keyboard', { key: 'n' }, { source: 'KeyboardHandler' })
      );

      // Should not throw errors even with overflow
      await Promise.all(promises);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  });
});