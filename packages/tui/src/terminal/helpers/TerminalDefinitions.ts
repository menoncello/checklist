/**
 * Terminal Definitions and Configurations
 */

import type { TestTerminal } from '../TerminalTestHarness';

/**
 * Get all supported terminal configurations
 */
export function getTerminalConfigurations(): TestTerminal[] {
  return [
    createMacOSTerminal(),
    createITerm2(),
    createAlacritty(),
    createWindowsTerminal(),
    createXterm(),
    createLinuxTerminal(),
    createITermApp(), // Add iTerm.app variant for compatibility
  ];
}

function createMacOSTerminal(): TestTerminal {
  return {
    name: 'macOS Terminal.app',
    command: 'open',
    args: ['-a', 'Terminal'],
    env: {
      TERM: 'xterm-256color',
      TERM_PROGRAM: 'Apple_Terminal',
    },
    capabilities: {
      color: { basic: true, color256: true, trueColor: false },
      unicode: { basic: true, wide: true, emoji: true },
      mouse: { basic: false, advanced: false },
    },
    expectedFeatures: [],
  };
}

function createITerm2(): TestTerminal {
  return {
    name: 'iTerm2',
    command: 'open',
    args: ['-a', 'iTerm'],
    env: {
      TERM: 'xterm-256color',
      TERM_PROGRAM: 'iTerm.app',
      COLORTERM: 'truecolor',
    },
    capabilities: {
      color: { basic: true, color256: true, trueColor: true },
      unicode: { basic: true, wide: true, emoji: true },
      mouse: { basic: true, advanced: true },
    },
    expectedFeatures: ['trueColor', 'unicode', 'mouse'],
  };
}

function createAlacritty(): TestTerminal {
  return {
    name: 'Alacritty',
    command: 'alacritty',
    args: ['--title', 'Test'],
    env: {
      TERM: 'alacritty',
      TERM_PROGRAM: 'alacritty',
      COLORTERM: 'truecolor',
    },
    capabilities: {
      color: { basic: true, color256: true, trueColor: true },
      unicode: { basic: true, wide: true, emoji: true },
      mouse: { basic: true, advanced: true },
    },
    expectedFeatures: ['trueColor', 'unicode', 'mouse'],
  };
}

function createWindowsTerminal(): TestTerminal {
  return {
    name: 'Windows Terminal',
    command: 'wt.exe',
    args: [],
    env: {
      TERM: 'xterm-256color',
      WT_SESSION: '1',
      COLORTERM: 'truecolor',
    },
    capabilities: {
      color: { basic: true, color256: true, trueColor: true },
      unicode: { basic: true, wide: true, emoji: true },
      mouse: { basic: true, advanced: true },
    },
    expectedFeatures: ['trueColor', 'unicode', 'mouse', 'altScreen'],
  };
}

function createXterm(): TestTerminal {
  return {
    name: 'xterm',
    command: 'xterm',
    args: ['-e'],
    env: {
      TERM: 'xterm',
    },
    capabilities: {
      color: { basic: true, color256: false, trueColor: false },
      unicode: { basic: false, wide: false, emoji: false },
      mouse: { basic: true, advanced: false },
    },
    expectedFeatures: [],
  };
}

function createLinuxTerminal(): TestTerminal {
  return {
    name: 'Linux Console',
    command: 'console',
    args: [],
    env: {
      TERM: 'linux',
    },
    capabilities: {
      color: { basic: true, color256: false, trueColor: false },
      unicode: { basic: false, wide: false, emoji: false },
      mouse: { basic: false, advanced: false },
    },
    expectedFeatures: [],
  };
}

function createITermApp(): TestTerminal {
  return {
    name: 'iTerm.app',
    command: 'open',
    args: ['-a', 'iTerm'],
    env: {
      TERM: 'xterm-256color',
      TERM_PROGRAM: 'iTerm.app',
      COLORTERM: 'truecolor',
    },
    capabilities: {
      color: { basic: true, color256: true, trueColor: true },
      unicode: { basic: true, wide: true, emoji: true },
      mouse: { basic: true, advanced: true },
    },
    expectedFeatures: ['trueColor', 'unicode', 'mouse'],
  };
}

/**
 * Find terminal by name
 */
export function findTerminalByName(
  terminals: TestTerminal[],
  name: string
): TestTerminal {
  const found = terminals.find((t) => t.name === name);
  if (!found) {
    throw new Error(`${name} terminal not found`);
  }
  return found;
}

/**
 * Detect current terminal from environment
 */
export function detectCurrentTerminal(terminals: TestTerminal[]): TestTerminal {
  const term = process.env.TERM ?? 'unknown';
  const termProgram = process.env.TERM_PROGRAM ?? '';
  const wtSession = process.env.WT_SESSION;

  const terminalMapping: Record<string, string> = {
    iTerm: 'iTerm2',
    Alacritty: 'Alacritty',
    Apple_Terminal: 'macOS Terminal.app',
  };

  if (wtSession !== undefined && wtSession.length > 0) {
    return findTerminalByName(terminals, 'Windows Terminal');
  }

  for (const [key, name] of Object.entries(terminalMapping)) {
    if (termProgram.includes(key)) {
      return findTerminalByName(terminals, name);
    }
  }

  // Fallback to generic terminal
  return {
    name: 'Current Terminal',
    command: 'echo',
    args: ['Current terminal environment'],
    env: { TERM: term, TERM_PROGRAM: termProgram },
    capabilities: {},
    expectedFeatures: [],
  };
}
