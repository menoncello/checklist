export class KeyModifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export class KeyEvent {
  key!: string;
  modifiers!: KeyModifiers;
  timestamp!: number;
  meta?: Record<string, unknown>;
}

export class KeyBindingOptions {
  description?: string;
  priority?: number;
  global?: boolean;
  enabled?: boolean;
}

export class KeyBinding {
  id!: string;
  keys!: string;
  handler!: (event: KeyEvent) => void | Promise<void>;
  options!: KeyBindingOptions;
}

export class ParsedKeyBinding {
  key!: string;
  modifiers!: KeyModifiers;
}

export class KeyBindingManager {
  private bindings = new Map<string, KeyBinding[]>();
  private globalBindings: KeyBinding[] = [];
  private idCounter = 0;

  public createBinding(
    keys: string,
    handler: (event: KeyEvent) => void | Promise<void>,
    options: KeyBindingOptions = {}
  ): KeyBinding {
    const binding: KeyBinding = {
      id: `binding-${++this.idCounter}`,
      keys,
      handler,
      options: {
        priority: 0,
        enabled: true,
        global: false,
        ...options,
      },
    };

    return binding;
  }

  public addBinding(binding: KeyBinding, isGlobal: boolean = false): void {
    if (isGlobal) {
      this.globalBindings.push(binding);
      this.sortBindingsByPriority(this.globalBindings);
    } else {
      const parsedKeys = this.parseBindingKeys(binding.keys);
      if (parsedKeys.length > 0) {
        const key = parsedKeys[0].key;
        if (!this.bindings.has(key)) {
          this.bindings.set(key, []);
        }
        const keyBindings = this.bindings.get(key);
        if (keyBindings) {
          keyBindings.push(binding);
          this.sortBindingsByPriority(keyBindings);
        }
      }
    }
  }

  public removeBinding(id: string): boolean {
    // Check global bindings
    const globalIndex = this.globalBindings.findIndex((b) => b.id === id);
    if (globalIndex !== -1) {
      this.globalBindings.splice(globalIndex, 1);
      return true;
    }

    // Check key-specific bindings
    for (const bindings of this.bindings.values()) {
      const index = bindings.findIndex((b) => b.id === id);
      if (index !== -1) {
        bindings.splice(index, 1);
        return true;
      }
    }

    return false;
  }

  public getPotentialBindings(keyEvent: KeyEvent): KeyBinding[] {
    const bindings: KeyBinding[] = [];

    // Add global bindings
    bindings.push(
      ...this.globalBindings.filter((b) => b.options.enabled !== false)
    );

    // Add key-specific bindings
    if (keyEvent.key != null && keyEvent.key.length > 0) {
      const keyBindings = this.bindings.get(keyEvent.key);
      if (keyBindings) {
        bindings.push(
          ...keyBindings.filter((b) => b.options.enabled !== false)
        );
      }
    }

    return bindings;
  }

  public matchesBinding(keyEvent: KeyEvent, binding: KeyBinding): boolean {
    const bindingKeys = this.parseBindingKeys(binding.keys);

    // Simple key matching
    if (bindingKeys.length === 1 && bindingKeys[0].key === keyEvent.key) {
      return this.modifiersMatch(keyEvent.modifiers, bindingKeys[0].modifiers);
    }

    // Key sequence matching would go here
    return false;
  }

  public parseBindingKeys(keys: string): ParsedKeyBinding[] {
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
        case 'super':
          modifiers.meta = true;
          break;
        default:
          key = part;
          break;
      }
    }

    return [{ key, modifiers }];
  }

  private modifiersMatch(
    eventMods: KeyModifiers,
    bindingMods: KeyModifiers
  ): boolean {
    const modifierKeys: Array<keyof KeyModifiers> = [
      'ctrl',
      'alt',
      'shift',
      'meta',
    ];
    return modifierKeys.every(
      (key) => (eventMods[key] ?? false) === (bindingMods[key] ?? false)
    );
  }

  private sortBindingsByPriority(bindings: KeyBinding[]): void {
    bindings.sort(
      (a, b) => (b.options.priority ?? 0) - (a.options.priority ?? 0)
    );
  }

  public getAllBindings(): KeyBinding[] {
    const allBindings: KeyBinding[] = [...this.globalBindings];
    for (const bindings of this.bindings.values()) {
      allBindings.push(...bindings);
    }
    return allBindings;
  }

  public getBindingsByKey(key: string): KeyBinding[] {
    return this.bindings.get(key) ?? [];
  }

  public getGlobalBindings(): KeyBinding[] {
    return [...this.globalBindings];
  }

  public enableBinding(id: string): boolean {
    const binding = this.findBinding(id);
    if (binding != null) {
      binding.options.enabled = true;
      return true;
    }
    return false;
  }

  public disableBinding(id: string): boolean {
    const binding = this.findBinding(id);
    if (binding != null) {
      binding.options.enabled = false;
      return true;
    }
    return false;
  }

  private findBinding(id: string): KeyBinding | null {
    for (const binding of this.globalBindings) {
      if (binding.id === id) return binding;
    }

    for (const bindings of this.bindings.values()) {
      for (const binding of bindings) {
        if (binding.id === id) return binding;
      }
    }

    return null;
  }

  public clear(): void {
    this.bindings.clear();
    this.globalBindings = [];
  }

  public getBindingCount(): number {
    let count = this.globalBindings.length;
    for (const bindings of this.bindings.values()) {
      count += bindings.length;
    }
    return count;
  }
}
