import {
  KeyBindingManager,
  KeyEvent,
  KeyModifiers,
  KeyBinding,
  KeyBindingOptions
} from './helpers/KeyBindingManager.js';
import { KeyMetricsTracker } from './helpers/KeyMetricsTracker.js';
import { ControlCharacterParser } from './keyboard/ControlCharacterParser.js';
import { EscapeSequenceParser } from './keyboard/EscapeSequenceParser.js';

export { KeyEvent, KeyModifiers, KeyBinding, KeyBindingOptions };

export interface KeySequence {
  keys: string[];
  timeout: number;
  startTime: number;
  onComplete: (sequence: string[]) => void;
  onTimeout: () => void;
}

export class KeyboardHandler {
  private bindingManager: KeyBindingManager;
  private metricsTracker: KeyMetricsTracker;
  private eventHandlers = new Map<string, Set<Function>>();

  private sequenceBuffer: string[] = [];
  private activeSequence: KeySequence | null = null;
  private sequenceTimeout = 1000;
  private inputBuffer: Buffer[] = [];
  private processingInput = false;

  constructor() {
    this.bindingManager = new KeyBindingManager();
    this.metricsTracker = new KeyMetricsTracker();
    this.setupDefaultBindings();
  }

  public handleInput(input: Buffer): void {
    this.inputBuffer.push(input);

    if (!this.processingInput) {
      this.processInputBuffer();
    }
  }

  private async processInputBuffer(): Promise<void> {
    this.processingInput = true;

    while (this.inputBuffer.length > 0) {
      const buffer = this.inputBuffer.shift();
      if (buffer != null) {
        await this.processInput(buffer);
      }
    }

    this.processingInput = false;
  }

  private async processInput(input: Buffer): Promise<void> {
    const inputString = input.toString();

    for (let i = 0; i < inputString.length; i++) {
      const keyEvent = this.createKeyEvent(inputString, i);

      if (keyEvent != null) {
        this.metricsTracker.recordKeyEvent(keyEvent);

        const handled = await this.handleKeyEvent(keyEvent);

        if (this.activeSequence != null) {
          this.handleKeySequence(keyEvent);
        }

        this.emit('keyEvent', { keyEvent, handled });
      }
    }
  }

  private createKeyEvent(input: string, index: number): KeyEvent | null {
    const keyEvent: KeyEvent = {
      key: '',
      modifiers: {},
      timestamp: Date.now(),
      meta: {}
    };

    // Handle escape sequences
    if (input.charCodeAt(index) === 27) {
      return this.parseEscapeSequence(input.substring(index), keyEvent);
    }

    // Handle control characters
    if (input.charCodeAt(index) < 32 || input.charCodeAt(index) === 127) {
      return this.parseControlCharacter(input.substring(index), keyEvent);
    }

    // Regular character
    keyEvent.key = input[index];
    return keyEvent;
  }

  private parseEscapeSequence(input: string, keyEvent: KeyEvent): KeyEvent {
    const result = EscapeSequenceParser.parse(input);

    if (result != null) {
      Object.assign(keyEvent, result);
    } else {
      keyEvent.key = 'escape';
    }

    return keyEvent;
  }

  private parseControlCharacter(input: string, keyEvent: KeyEvent): KeyEvent {
    const code = input.charCodeAt(0);
    const controlChar = ControlCharacterParser.parse(code);

    if (controlChar != null) {
      keyEvent.key = controlChar.key.replace(/^ctrl\+/, '');
      if (controlChar.ctrl) {
        keyEvent.modifiers = { ...keyEvent.modifiers, ctrl: true };
      }
    } else {
      keyEvent.key = String.fromCharCode(code);
      keyEvent.meta = { controlCode: code };
    }

    return keyEvent;
  }

  private async handleKeyEvent(keyEvent: KeyEvent): Promise<boolean> {
    const bindings = this.bindingManager.getPotentialBindings(keyEvent);
    let handled = false;

    for (const binding of bindings) {
      if (this.bindingManager.matchesBinding(keyEvent, binding)) {
        try {
          await binding.handler(keyEvent);
          handled = true;
          this.emit('keyHandled', { keyEvent, binding });
          break;
        } catch (error) {
          this.emit('bindingError', { error, keyEvent, binding });
        }
      }
    }

    return handled;
  }

  private handleKeySequence(keyEvent: KeyEvent): void {
    if (this.activeSequence == null) return;

    this.sequenceBuffer.push(keyEvent.key || '');

    if (this.sequenceBuffer.length >= this.activeSequence.keys.length) {
      const isMatch = this.activeSequence.keys.every(
        (key, index) => key === this.sequenceBuffer[index]
      );

      if (isMatch) {
        this.activeSequence.onComplete([...this.sequenceBuffer]);
        this.metricsTracker.completeSequence();
      }

      this.clearActiveSequence();
    }
  }

  private setupDefaultBindings(): void {
    this.bind('ctrl+c', () => this.emit('interrupt'),
      { description: 'Send interrupt signal', priority: 100 });

    this.bind('ctrl+d', () => this.emit('eof'),
      { description: 'End of file', priority: 100 });

    this.bind('ctrl+z', () => this.emit('suspend'),
      { description: 'Suspend process', priority: 100 });
  }

  public bind(
    keys: string,
    handler: (event: KeyEvent) => void | Promise<void>,
    options: KeyBindingOptions = {}
  ): string {
    const binding = this.bindingManager.createBinding(keys, handler, options);
    this.bindingManager.addBinding(binding, options.global === true);
    this.emit('bindingAdded', { binding });
    return binding.id;
  }

  public unbind(id: string): boolean {
    const removed = this.bindingManager.removeBinding(id);
    if (removed) {
      this.emit('bindingRemoved', { id });
    }
    return removed;
  }

  public startSequence(
    keys: string[],
    onComplete: (sequence: string[]) => void,
    onTimeout: () => void = () => {},
    timeout: number = this.sequenceTimeout
  ): void {
    this.clearActiveSequence();

    this.activeSequence = {
      keys,
      timeout,
      startTime: Date.now(),
      onComplete,
      onTimeout
    };

    this.sequenceBuffer = [];
    this.metricsTracker.startSequence(keys.join('+'));

    setTimeout(() => {
      if (this.activeSequence != null) {
        this.activeSequence.onTimeout();
        this.metricsTracker.cancelSequence();
        this.clearActiveSequence();
      }
    }, timeout);
  }

  private clearActiveSequence(): void {
    this.activeSequence = null;
    this.sequenceBuffer = [];
  }

  public getMetrics() {
    return {
      session: this.metricsTracker.getSessionMetrics(),
      bindings: this.bindingManager.getBindingCount(),
      mostUsed: this.metricsTracker.getMostUsedKeys(),
      typingSpeed: this.metricsTracker.getTypingSpeed(),
      activeSequence: this.metricsTracker.getActiveSequence()
    };
  }

  public getAllBindings(): KeyBinding[] {
    return this.bindingManager.getAllBindings();
  }

  public enableBinding(id: string): boolean {
    return this.bindingManager.enableBinding(id);
  }

  public disableBinding(id: string): boolean {
    return this.bindingManager.disableBinding(id);
  }

  public clearBindings(): void {
    this.bindingManager.clear();
    this.setupDefaultBindings();
  }

  public destroy(): void {
    this.clearActiveSequence();
    this.bindingManager.clear();
    this.metricsTracker.clear();
    this.eventHandlers.clear();
    this.inputBuffer = [];
    this.emit('destroyed');
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in keyboard handler event '${event}':`, error);
        }
      });
    }
  }
}