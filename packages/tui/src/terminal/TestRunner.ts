import { CapabilityTester } from './CapabilityTester';
import { CapabilityTest } from './types';

export interface TestResult {
  success: boolean;
  fallbackUsed: boolean;
  error?: Error;
}

export class TestRunner {
  private tester: CapabilityTester;
  private testResults = new Map<string, boolean>();

  constructor(tester: CapabilityTester) {
    this.tester = tester;
  }

  public async runAllTests(): Promise<{
    testResults: Map<string, boolean>;
    warnings: string[];
    fallbacksUsed: string[];
  }> {
    const tests = this.tester.createCapabilityTests();
    const warnings: string[] = [];
    const fallbacksUsed: string[] = [];

    const testPromises = tests.map((test) =>
      this.runSingleTest(test, warnings, fallbacksUsed)
    );

    await Promise.all(testPromises);

    return {
      testResults: new Map(this.testResults),
      warnings,
      fallbacksUsed,
    };
  }

  public async runSingleTest(
    test: CapabilityTest,
    warnings: string[],
    fallbacksUsed: string[]
  ): Promise<void> {
    try {
      const testResult = await this.tester.runTestWithTimeout(test);
      this.testResults.set(test.name, testResult);
    } catch (error) {
      this.handleTestFailure(test, error as Error, warnings, fallbacksUsed);
    }
  }

  private handleTestFailure(
    test: CapabilityTest,
    error: Error,
    warnings: string[],
    fallbacksUsed: string[]
  ): void {
    const fallback = test.fallback ?? false;
    this.testResults.set(test.name, fallback);

    if (fallback) {
      fallbacksUsed.push(test.name);
    } else {
      warnings.push(`Failed to detect ${test.name}: ${error.message}`);
    }
  }

  public getTestResults(): Map<string, boolean> {
    return new Map(this.testResults);
  }

  public async testSpecificCapability(capability: string): Promise<boolean> {
    const tests = this.tester.createCapabilityTests();
    const test = tests.find((t) => t.name === capability);

    if (test === undefined) {
      throw new Error(`Unknown capability: ${capability}`);
    }

    try {
      return await this.tester.runTestWithTimeout(test);
    } catch (_error) {
      return test.fallback ?? false;
    }
  }

  public getSupportedCapabilities(): string[] {
    return this.filterCapabilities(true);
  }

  public getUnsupportedCapabilities(): string[] {
    return this.filterCapabilities(false);
  }

  private filterCapabilities(supported: boolean): string[] {
    const capabilities: string[] = [];

    for (const [capability, isSupported] of this.testResults) {
      if (isSupported === supported) {
        capabilities.push(capability);
      }
    }

    return capabilities;
  }

  public clearResults(): void {
    this.testResults.clear();
  }
}
