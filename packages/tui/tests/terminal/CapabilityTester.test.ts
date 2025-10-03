import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { CapabilityTester } from '@checklist/tui/src/terminal/CapabilityTester';
import { TerminalInfo } from '@checklist/tui/src/terminal/TerminalInfo';
import { ColorSupport } from '@checklist/tui/src/terminal/ColorSupport';
import { type CapabilityTest } from '@checklist/tui/src/terminal/types';

// Mock dependencies
const mockTerminalInfo = {
  supportsColor: mock(() => true),
  getTerminalType: mock(() => 'xterm-256color'),
};

const mockColorSupport = {
  detectBasicColor: mock(() => true),
  detect256Color: mock(() => true),
  detectTrueColor: mock(() => true),
};

describe('CapabilityTester', () => {
  let capabilityTester: CapabilityTester;

  beforeEach(() => {
    capabilityTester = new CapabilityTester(mockTerminalInfo as any, mockColorSupport as any);

    // Reset all mocks
    mockTerminalInfo.supportsColor.mockRestore();
    mockTerminalInfo.getTerminalType.mockRestore();
    mockColorSupport.detectBasicColor.mockRestore();
    mockColorSupport.detect256Color.mockRestore();
    mockColorSupport.detectTrueColor.mockRestore();
  });

  describe('constructor', () => {
    it('should create instance with provided dependencies', () => {
      expect(capabilityTester).toBeDefined();
      expect(capabilityTester).toBeInstanceOf(CapabilityTester);
    });

    it('should store dependencies as instance properties', () => {
      const terminalInfo = (capabilityTester as any).terminalInfo;
      const colorSupport = (capabilityTester as any).colorSupport;

      expect(terminalInfo).toBe(mockTerminalInfo);
      expect(colorSupport).toBe(mockColorSupport);
    });
  });

  describe('createCapabilityTests', () => {
    it('should return array of capability tests', () => {
      const tests = capabilityTester.createCapabilityTests();

      expect(Array.isArray(tests)).toBe(true);
      expect(tests.length).toBeGreaterThan(0);
    });

    it('should include color tests', () => {
      const tests = capabilityTester.createCapabilityTests();
      const colorTests = tests.filter(test =>
        test.name === 'color' || test.name === 'color256' || test.name === 'trueColor'
      );

      expect(colorTests.length).toBe(3);
      colorTests.forEach(test => {
        expect(test.fallback).toBe(false);
        expect(test.timeout).toBe(1000);
        expect(typeof test.description).toBe('string');
        expect(typeof test.test).toBe('function');
      });
    });

    it('should include UI tests', () => {
      const tests = capabilityTester.createCapabilityTests();
      const uiTests = tests.filter(test =>
        test.name === 'unicode' || test.name === 'mouse' || test.name === 'cursorShape'
      );

      expect(uiTests.length).toBe(3);
      const unicodeTest = tests.find(test => test.name === 'unicode');
      expect(unicodeTest?.fallback).toBe(true);
    });

    it('should include terminal feature tests', () => {
      const tests = capabilityTester.createCapabilityTests();
      const featureTests = tests.filter(test =>
        test.name === 'altScreen' || test.name === 'windowTitle' || test.name === 'clipboard'
      );

      expect(featureTests.length).toBe(3);
      featureTests.forEach(test => {
        expect(test.fallback).toBe(false);
        expect(typeof test.timeout).toBe('number');
        expect(typeof test.test).toBe('function');
      });
    });

    it('should have all required test properties', () => {
      const tests = capabilityTester.createCapabilityTests();

      tests.forEach(test => {
        expect(test).toHaveProperty('name');
        expect(test).toHaveProperty('test');
        expect(test).toHaveProperty('fallback');
        expect(test).toHaveProperty('timeout');
        expect(test).toHaveProperty('description');
        expect(typeof test.name).toBe('string');
        expect(typeof test.test).toBe('function');
        expect(typeof test.fallback).toBe('boolean');
        expect(typeof test.timeout).toBe('number');
        expect(typeof test.description).toBe('string');
      });
    });
  });

  describe('runTestWithTimeout', () => {
    it('should execute test successfully within timeout', async () => {
      const test: CapabilityTest = {
        name: 'test',
        test: async () => true,
        fallback: false,
        timeout: 1000,
        description: 'test'
      };

      const result = await capabilityTester.runTestWithTimeout(test);
      expect(result).toBe(true);
    });

    it('should handle test failure', async () => {
      const test: CapabilityTest = {
        name: 'test',
        test: async () => false,
        fallback: false,
        timeout: 1000,
        description: 'test'
      };

      const result = await capabilityTester.runTestWithTimeout(test);
      expect(result).toBe(false);
    });

    it('should timeout slow tests', async () => {
      const test: CapabilityTest = {
        name: 'test',
        test: () => new Promise(() => {}), // Never resolves
        fallback: false,
        timeout: 10,
        description: 'test'
      };

      const result = await capabilityTester.runTestWithTimeout(test);
      expect(result).toBe(false);
    });

    it('should use default timeout if not specified', async () => {
      const test: CapabilityTest = {
        name: 'test',
        test: async () => true,
        fallback: false,
        timeout: undefined,
        description: 'test'
      };

      const result = await capabilityTester.runTestWithTimeout(test);
      expect(result).toBe(true);
    });
  });

  describe('color support tests', () => {
    beforeEach(() => {
      mockTerminalInfo.supportsColor.mockReturnValue(true);
      mockColorSupport.detectBasicColor.mockReturnValue(true);
      mockColorSupport.detect256Color.mockReturnValue(true);
      mockColorSupport.detectTrueColor.mockReturnValue(true);
      mockTerminalInfo.getTerminalType.mockReturnValue('xterm-256color');
    });

    it('should test basic color support using colorSupport detector', async () => {
      mockColorSupport.detectBasicColor.mockReturnValue(true);

      const method = (capabilityTester as any).testColorSupport.bind(capabilityTester);
      const result = await method();

      expect(result).toBe(true);
      expect(mockColorSupport.detectBasicColor).toHaveBeenCalled();
    });

    it('should fallback to terminalInfo when colorSupport returns null', async () => {
      (mockColorSupport.detectBasicColor as any).mockReturnValue(null);
      mockTerminalInfo.supportsColor.mockReturnValue(true);

      const method = (capabilityTester as any).testColorSupport.bind(capabilityTester);
      const result = await method();

      expect(result).toBe(true);
      expect(mockTerminalInfo.supportsColor).toHaveBeenCalled();
    });

    it('should test 256 color support using colorSupport detector', async () => {
      mockColorSupport.detect256Color.mockReturnValue(true);

      const method = (capabilityTester as any).testColor256Support.bind(capabilityTester);
      const result = await method();

      expect(result).toBe(true);
      expect(mockColorSupport.detect256Color).toHaveBeenCalled();
    });

    it('should fallback to terminal type for 256 color detection', async () => {
      (mockColorSupport.detect256Color as any).mockReturnValue(null);
      mockTerminalInfo.getTerminalType.mockReturnValue('xterm-256color');

      const method = (capabilityTester as any).testColor256Support.bind(capabilityTester);
      const result = await method();

      expect(result).toBe(true);
    });

    it('should detect xterm as supporting 256 colors', async () => {
      (mockColorSupport.detect256Color as any).mockReturnValue(null);
      mockTerminalInfo.getTerminalType.mockReturnValue('xterm');

      const method = (capabilityTester as any).testColor256Support.bind(capabilityTester);
      const result = await method();

      expect(result).toBe(true);
    });

    it('should test true color support using colorSupport detector', async () => {
      mockColorSupport.detectTrueColor.mockReturnValue(true);

      const method = (capabilityTester as any).testTrueColorSupport.bind(capabilityTester);
      const result = await method();

      expect(result).toBe(true);
      expect(mockColorSupport.detectTrueColor).toHaveBeenCalled();
    });

    it('should query terminal for true color support when detector returns null', async () => {
      (mockColorSupport.detectTrueColor as any).mockReturnValue(null);

      // Mock the queryTerminalCapability method
      const querySpy = spyOn(capabilityTester as any, 'queryTerminalCapability').mockResolvedValue(true);

      const method = (capabilityTester as any).testTrueColorSupport.bind(capabilityTester);
      const result = await method();

      expect(result).toBe(true);
      expect(querySpy).toHaveBeenCalledWith('\x1b[48;2;1;2;3m\x1b[0m', 1000);
    });
  });

  describe('Unicode support tests', () => {
    it('should detect Unicode support via public interface', async () => {
      const tests = capabilityTester.createCapabilityTests();
      const unicodeTest = tests.find(t => t.name === 'unicode');
      expect(unicodeTest).toBeDefined();
      expect(unicodeTest?.fallback).toBe(true);

      const result = await capabilityTester.runTestWithTimeout(unicodeTest!);
      expect(typeof result).toBe('boolean');
    });

    it('should test Unicode support with UTF-8 environment', async () => {
      const originalLang = Bun.env.LANG;
      Bun.env.LANG = 'en_US.UTF-8';

      const tests = capabilityTester.createCapabilityTests();
      const unicodeTest = tests.find(t => t.name === 'unicode');

      const result = await capabilityTester.runTestWithTimeout(unicodeTest!);
      expect(result).toBe(true);

      // Restore
      Bun.env.LANG = originalLang;
    });

    it('should test Unicode support with non-UTF-8 environment', async () => {
      const originalLang = Bun.env.LANG;
      Bun.env.LANG = 'en_US.ISO-8859-1';

      const tests = capabilityTester.createCapabilityTests();
      const unicodeTest = tests.find(t => t.name === 'unicode');

      const result = await capabilityTester.runTestWithTimeout(unicodeTest!);
      expect(typeof result).toBe('boolean');

      // Restore
      Bun.env.LANG = originalLang;
    });

    it('should handle Unicode support test errors gracefully', async () => {
      const originalBufferFrom = Buffer.from;
      Buffer.from = mock(() => {
        throw new Error('Mock error');
      });

      const tests = capabilityTester.createCapabilityTests();
      const unicodeTest = tests.find(t => t.name === 'unicode');

      const result = await capabilityTester.runTestWithTimeout(unicodeTest!);
      expect(typeof result).toBe('boolean');

      // Restore
      Buffer.from = originalBufferFrom;
    });

    it('should use fallback mode for Unicode test', async () => {
      const tests = capabilityTester.createCapabilityTests();
      const unicodeTest = tests.find(t => t.name === 'unicode');

      expect(unicodeTest?.fallback).toBe(true);
    });
  });

  describe('mouse support tests', () => {
    it('should create mouse test with correct configuration', () => {
      const tests = capabilityTester.createCapabilityTests();
      const mouseTest = tests.find(t => t.name === 'mouse');
      expect(mouseTest).toBeDefined();
      expect(mouseTest?.fallback).toBe(false);
      expect(mouseTest?.timeout).toBe(2000);
    });

    it('should test mouse support via public interface', async () => {
      mockTerminalInfo.getTerminalType.mockReturnValue('xterm');

      const tests = capabilityTester.createCapabilityTests();
      const mouseTest = tests.find(t => t.name === 'mouse');

      const result = await capabilityTester.runTestWithTimeout(mouseTest!);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('alternate screen support tests', () => {
    it('should return true for capable terminals without querying', async () => {
      mockTerminalInfo.getTerminalType.mockReturnValue('xterm');

      const tests = capabilityTester.createCapabilityTests();
      const altScreenTest = tests.find(t => t.name === 'altScreen')!;
      const result = await capabilityTester.runTestWithTimeout(altScreenTest);

      expect(result).toBe(true);
    });

    it('should query terminal for alternate screen support when needed', async () => {
      mockTerminalInfo.getTerminalType.mockReturnValue('vt100');

      const tests = capabilityTester.createCapabilityTests();
      const altScreenTest = tests.find(t => t.name === 'altScreen')!;
      const result = await capabilityTester.runTestWithTimeout(altScreenTest);

      expect(result).toBe(false);
    });
  });

  describe('cursor shape support tests', () => {
    it('should detect cursor shape capable terminals', async () => {
      const terminals = ['xterm', 'gnome-terminal', 'alacritty', 'kitty'];

      for (const terminal of terminals) {
        mockTerminalInfo.getTerminalType.mockReturnValue(terminal);

        const tests = capabilityTester.createCapabilityTests();
        const cursorTest = tests.find(t => t.name === 'cursorShape')!;
        const result = await capabilityTester.runTestWithTimeout(cursorTest);

        expect(result).toBe(true);
      }
    });

    it('should return false for non-capable terminals', async () => {
      mockTerminalInfo.getTerminalType.mockReturnValue('vt100');

      const tests = capabilityTester.createCapabilityTests();
      const cursorTest = tests.find(t => t.name === 'cursorShape')!;
      const result = await capabilityTester.runTestWithTimeout(cursorTest);

      expect(result).toBe(false);
    });
  });

  describe('window title support tests', () => {
    it('should return false for SSH sessions', async () => {
      const originalSSHConnection = Bun.env.SSH_CONNECTION;
      Bun.env.SSH_CONNECTION = '192.168.1.100 12345 192.168.1.1 22';

      const tests = capabilityTester.createCapabilityTests();
      const windowTitleTest = tests.find(t => t.name === 'windowTitle')!;
      const result = await capabilityTester.runTestWithTimeout(windowTitleTest);

      expect(result).toBe(false);

      // Restore
      Bun.env.SSH_CONNECTION = originalSSHConnection;
    });

    it('should detect SSH session via SSH_TTY', async () => {
      const originalSSHTTY = Bun.env.SSH_TTY;
      Bun.env.SSH_TTY = '/dev/pts/0';

      const tests = capabilityTester.createCapabilityTests();
      const windowTitleTest = tests.find(t => t.name === 'windowTitle')!;
      const result = await capabilityTester.runTestWithTimeout(windowTitleTest);

      expect(result).toBe(false);

      // Restore
      Bun.env.SSH_TTY = originalSSHTTY;
    });

    it('should detect window title capable terminals', async () => {
      const terminals = ['xterm', 'gnome-terminal', 'alacritty'];

      for (const terminal of terminals) {
        mockTerminalInfo.getTerminalType.mockReturnValue(terminal);

        const tests = capabilityTester.createCapabilityTests();
        const windowTitleTest = tests.find(t => t.name === 'windowTitle')!;
        const result = await capabilityTester.runTestWithTimeout(windowTitleTest);

        expect(result).toBe(true);
      }
    });
  });

  describe('clipboard support tests', () => {
    it('should detect clipboard capable terminals', async () => {
      const terminals = ['xterm', 'alacritty', 'kitty', 'wezterm'];

      for (const terminal of terminals) {
        mockTerminalInfo.getTerminalType.mockReturnValue(terminal);

        const tests = capabilityTester.createCapabilityTests();
        const clipboardTest = tests.find(t => t.name === 'clipboard')!;
        const result = await capabilityTester.runTestWithTimeout(clipboardTest);

        expect(result).toBe(true);
      }
    });

    it('should return false for non-capable terminals', async () => {
      mockTerminalInfo.getTerminalType.mockReturnValue('vt100');

      const tests = capabilityTester.createCapabilityTests();
      const clipboardTest = tests.find(t => t.name === 'clipboard')!;
      const result = await capabilityTester.runTestWithTimeout(clipboardTest);

      expect(result).toBe(false);
    });
  });

  describe('terminal query methods', () => {
    describe('queryTerminalCapability', () => {
      it('should return false when TTY is not available', async () => {
        // Mock the isTTYAvailable method to return false
        const isTTYSpy = spyOn(capabilityTester as any, 'isTTYAvailable').mockReturnValue(false);

        const method = (capabilityTester as any).queryTerminalCapability.bind(capabilityTester);
        const result = await method('test', 100);

        expect(result).toBe(false);

        // Restore
        isTTYSpy.mockRestore();
      });

      it('should perform terminal query when TTY is available', async () => {
        // Mock isTTYAvailable to return true
        const isTTYSpy = spyOn(capabilityTester as any, 'isTTYAvailable').mockReturnValue(true);
        const performQuerySpy = spyOn(capabilityTester as any, 'performTerminalQuery').mockResolvedValue(true);

        const method = (capabilityTester as any).queryTerminalCapability.bind(capabilityTester);
        const result = method('test', 100);

        expect(result).toBeInstanceOf(Promise);
        const resolvedResult = await result;
        expect(resolvedResult).toBe(true);

        // Restore
        isTTYSpy.mockRestore();
        performQuerySpy.mockRestore();
      });
    });

    describe('isTTYAvailable', () => {
      it('should return boolean based on current TTY state', () => {
        const method = (capabilityTester as any).isTTYAvailable.bind(capabilityTester);
        const result = method();

        // In test environment, this should return false
        expect(typeof result).toBe('boolean');
        expect(result).toBe(process.stdin.isTTY === true && process.stdout.isTTY === true);
      });

      it('should match expected logic for TTY detection', () => {
        const method = (capabilityTester as any).isTTYAvailable.bind(capabilityTester);
        const result = method();

        // Test the actual logic: both stdin and stdout must be TTY
        const expectedResult = process.stdin.isTTY === true && process.stdout.isTTY === true;
        expect(result).toBe(expectedResult);
      });
    });
  });

  describe('terminal query execution', () => {
    let originalStdin: any;
    let originalStdout: any;

    beforeEach(() => {
      originalStdin = process.stdin;
      originalStdout = process.stdout;
    });

    afterEach(() => {
      process.stdin = originalStdin;
      process.stdout = originalStdout;
    });

    it('should execute terminal query with proper setup', async () => {
      const mockStdin = {
        isTTY: true,
        on: mock((event: string, handler: Function) => {}),
        off: mock((event: string, handler: Function) => {}),
      };

      const mockStdout = {
        isTTY: true,
        write: mock((data: string) => {}),
      };

      process.stdin = mockStdin as any;
      process.stdout = mockStdout as any;

      const method = (capabilityTester as any).performTerminalQuery.bind(capabilityTester);
      const result = await method('test', 100);

      expect(result).toBe(false); // Times out by default
      expect(mockStdout.write).toHaveBeenCalledWith('test');
    });

    it('should handle query timeout properly', async () => {
      // Mock setTimeout to simulate timeout
      const originalSetTimeout = global.setTimeout;
      let timeoutCallback: (() => void) | null = null;

      // Type assertion for setTimeout mock - convert through unknown for compatibility
      const mockSetTimeout = mock((callback: () => void, delay: number): NodeJS.Timeout => {
        timeoutCallback = callback;
        return { ref: () => {}, unref: () => {} } as NodeJS.Timeout;
      }) as unknown as typeof setTimeout;
      global.setTimeout = mockSetTimeout;

      const mockStdin = {
        isTTY: true,
        on: mock((event: string, handler: Function) => {}),
        off: mock((event: string, handler: Function) => {}),
      };

      const mockStdout = {
        isTTY: true,
        write: mock((data: string) => {}),
      };

      process.stdin = mockStdin as any;
      process.stdout = mockStdout as any;

      const method = (capabilityTester as any).performTerminalQuery.bind(capabilityTester);
      const promise = method('test', 100);

      // Simulate timeout - assert non-null since we know the mock was called
      if (timeoutCallback) {
        (timeoutCallback as unknown as () => void)();
      }

      const result = await promise;
      expect(result).toBe(false);

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('cleanup methods', () => {
    let mockStdin: any;

    beforeEach(() => {
      mockStdin = {
        isTTY: true,
        on: mock((event: string, handler: Function) => {}),
        off: mock((event: string, handler: Function) => {}),
      };
      process.stdin = mockStdin as any;
    });

    afterEach(() => {
      process.stdin = mockStdin;
    });

    it('should cleanup query properly', () => {
      const handler = mock(() => {});

      const method = (capabilityTester as any).cleanupQuery.bind(capabilityTester);
      method(handler);

      expect(mockStdin.off).toHaveBeenCalledWith('data', handler);
    });
  });
});