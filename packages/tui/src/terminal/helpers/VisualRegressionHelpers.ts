/**
 * Visual Regression Testing Helper Functions
 */

import type { VisualTestScenario } from './VisualTestManager';

export interface Baseline {
  terminal: string;
  scenario: string;
  renderMode: string;
  content: string;
  timestamp: string;
  metadata?: {
    capabilities?: unknown;
    environment?: {
      TERM: string;
      TERM_PROGRAM: string;
      COLORTERM: string;
    };
  };
}

/**
 * Default test scenarios for visual regression testing
 */
export function getDefaultTestScenarios(): VisualTestScenario[] {
  const scenarios: VisualTestScenario[] = [];
  scenarios.push(createBasicTextScenario());
  scenarios.push(createUnicodeScenario());
  scenarios.push(createBoxDrawingScenario());
  scenarios.push(createColorScenario());
  scenarios.push(createComplexLayoutScenario());
  return scenarios;
}

function createBasicTextScenario(): VisualTestScenario {
  return {
    name: 'Basic Text',
    description: 'Tests basic text rendering',
    content: 'Hello, World!\nThis is a test.',
    renderModes: ['normal', 'ascii', 'monochrome'],
  };
}

function createUnicodeScenario(): VisualTestScenario {
  return {
    name: 'Unicode Characters',
    description: 'Tests unicode and emoji rendering',
    content: '你好世界 🌟 émojis ñ café',
    renderModes: ['normal', 'ascii'],
  };
}

function createBoxDrawingScenario(): VisualTestScenario {
  return {
    name: 'Box Drawing',
    description: 'Tests box drawing characters',
    content: '┌───┐\n│Box│\n└───┘',
    renderModes: ['normal', 'ascii'],
  };
}

function createColorScenario(): VisualTestScenario {
  return {
    name: 'Colors',
    description: 'Tests ANSI color codes',
    content: '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m \x1b[34mBlue\x1b[0m',
    renderModes: ['normal', 'monochrome'],
  };
}

function createComplexLayoutScenario(): VisualTestScenario {
  const lines = [
    '╔════════════════════╗',
    '║ Header             ║',
    '╠════════════════════╣',
    '║ • Item 1           ║',
    '║ • Item 2           ║',
    '║ • Item 3           ║',
    '╚════════════════════╝',
  ];
  return {
    name: 'Complex Layout',
    description: 'Tests complex box drawing and layout',
    content: lines.join('\n'),
    renderModes: ['normal', 'ascii', 'monochrome'],
  };
}

/**
 * Calculate output metrics
 */
export function calculateMetrics(output: string) {
  const lines = output.split('\n');
  const characterCount = output.length;
  const lineCount = lines.length;

  // Count ANSI escape sequences
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  const ansiMatches = output.match(ansiRegex);
  const ansiSequenceCount = ansiMatches ? ansiMatches.length : 0;

  return { characterCount, lineCount, ansiSequenceCount };
}

/**
 * Get output width
 */
export function getOutputWidth(output: string): number {
  const lines = output.split('\n');
  return Math.max(
    ...lines.map((line) => {
      // Remove ANSI sequences for accurate width calculation
      return line.replace(/\x1b\[[0-9;]*m/g, '').length;
    })
  );
}

/**
 * Get output height
 */
export function getOutputHeight(output: string): number {
  return output.split('\n').length;
}

/**
 * Calculate similarity between two outputs
 */
export function calculateSimilarity(output: string, baseline: string): number {
  if (output === baseline) return 1.0;

  const outputLines = output.split('\n');
  const baselineLines = baseline.split('\n');

  if (outputLines.length !== baselineLines.length) {
    return 0.5; // Different structure
  }

  let matchingLines = 0;
  for (let i = 0; i < outputLines.length; i++) {
    if (outputLines[i] === baselineLines[i]) {
      matchingLines++;
    }
  }

  return matchingLines / outputLines.length;
}

/**
 * Compare output with baseline
 */
export function compareWithBaseline(output: string, baseline: Baseline | null) {
  if (baseline === null || baseline === undefined) {
    return {
      similarityScore: 1.0, // No baseline means no regression
      hasRegressions: false,
    };
  }

  const similarity = calculateSimilarity(output, baseline.content);

  return {
    baseline: baseline.content,
    diff: generateDiff(output, baseline.content),
    similarityScore: similarity,
    hasRegressions: similarity < 0.95,
  };
}

/**
 * Generate diff between two outputs
 */
function generateDiff(output: string, baseline: string): string {
  const outputLines = output.split('\n');
  const baselineLines = baseline.split('\n');
  const diff: string[] = [];

  const maxLines = Math.max(outputLines.length, baselineLines.length);

  for (let i = 0; i < maxLines; i++) {
    const outputLine = outputLines[i] ?? '';
    const baselineLine = baselineLines[i] ?? '';

    if (outputLine !== baselineLine) {
      diff.push(`Line ${i + 1}:`);
      if (baselineLine) diff.push(`- ${baselineLine}`);
      if (outputLine) diff.push(`+ ${outputLine}`);
    }
  }

  return diff.join('\n');
}

/**
 * Detect terminal name from environment (convenience function)
 */
export function detectTerminalName(): string {
  const termProgram = process.env.TERM_PROGRAM ?? '';
  const term = process.env.TERM ?? '';
  return detectTerminalNameFromEnv(termProgram, term);
}

/**
 * Detect terminal name from environment variables
 */
export function detectTerminalNameFromEnv(
  termProgram: string,
  term: string
): string {
  if (termProgram.includes('iTerm')) return 'iTerm2';
  if (termProgram.includes('Alacritty')) return 'Alacritty';
  if (termProgram === 'Apple_Terminal') return 'Terminal.app';
  if (
    process.env.WT_SESSION !== undefined &&
    process.env.WT_SESSION.length > 0
  ) {
    return 'Windows Terminal';
  }
  if (term.includes('xterm')) return 'xterm';
  if (term.includes('screen')) return 'screen';
  if (term.includes('tmux')) return 'tmux';
  return 'Unknown';
}
