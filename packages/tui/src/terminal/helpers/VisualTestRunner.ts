/**
 * Visual Test Runner - Helper for running visual regression tests
 */

import { readFileSync, writeFileSync } from 'fs';
import type {
  VisualTestResult,
  VisualTestScenario,
  Baseline,
} from '../VisualRegressionTester';
import {
  calculateMetrics,
  getOutputWidth,
  getOutputHeight,
  compareWithBaseline,
  detectTerminalNameFromEnv,
} from './VisualRegressionHelpers';

export interface TestParams {
  scenario: VisualTestScenario;
  renderMode: string;
  renderFn: (content: string, mode: string) => string;
  capabilitiesFn: () => Promise<unknown>;
  baselineDir: string;
}

/**
 * Run a visual regression test
 */
export async function runVisualTest(
  params: TestParams
): Promise<VisualTestResult> {
  const { scenario, renderMode, renderFn, baselineDir } = params;
  const startTime = Date.now();

  try {
    const output = renderFn(scenario.content, renderMode);
    const terminalInfo = await getTerminalInfo();
    const metrics = calculateMetrics(output);
    const baseline = loadBaseline(
      scenario.name,
      terminalInfo.name,
      renderMode,
      baselineDir
    );
    const differences = compareWithBaseline(output, baseline);

    return createSuccessResult({
      scenario,
      renderMode,
      output,
      terminalName: terminalInfo.name,
      metrics,
      differences,
      startTime,
    });
  } catch (error) {
    return createFailureResult(scenario, renderMode, error, startTime);
  }
}

async function getTerminalInfo() {
  const termProgram = process.env.TERM_PROGRAM ?? '';
  const term = process.env.TERM ?? '';
  const name = detectTerminalNameFromEnv(termProgram, term);

  return { name };
}

function loadBaseline(
  scenarioName: string,
  terminal: string,
  renderMode: string,
  baselineDir: string
): Baseline | null {
  try {
    const filename = getBaselineFilename(
      scenarioName,
      terminal,
      renderMode,
      baselineDir
    );
    const content = readFileSync(filename, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getBaselineFilename(
  scenario: string,
  terminal: string,
  mode: string,
  baselineDir: string
): string {
  const sanitized = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '-');
  return `${baselineDir}/${sanitized(scenario)}-${sanitized(
    terminal
  )}-${mode}.json`;
}

function createSuccessResult(params: {
  scenario: VisualTestScenario;
  renderMode: string;
  output: string;
  terminalName: string;
  metrics: ReturnType<typeof calculateMetrics>;
  differences: ReturnType<typeof compareWithBaseline>;
  startTime: number;
}): VisualTestResult {
  const renderTime = Date.now() - params.startTime;

  return {
    scenario: params.scenario,
    terminal: params.terminalName,
    renderMode: params.renderMode,
    output: params.output,
    dimensions: {
      width: getOutputWidth(params.output),
      height: getOutputHeight(params.output),
    },
    metrics: {
      renderTime,
      ...params.metrics,
    },
    differences: params.differences,
    passed: params.differences.similarityScore > 0.95,
    errors: [],
  };
}

function createFailureResult(
  scenario: VisualTestScenario,
  renderMode: string,
  error: unknown,
  startTime: number
): VisualTestResult {
  return {
    scenario,
    terminal: 'unknown',
    renderMode,
    output: '',
    dimensions: { width: 0, height: 0 },
    metrics: {
      renderTime: Date.now() - startTime,
      characterCount: 0,
      lineCount: 0,
      ansiSequenceCount: 0,
    },
    differences: {
      similarityScore: 0,
      hasRegressions: true,
    },
    passed: false,
    errors: [
      `Test failed: ${error instanceof Error ? error.message : String(error)}`,
    ],
  };
}

export interface BaselineParams {
  scenario: VisualTestScenario;
  renderMode: string;
  terminalName: string;
  renderFn: (content: string, mode: string) => string;
  capabilitiesFn: () => unknown;
  baselineDir: string;
}

/**
 * Create baseline
 */
export async function createBaseline(params: BaselineParams): Promise<void> {
  const {
    scenario,
    renderMode,
    terminalName,
    renderFn,
    capabilitiesFn,
    baselineDir,
  } = params;
  const output = renderFn(scenario.content, renderMode);

  const baseline: Baseline = {
    terminal: terminalName,
    scenario: scenario.name,
    renderMode,
    content: output,
    timestamp: new Date().toISOString(),
    metadata: {
      capabilities: capabilitiesFn(),
      environment: {
        TERM: process.env.TERM ?? '',
        TERM_PROGRAM: process.env.TERM_PROGRAM ?? '',
        COLORTERM: process.env.COLORTERM ?? '',
      },
    },
  };

  saveBaseline(baseline, baselineDir);
}

function saveBaseline(baseline: Baseline, baselineDir: string): void {
  const filename = getBaselineFilename(
    baseline.scenario,
    baseline.terminal,
    baseline.renderMode,
    baselineDir
  );
  writeFileSync(filename, JSON.stringify(baseline, null, 2));
}
