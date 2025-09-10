export interface KeyEvent {
  type: 'key' | 'sequence' | 'mouse';
  key?: string;
  sequence?: string;
  raw: string;
  modifiers: KeyModifiers;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface KeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface KeyBinding {
  id: string;
  keys: string;
  handler: (event: KeyEvent) => void | Promise<void>;
  description?: string;
  scope?: string;
  priority?: number;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface KeySequence {
  keys: string[];
  timeout: number;
  startTime: number;
  onComplete: (sequence: string[]) => void;
  onTimeout: () => void;
}

export class KeyboardHandler {
  private bindings = new Map<string, KeyBinding[]>();
  private globalBindings: KeyBinding[] = [];
  private eventHandlers = new Map<string, Set<Function>>();
  private keyHistory: KeyEvent[] = [];
  private maxHistorySize = 200;
  private sequenceBuffer: string[] = [];
  private activeSequence: KeySequence | null = null;
  private sequenceTimeout = 1000; // 1 second
  private inputBuffer: Buffer[] = [];
  private processingInput = false;
  private paused = false;
  private keyMetrics = new Map<string, KeyMetrics>();

  constructor() {
    this.setupInputProcessing();
    this.setupDefaultBindings();
  }

  private setupInputProcessing(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', (data: Buffer) => {
        if (this.paused) return;

        this.inputBuffer.push(data);
        if (!this.processingInput) {
          this.processInputBuffer();
        }
      });
    }
  }

  private async processInputBuffer(): Promise<void> {
    if (this.processingInput) return;
    this.processingInput = true;

    try {
      while (this.inputBuffer.length > 0) {
        const data = this.inputBuffer.shift();
        if (data == null) break;
        await this.processInput(data);
      }
    } finally {
      this.processingInput = false;
    }
  }

  private async processInput(data: Buffer): Promise<void> {
    const input = data.toString();
    const keyEvent = this.parseInput(input);

    this.recordKeyEvent(keyEvent);
    this.updateKeyMetrics(keyEvent);

    try {
      // Handle key sequences first
      if (this.activeSequence) {
        this.handleSequenceInput(keyEvent);
        return;
      }

      // Process key bindings
      const handled = await this.processKeyBindings(keyEvent);

      if (!handled) {
        this.emit('unhandledKey', keyEvent);
      }
    } catch (error) {
      this.emit('keyHandlingError', { error, keyEvent });
    }
  }

  private parseInput(input: string): KeyEvent {
    const keyEvent: KeyEvent = {
      type: 'key',
      raw: input,
      modifiers: {},
      timestamp: Date.now(),
    };

    // Handle ANSI escape sequences
    if (input.startsWith('\x1b')) {
      keyEvent.type = 'sequence';
      return this.parseEscapeSequence(input, keyEvent);
    }

    // Handle control characters
    if (input.charCodeAt(0) < 32) {
      return this.parseControlCharacter(input, keyEvent);
    }

    // Regular character
    keyEvent.key = input;
    return keyEvent;
  }

  private parseEscapeSequence(input: string, keyEvent: KeyEvent): KeyEvent {
    keyEvent.sequence = input;

    // Common escape sequences
    const sequences: Record<string, Partial<KeyEvent>> = {
      '\x1b[A': { key: 'up', type: 'key' },
      '\x1b[B': { key: 'down', type: 'key' },
      '\x1b[C': { key: 'right', type: 'key' },
      '\x1b[D': { key: 'left', type: 'key' },
      '\x1b[H': { key: 'home', type: 'key' },
      '\x1b[F': { key: 'end', type: 'key' },
      '\x1b[5~': { key: 'pageup', type: 'key' },
      '\x1b[6~': { key: 'pagedown', type: 'key' },
      '\x1b[3~': { key: 'delete', type: 'key' },
      '\x1b[2~': { key: 'insert', type: 'key' },
    };

    const mapping = sequences[input];
    if (mapping != null) {
      Object.assign(keyEvent, mapping);
    }

    // Function keys
    const fnMatch = input.match(/^\x1b\[(\d+)~$/);
    if (fnMatch) {
      const code = parseInt(fnMatch[1]);
      const fnKeys: Record<number, string> = {
        11: 'f1',
        12: 'f2',
        13: 'f3',
        14: 'f4',
        15: 'f5',
        17: 'f6',
        18: 'f7',
        19: 'f8',
        20: 'f9',
        21: 'f10',
        23: 'f11',
        24: 'f12',
      };

      if (fnKeys[code]) {
        keyEvent.key = fnKeys[code];
        keyEvent.type = 'key';
      }
    }

    // Mouse events
    if (input.startsWith('\x1b[M')) {
      keyEvent.type = 'mouse';
      keyEvent.meta = this.parseMouseEvent(input);
    }

    // Modified keys (Ctrl+Arrow, Alt+key, etc.)
    if (input.startsWith('\x1b[1;')) {
      const modMatch = input.match(/^\x1b\[1;(\d+)([A-D~])$/);
      if (modMatch != null && modMatch.length > 0) {
        const modCode = parseInt(modMatch[1]);
        const key =
          { A: 'up', B: 'down', C: 'right', D: 'left' }[modMatch[2]] ??
          modMatch[2];

        keyEvent.key = key;
        keyEvent.type = 'key';
        keyEvent.modifiers = this.parseModifierCode(modCode);
      }
    }

    return keyEvent;
  }

  private parseControlCharacter(input: string, keyEvent: KeyEvent): KeyEvent {
    const code = input.charCodeAt(0);

    const controlKeys: Record<number, Partial<KeyEvent>> = {
      1: { key: 'a', modifiers: { ctrl: true } }, // Ctrl+A
      2: { key: 'b', modifiers: { ctrl: true } }, // Ctrl+B
      3: { key: 'c', modifiers: { ctrl: true } }, // Ctrl+C
      4: { key: 'd', modifiers: { ctrl: true } }, // Ctrl+D
      5: { key: 'e', modifiers: { ctrl: true } }, // Ctrl+E
      6: { key: 'f', modifiers: { ctrl: true } }, // Ctrl+F
      7: { key: 'g', modifiers: { ctrl: true } }, // Ctrl+G
      8: { key: 'backspace' }, // Backspace
      9: { key: 'tab' }, // Tab
      10: { key: 'enter' }, // Enter (LF)
      11: { key: 'k', modifiers: { ctrl: true } }, // Ctrl+K
      12: { key: 'l', modifiers: { ctrl: true } }, // Ctrl+L
      13: { key: 'enter' }, // Enter (CR)
      14: { key: 'n', modifiers: { ctrl: true } }, // Ctrl+N
      15: { key: 'o', modifiers: { ctrl: true } }, // Ctrl+O
      16: { key: 'p', modifiers: { ctrl: true } }, // Ctrl+P
      17: { key: 'q', modifiers: { ctrl: true } }, // Ctrl+Q
      18: { key: 'r', modifiers: { ctrl: true } }, // Ctrl+R
      19: { key: 's', modifiers: { ctrl: true } }, // Ctrl+S
      20: { key: 't', modifiers: { ctrl: true } }, // Ctrl+T
      21: { key: 'u', modifiers: { ctrl: true } }, // Ctrl+U
      22: { key: 'v', modifiers: { ctrl: true } }, // Ctrl+V
      23: { key: 'w', modifiers: { ctrl: true } }, // Ctrl+W
      24: { key: 'x', modifiers: { ctrl: true } }, // Ctrl+X
      25: { key: 'y', modifiers: { ctrl: true } }, // Ctrl+Y
      26: { key: 'z', modifiers: { ctrl: true } }, // Ctrl+Z
      27: { key: 'escape' }, // Escape
      127: { key: 'delete' }, // Delete
    };

    const mapping = controlKeys[code];
    if (mapping != null) {
      Object.assign(keyEvent, mapping);
    } else {
      // Unknown control character
      keyEvent.key = String.fromCharCode(code);
      keyEvent.meta = { controlCode: code };
    }

    return keyEvent;
  }

  private parseModifierCode(code: number): KeyModifiers {
    // Modifier code format: 1 + sum of modifiers
    // Shift = 1, Alt = 2, Ctrl = 4, Meta = 8
    const modifiers: KeyModifiers = {};
    const mod = code - 1;

    if (mod & 1) modifiers.shift = true;
    if (mod & 2) modifiers.alt = true;
    if (mod & 4) modifiers.ctrl = true;
    if (mod & 8) modifiers.meta = true;

    return modifiers;
  }

  private parseMouseEvent(input: string): Record<string, unknown> {
    // Basic mouse event parsing
    if (input.length < 6) return {};

    const bytes = Array.from(input.slice(3), (char) => char.charCodeAt(0));
    const [btn, x, y] = bytes;

    return {
      button: btn - 32,
      x: x - 33,
      y: y - 33,
      type: 'click',
    };
  }

  private async processKeyBindings(keyEvent: KeyEvent): Promise<boolean> {
    let handled = false;

    // Get all potential bindings
    const potentialBindings = this.getPotentialBindings(keyEvent);

    // Sort by priority (highest first)
    potentialBindings.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    for (const binding of potentialBindings) {
      if (binding.enabled !== true) continue;

      if (this.matchesBinding(keyEvent, binding)) {
        try {
          const result = binding.handler(keyEvent);
          if (result instanceof Promise) {
            await result;
          }

          handled = true;
          this.emit('keyHandled', { keyEvent, binding });

          // Stop after first successful binding
          break;
        } catch (error) {
          this.emit('bindingError', { error, keyEvent, binding });
        }
      }
    }

    return handled;
  }

  private getPotentialBindings(keyEvent: KeyEvent): KeyBinding[] {
    const bindings: KeyBinding[] = [];

    // Add global bindings
    bindings.push(...this.globalBindings);

    // Add key-specific bindings
    if (keyEvent.key != null && keyEvent.key.length > 0) {
      const keyBindings = this.bindings.get(keyEvent.key);
      if (keyBindings) {
        bindings.push(...keyBindings);
      }
    }

    return bindings;
  }

  private matchesBinding(keyEvent: KeyEvent, binding: KeyBinding): boolean {
    const bindingKeys = this.parseBindingKeys(binding.keys);

    // Simple key matching
    if (bindingKeys.length === 1 && bindingKeys[0].key === keyEvent.key) {
      return this.modifiersMatch(keyEvent.modifiers, bindingKeys[0].modifiers);
    }

    // Key sequence matching would go here
    // For now, just handle simple key combinations
    return false;
  }

  private parseBindingKeys(keys: string): ParsedKeyBinding[] {
    // Parse key binding strings like "ctrl+c", "alt+enter", "ctrl+shift+f1"
    const parts = keys.toLowerCase().split('+');
    const modifiers: KeyModifiers = {};
    let key = '';

    for (const part of parts) {
      switch (part) {
        case 'ctrl':
        case 'control':
          modifiers.ctrl = true;
          break;
        case 'alt':
        case 'option':
          modifiers.alt = true;
          break;
        case 'shift':
          modifiers.shift = true;
          break;
        case 'meta':
        case 'cmd':
        case 'command':
          modifiers.meta = true;
          break;
        default:
          key = part;
      }
    }

    return [{ key, modifiers }];
  }

  private modifiersMatch(
    eventMods: KeyModifiers,
    bindingMods: KeyModifiers
  ): boolean {
    const keys: (keyof KeyModifiers)[] = ['ctrl', 'alt', 'shift', 'meta'];

    return keys.every((key) => {
      const eventHas = Boolean(eventMods[key]);
      const bindingWants = Boolean(bindingMods[key]);
      return eventHas === bindingWants;
    });
  }

  private handleSequenceInput(keyEvent: KeyEvent): void {
    if (!this.activeSequence) return;

    this.activeSequence.keys.push(keyEvent.key ?? keyEvent.raw);

    // Check if sequence is complete or timed out
    const now = Date.now();
    if (now - this.activeSequence.startTime > this.activeSequence.timeout) {
      this.activeSequence.onTimeout();
      this.activeSequence = null;
    }
  }

  private recordKeyEvent(keyEvent: KeyEvent): void {
    this.keyHistory.push(keyEvent);

    // Trim history
    if (this.keyHistory.length > this.maxHistorySize) {
      this.keyHistory = this.keyHistory.slice(-this.maxHistorySize);
    }
  }

  private updateKeyMetrics(keyEvent: KeyEvent): void {
    const key = keyEvent.key ?? 'unknown';

    if (!this.keyMetrics.has(key)) {
      this.keyMetrics.set(key, {
        count: 0,
        lastPressed: 0,
        averageInterval: 0,
        totalTime: 0,
      });
    }

    const metrics = this.keyMetrics.get(key);
    if (metrics == null) return;
    metrics.count++;

    if (metrics.lastPressed > 0) {
      const interval = keyEvent.timestamp - metrics.lastPressed;
      metrics.totalTime += interval;
      metrics.averageInterval = metrics.totalTime / (metrics.count - 1);
    }

    metrics.lastPressed = keyEvent.timestamp;
  }

  private setupDefaultBindings(): void {
    // Add some default system bindings
    this.bind(
      'ctrl+c',
      () => {
        this.emit('interrupt');
      },
      { description: 'Send interrupt signal', priority: 100 }
    );

    this.bind(
      'ctrl+d',
      () => {
        this.emit('eof');
      },
      { description: 'End of file', priority: 100 }
    );

    this.bind(
      'ctrl+z',
      () => {
        this.emit('suspend');
      },
      { description: 'Suspend process', priority: 100 }
    );
  }

  public bind(
    keys: string,
    handler: (event: KeyEvent) => void | Promise<void>,
    options: KeyBindingOptions = {}
  ): string {
    const binding: KeyBinding = {
      id: `binding-${Date.now()}-${Math.random()}`,
      keys,
      handler,
      description: options.description,
      scope: options.scope,
      priority: options.priority ?? 0,
      enabled: options.enabled !== false,
      metadata: options.metadata,
    };

    if (options.global === true) {
      this.globalBindings.push(binding);
    } else {
      const parsedKeys = this.parseBindingKeys(keys);
      for (const keyBinding of parsedKeys) {
        const key = keyBinding.key;
        if (!this.bindings.has(key)) {
          this.bindings.set(key, []);
        }
        const keyBindings = this.bindings.get(key);
        if (keyBindings != null) {
          keyBindings.push(binding);
        }
      }
    }

    this.emit('bindingAdded', { binding });
    return binding.id;
  }

  public unbind(id: string): boolean {
    // Remove from global bindings
    const globalIndex = this.globalBindings.findIndex((b) => b.id === id);
    if (globalIndex !== -1) {
      const binding = this.globalBindings.splice(globalIndex, 1)[0];
      this.emit('bindingRemoved', { binding });
      return true;
    }

    // Remove from key-specific bindings
    for (const [key, bindings] of this.bindings) {
      const index = bindings.findIndex((b) => b.id === id);
      if (index !== -1) {
        const binding = bindings.splice(index, 1)[0];
        if (bindings.length === 0) {
          this.bindings.delete(key);
        }
        this.emit('bindingRemoved', { binding });
        return true;
      }
    }

    return false;
  }

  public startSequence(
    keys: string[],
    onComplete: (sequence: string[]) => void,
    timeout?: number
  ): void {
    this.activeSequence = {
      keys: [],
      timeout: timeout ?? this.sequenceTimeout,
      startTime: Date.now(),
      onComplete,
      onTimeout: () => {
        this.emit('sequenceTimeout', { keys });
      },
    };
  }

  public stopSequence(): void {
    this.activeSequence = null;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  public getKeyHistory(limit?: number): KeyEvent[] {
    const history = [...this.keyHistory];
    return limit != null && limit !== 0 ? history.slice(-limit) : history;
  }

  public getKeyMetrics(): Map<string, KeyMetrics> {
    return new Map(this.keyMetrics);
  }

  public getBindings(): KeyBinding[] {
    const allBindings: KeyBinding[] = [...this.globalBindings];
    this.bindings.forEach((bindings) => {
      allBindings.push(...bindings);
    });
    return allBindings;
  }

  public clearHistory(): void {
    this.keyHistory = [];
    this.keyMetrics.clear();
  }

  public destroy(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    this.bindings.clear();
    this.globalBindings = [];
    this.eventHandlers.clear();
    this.clearHistory();
    this.stopSequence();
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
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
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

interface ParsedKeyBinding {
  key: string;
  modifiers: KeyModifiers;
}

interface KeyBindingOptions {
  description?: string;
  scope?: string;
  priority?: number;
  enabled?: boolean;
  global?: boolean;
  metadata?: Record<string, unknown>;
}

interface KeyMetrics {
  count: number;
  lastPressed: number;
  averageInterval: number;
  totalTime: number;
}
