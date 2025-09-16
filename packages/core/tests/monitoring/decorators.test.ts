import { test, expect, beforeEach, afterEach, describe, mock } from 'bun:test';
import {
  Timed,
  TimedClass,
  withTiming,
  createTimedFunction,
  TimedOptions,
} from '../../src/monitoring/decorators';
import type { IPerformanceMonitor } from '../../src/interfaces/IPerformanceMonitor';

describe('Decorators', () => {
  let mockMonitor: IPerformanceMonitor;
  let timerMock: () => void;

  beforeEach(() => {
    timerMock = mock(() => {});

    mockMonitor = {
      startTimer: mock(() => timerMock),
      recordMetric: mock(() => {}),
      setBudget: mock(() => {}),
      generateReport: mock(() => ({
        metrics: {},
        violations: [],
        summary: {
          totalOperations: 0,
          budgetViolations: 0,
          overallHealth: 'HEALTHY' as const,
          measurementPeriod: { start: 0, end: 0, duration: 0 },
        },
      })),
      clear: mock(() => {}),
      getMetrics: mock(() => undefined),
      getBudgetViolations: mock(() => []),
      setEnabled: mock(() => {}),
      isEnabled: mock(() => true),
    };
  });

  afterEach(() => {
    // Reset all mocks
    Object.values(mockMonitor).forEach(mockFn => {
      if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
        (mockFn as ReturnType<typeof mock>).mockClear();
      }
    });
    (timerMock as ReturnType<typeof mock>).mockClear();
  });

  describe('@Timed decorator', () => {
    test('should time synchronous method execution', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        syncMethod(value: number): number {
          return value * 2;
        }
      }

      const instance = new TestClass();
      const result = instance.syncMethod(5);

      expect(result).toBe(10);
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('TestClass.syncMethod');
      expect(timerMock).toHaveBeenCalled();
    });

    test('should time asynchronous method execution', async () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        async asyncMethod(value: number): Promise<number> {
          return new Promise(resolve => setTimeout(() => resolve(value * 2), 1));
        }
      }

      const instance = new TestClass();
      const result = await instance.asyncMethod(5);

      expect(result).toBe(10);
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('TestClass.asyncMethod');
      expect(timerMock).toHaveBeenCalled();
    });

    test('should use custom operation name', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ operationName: 'custom-operation', monitor: mockMonitor })
        testMethod(): void {}
      }

      const instance = new TestClass();
      instance.testMethod();

      expect(mockMonitor.startTimer).toHaveBeenCalledWith('custom-operation');
    });

    test('should exclude class name when includeClassName is false', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ includeClassName: false, monitor: mockMonitor })
        testMethod(): void {}
      }

      const instance = new TestClass();
      instance.testMethod();

      expect(mockMonitor.startTimer).toHaveBeenCalledWith('testMethod');
    });

    test('should set budget when budgetMs is provided', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ budgetMs: 100, severity: 'critical', monitor: mockMonitor })
        budgetedMethod(): void {}
      }

      const instance = new TestClass();
      instance.budgetedMethod();

      expect(mockMonitor.setBudget).toHaveBeenCalledWith(
        'TestClass.budgetedMethod',
        100,
        'critical'
      );
    });

    test('should handle method that throws error', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        errorMethod(): void {
          throw new Error('Test error');
        }
      }

      const instance = new TestClass();

      expect(() => instance.errorMethod()).toThrow('Test error');
      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });

    test('should handle async method that throws error', async () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        async asyncErrorMethod(): Promise<void> {
          throw new Error('Async error');
        }
      }

      const instance = new TestClass();

      await expect(instance.asyncErrorMethod()).rejects.toThrow('Async error');
      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });

    test('should skip timing when monitor is disabled', () => {
      (mockMonitor.isEnabled as ReturnType<typeof mock>).mockReturnValue(false);

      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        testMethod(): number {
          return 42;
        }
      }

      const instance = new TestClass();
      const result = instance.testMethod();

      expect(result).toBe(42);
      expect(mockMonitor.startTimer).not.toHaveBeenCalled();
      expect(timerMock).not.toHaveBeenCalled();
    });

    test('should skip timing when monitor is null', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: null as unknown as IPerformanceMonitor })
        testMethod(): number {
          return 42;
        }
      }

      const instance = new TestClass();
      const result = instance.testMethod();

      expect(result).toBe(42);
    });

    test('should handle symbol property keys', () => {
      const symbolKey = Symbol('testMethod');

      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        [symbolKey](): void {}
      }

      const instance = new TestClass();
      instance[symbolKey]();

      expect(mockMonitor.startTimer).toHaveBeenCalledWith('TestClass.Symbol(testMethod)');
    });

    test('should return undefined for invalid descriptor', () => {
      const decorator = Timed({ monitor: mockMonitor });
      const result = decorator({}, 'method', { value: undefined } as PropertyDescriptor);

      expect(result).toBeUndefined();
    });

    test('should preserve method context (this binding)', () => {
      class TestClass {
        value = 42;

        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        getThisValue(): number {
          return this.value;
        }
      }

      const instance = new TestClass();
      const result = instance.getThisValue();

      expect(result).toBe(42);
    });

    test('should handle methods with complex parameters', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        complexMethod(
          str: string,
          num: number,
          obj: { key: string },
          arr: number[]
        ): string {
          return `${str}-${num}-${obj.key}-${arr.length}`;
        }
      }

      const instance = new TestClass();
      const result = instance.complexMethod('test', 42, { key: 'value' }, [1, 2, 3]);

      expect(result).toBe('test-42-value-3');
      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });
  });

  describe('@TimedClass decorator', () => {
    test('should apply timing to all methods in class', () => {
      @TimedClass({ monitor: mockMonitor })
      class TestClass {
        method1(): number {
          return 1;
        }

        method2(): number {
          return 2;
        }

        method3(): number {
          return 3;
        }
      }

      const instance = new TestClass();

      instance.method1();
      instance.method2();
      instance.method3();

      expect(mockMonitor.startTimer).toHaveBeenCalledWith('TestClass.method1');
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('TestClass.method2');
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('TestClass.method3');
      expect((mockMonitor.startTimer as ReturnType<typeof mock>).mock.calls).toHaveLength(3);
    });

    test('should not apply timing to constructor', () => {
      // @ts-expect-error - TypeScript decorator type checking limitation
      @TimedClass({ monitor: mockMonitor })
      class TestClass {
        constructor(public value: number) {}

        getValue(): number {
          return this.value;
        }
      }

      const instance = new TestClass(42);
      const result = instance.getValue();

      expect(result).toBe(42);
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('TestClass.getValue');
      expect((mockMonitor.startTimer as ReturnType<typeof mock>).mock.calls).toHaveLength(1);
    });

    test('should apply default options to all methods', () => {
      @TimedClass({ budgetMs: 50, severity: 'warning', monitor: mockMonitor })
      class TestClass {
        method1(): void {}
        method2(): void {}
      }

      const instance = new TestClass();

      instance.method1();
      instance.method2();

      expect(mockMonitor.setBudget).toHaveBeenCalledWith('TestClass.method1', 50, 'warning');
      expect(mockMonitor.setBudget).toHaveBeenCalledWith('TestClass.method2', 50, 'warning');
    });

    test('should skip non-function properties', () => {
      @TimedClass({ monitor: mockMonitor })
      class TestClass {
        property = 'value';

        method(): string {
          return this.property;
        }
      }

      const instance = new TestClass();
      const result = instance.method();

      expect(result).toBe('value');
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('TestClass.method');
      expect((mockMonitor.startTimer as ReturnType<typeof mock>).mock.calls).toHaveLength(1);
    });

    test('should handle inheritance', () => {
      class BaseClass {
        baseMethod(): string {
          return 'base';
        }
      }

      @TimedClass({ monitor: mockMonitor })
      class DerivedClass extends BaseClass {
        derivedMethod(): string {
          return 'derived';
        }
      }

      const instance = new DerivedClass();

      instance.baseMethod();
      instance.derivedMethod();

      // Should only time the derived class methods
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('DerivedClass.derivedMethod');
      expect((mockMonitor.startTimer as ReturnType<typeof mock>).mock.calls).toHaveLength(1);
    });
  });

  describe('withTiming utility', () => {
    test('should time synchronous operation', async () => {
      const operation = () => 42;

      const result = await withTiming('sync-operation', operation, { monitor: mockMonitor });

      expect(result).toBe(42);
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('sync-operation');
      expect(timerMock).toHaveBeenCalled();
    });

    test('should time asynchronous operation', async () => {
      const operation = async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'async-result';
      };

      const result = await withTiming('async-operation', operation, { monitor: mockMonitor });

      expect(result).toBe('async-result');
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('async-operation');
      expect(timerMock).toHaveBeenCalled();
    });

    test('should set budget when provided', async () => {
      const operation = () => 'test';

      await withTiming('budgeted-operation', operation, {
        budgetMs: 100,
        severity: 'critical',
        monitor: mockMonitor,
      });

      expect(mockMonitor.setBudget).toHaveBeenCalledWith('budgeted-operation', 100, 'critical');
    });

    test('should handle operation that throws error', async () => {
      const operation = () => {
        throw new Error('Operation error');
      };

      await expect(
        withTiming('error-operation', operation, { monitor: mockMonitor })
      ).rejects.toThrow('Operation error');

      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });

    test('should handle async operation that throws error', async () => {
      const operation = async () => {
        throw new Error('Async operation error');
      };

      await expect(
        withTiming('async-error-operation', operation, { monitor: mockMonitor })
      ).rejects.toThrow('Async operation error');

      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });

    test('should skip timing when monitor is disabled', async () => {
      (mockMonitor.isEnabled as ReturnType<typeof mock>).mockReturnValue(false);

      const operation = () => 'result';
      const result = await withTiming('disabled-operation', operation, { monitor: mockMonitor });

      expect(result).toBe('result');
      expect(mockMonitor.startTimer).not.toHaveBeenCalled();
    });

    test('should handle operation returning promise', async () => {
      const operation = () => Promise.resolve('promise-result');

      const result = await withTiming('promise-operation', operation, { monitor: mockMonitor });

      expect(result).toBe('promise-result');
      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });
  });

  describe('createTimedFunction', () => {
    test('should create timed version of synchronous function', () => {
      const originalFn = (x: number, y: number) => x + y;
      const timedFn = createTimedFunction('add-operation', originalFn as (...args: unknown[]) => unknown, { monitor: mockMonitor });

      const result = timedFn(2, 3);

      expect(result).toBe(5);
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('add-operation');
      expect(timerMock).toHaveBeenCalled();
    });

    test('should create timed version of asynchronous function', async () => {
      const originalFn = async (x: number) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return x * 2;
      };
      const timedFn = createTimedFunction('multiply-operation', originalFn as (...args: unknown[]) => unknown, { monitor: mockMonitor });

      const result = await timedFn(5);

      expect(result).toBe(10);
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('multiply-operation');
      expect(timerMock).toHaveBeenCalled();
    });

    test('should set budget when provided', () => {
      const originalFn = () => 'test';
      const timedFn = createTimedFunction('budgeted-fn', originalFn, {
        budgetMs: 50,
        severity: 'warning',
        monitor: mockMonitor,
      });

      timedFn();

      expect(mockMonitor.setBudget).toHaveBeenCalledWith('budgeted-fn', 50, 'warning');
    });

    test('should handle function that throws error', () => {
      const originalFn = () => {
        throw new Error('Function error');
      };
      const timedFn = createTimedFunction('error-fn', originalFn, { monitor: mockMonitor });

      expect(() => timedFn()).toThrow('Function error');
      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });

    test('should skip timing when monitor is disabled', () => {
      (mockMonitor.isEnabled as ReturnType<typeof mock>).mockReturnValue(false);

      const originalFn = (x: number) => x * 2;
      const timedFn = createTimedFunction('disabled-fn', originalFn as (...args: unknown[]) => unknown, { monitor: mockMonitor });

      const result = timedFn(5);

      expect(result).toBe(10);
      expect(mockMonitor.startTimer).not.toHaveBeenCalled();
    });

    test('should preserve function parameters and return types', () => {
      const originalFn = (str: string, num: number, flag: boolean) => ({
        message: str,
        value: num,
        enabled: flag,
      });

      const timedFn = createTimedFunction('typed-fn', originalFn as (...args: unknown[]) => unknown, { monitor: mockMonitor });
      const result = timedFn('test', 42, true);

      expect(result).toEqual({
        message: 'test',
        value: 42,
        enabled: true,
      });
    });

    test('should handle promise-returning function', async () => {
      const originalFn = (value: string) => Promise.resolve(`processed: ${value}`);
      const timedFn = createTimedFunction('promise-fn', originalFn as (...args: unknown[]) => unknown, { monitor: mockMonitor });

      const result = await timedFn('input');

      expect(result).toBe('processed: input');
      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });
  });

  describe('helper functions', () => {
    test('should detect promises correctly', async () => {
      // This tests the internal isPromise function through createTimedFunction
      const promiseFn = () => Promise.resolve('promise');
      const nonPromiseFn = () => 'value';

      const timedPromiseFn = createTimedFunction('promise-test', promiseFn, { monitor: mockMonitor });
      const timedNonPromiseFn = createTimedFunction('non-promise-test', nonPromiseFn, { monitor: mockMonitor });

      const promiseResult = await timedPromiseFn();
      const nonPromiseResult = timedNonPromiseFn();

      expect(promiseResult).toBe('promise');
      expect(nonPromiseResult).toBe('value');
      expect((timerMock as ReturnType<typeof mock>).mock.calls).toHaveLength(2);
    });

    test('should handle null and undefined values in promise detection', () => {
      const nullFn = () => null;
      const undefinedFn = () => undefined;

      const timedNullFn = createTimedFunction('null-test', nullFn, { monitor: mockMonitor });
      const timedUndefinedFn = createTimedFunction('undefined-test', undefinedFn, { monitor: mockMonitor });

      const nullResult = timedNullFn();
      const undefinedResult = timedUndefinedFn();

      expect(nullResult).toBeNull();
      expect(undefinedResult).toBeUndefined();
      expect((timerMock as ReturnType<typeof mock>).mock.calls).toHaveLength(2);
    });

    test('should handle objects with then method that are not promises', () => {
      const thenableFn = () => ({
        then: 'not a function',
        value: 42,
      });

      const timedThenableFn = createTimedFunction('thenable-test', thenableFn, { monitor: mockMonitor });
      const result = timedThenableFn();

      expect(result).toEqual({
        then: 'not a function',
        value: 42,
      });
      expect(timerMock).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    test('should work with class inheritance and method overriding', () => {
      class BaseClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        baseMethod(): string {
          return 'base';
        }
      }

      class DerivedClass extends BaseClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        override baseMethod(): string {
          return 'derived';
        }

        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        derivedMethod(): string {
          return 'new';
        }
      }

      const instance = new DerivedClass();

      const baseResult = instance.baseMethod();
      const derivedResult = instance.derivedMethod();

      expect(baseResult).toBe('derived');
      expect(derivedResult).toBe('new');
      expect((mockMonitor.startTimer as ReturnType<typeof mock>).mock.calls).toHaveLength(2);
    });

    test('should work with static methods', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        static staticMethod(): string {
          return 'static';
        }
      }

      const result = TestClass.staticMethod();

      expect(result).toBe('static');
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('Function.staticMethod');
    });

    test('should handle complex async workflows', async () => {
      class WorkflowClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ budgetMs: 100, monitor: mockMonitor })
        async step1(): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, 1));
          return 'step1-complete';
        }

        // @ts-expect-error - Testing decorator functionality
        @Timed({ budgetMs: 50, monitor: mockMonitor })
        async step2(input: string): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, 1));
          return `${input} -> step2-complete`;
        }
      }

      const workflow = new WorkflowClass();

      const result1 = await workflow.step1();
      const result2 = await workflow.step2(result1);

      expect(result1).toBe('step1-complete');
      expect(result2).toBe('step1-complete -> step2-complete');
      expect(mockMonitor.setBudget).toHaveBeenCalledWith('WorkflowClass.step1', 100, undefined);
      expect(mockMonitor.setBudget).toHaveBeenCalledWith('WorkflowClass.step2', 50, undefined);
    });

    test('should handle nested timed operations', async () => {
      const innerOperation = createTimedFunction(
        'inner-op',
        ((x: number) => x * 2) as (...args: unknown[]) => unknown,
        { monitor: mockMonitor }
      );

      const outerResult = await withTiming(
        'outer-op',
        () => innerOperation(5),
        { monitor: mockMonitor }
      );

      expect(outerResult).toBe(10);
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('inner-op');
      expect(mockMonitor.startTimer).toHaveBeenCalledWith('outer-op');
      expect((timerMock as ReturnType<typeof mock>).mock.calls).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    test('should handle very short operations', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        instantMethod(): number {
          return 42;
        }
      }

      const instance = new TestClass();
      const result = instance.instantMethod();

      expect(result).toBe(42);
      expect(mockMonitor.startTimer).toHaveBeenCalled();
      expect(timerMock).toHaveBeenCalled();
    });

    test('should handle operations with no return value', () => {
      class TestClass {
        sideEffectValue = 0;

        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        voidMethod(): void {
          this.sideEffectValue = 42;
        }
      }

      const instance = new TestClass();
      const result = instance.voidMethod();

      expect(result).toBeUndefined();
      expect(instance.sideEffectValue).toBe(42);
      expect(mockMonitor.startTimer).toHaveBeenCalled();
    });

    test('should handle methods that return functions', () => {
      class TestClass {
        // @ts-expect-error - Testing decorator functionality
        @Timed({ monitor: mockMonitor })
        createFunction(): () => number {
          return () => 42;
        }
      }

      const instance = new TestClass();
      const fn = instance.createFunction();
      const result = fn();

      expect(result).toBe(42);
      expect(mockMonitor.startTimer).toHaveBeenCalled();
    });

    test('should preserve descriptors without value', () => {
      const decorator = Timed({ monitor: mockMonitor });
      const descriptor = { configurable: true, enumerable: true };

      const result = decorator({}, 'method', descriptor as PropertyDescriptor);

      expect(result).toBeUndefined();
    });
  });
});