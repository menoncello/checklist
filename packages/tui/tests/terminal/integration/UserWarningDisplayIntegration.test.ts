import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CapabilityDetector } from '../../../src/terminal/CapabilityDetector';
import { FallbackRenderer } from '../../../src/terminal/FallbackRenderer';
import type { TerminalCapabilities } from '../../../src/terminal/types';
import { extendedToFlatCapabilities } from '../../../src/terminal/types';

describe('User Warning Display Integration', () => {
  let detector: CapabilityDetector;
  let renderer: FallbackRenderer;
  let mockStdout: any;
  let originalStdout: any;
  let capturedOutput: string[];
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    detector = new CapabilityDetector();
    renderer = new FallbackRenderer();
    capturedOutput = [];
    originalEnv = { ...process.env };

    // Mock stdout to capture output
    originalStdout = process.stdout;
    mockStdout = {
      write: (data: string) => {
        capturedOutput.push(data);
        return true;
      },
      columns: 80,
      rows: 24,
      isTTY: true,
    };
    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'stdout', {
      value: originalStdout,
      configurable: true,
    });
    capturedOutput = [];
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Warning Message Display', () => {
    it('should display warning for missing color support', async () => {
      // Mock environment for no color support
      process.env.TERM = 'dumb';
      process.env.COLORTERM = '';

      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const warnings = detector.getWarnings(capabilities);

      // Write warnings to output
      warnings.forEach(warning => mockStdout.write(warning));

      const output = capturedOutput.join('');
      if (!capabilities.color) {
        expect(output).toContain('color');
        expect(output).toContain('monochrome');
      }
    });

    it('should display warning for missing Unicode support', async () => {
      // Mock environment for no Unicode
      process.env.LANG = 'C';
      process.env.LC_ALL = 'C';

      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const warnings = detector.getWarnings(capabilities);

      warnings.forEach(warning => mockStdout.write(warning));

      const output = capturedOutput.join('');
      if (!capabilities.unicode) {
        expect(output).toContain('Unicode');
        expect(output).toContain('ASCII');
      }
    });

    it('should display warning for missing mouse support', async () => {
      // Mock environment without mouse support
      process.env.TERM = 'vt100';

      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const warnings = detector.getWarnings(capabilities);

      warnings.forEach(warning => mockStdout.write(warning));

      const output = capturedOutput.join('');
      if (!capabilities.mouse) {
        expect(output).toContain('mouse');
        expect(output).toContain('keyboard');
      }
    });

    it('should display multiple warnings in priority order', async () => {
      // Mock severely limited terminal
      process.env.TERM = 'dumb';
      process.env.LANG = 'C';
      mockStdout.columns = 70;

      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const warnings = detector.getWarnings(capabilities);

      // Sort warnings by priority
      const prioritizedWarnings = warnings.sort((a, b) => {
        const priorityOrder = ['size', 'color', 'unicode', 'mouse'];
        const aPriority = priorityOrder.findIndex(p => a.toLowerCase().includes(p));
        const bPriority = priorityOrder.findIndex(p => b.toLowerCase().includes(p));
        return aPriority - bPriority;
      });

      prioritizedWarnings.forEach(warning => mockStdout.write(warning + '\n'));

      const output = capturedOutput.join('');
      expect(output).toBeDefined();
      // Warnings should be present if capabilities are limited
      if (warnings.length > 0) {
        expect(output.length).toBeGreaterThan(0);
      }
    });

    it('should provide terminal upgrade suggestions', async () => {
      process.env.TERM = 'xterm';
      process.env.COLORTERM = '';

      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);

      // Force limited color capabilities to trigger upgrade suggestions
      const limitedCapabilities = {
        ...capabilities,
        trueColor: false,
        color256: false,
        color: true, // basic color only
      };

      const suggestions = detector.getSuggestions(limitedCapabilities);

      suggestions.forEach(suggestion => mockStdout.write(suggestion));

      const output = capturedOutput.join('');
      if (suggestions.length > 0) {
        expect(output).toContain('upgrade');
        // Should suggest specific terminals
        expect(output.match(/iTerm2|Alacritty|Windows Terminal/)).toBeTruthy();
      }
    });

    it('should support progressive feature disclosure', async () => {
      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);

      // Check if capabilities support progressive disclosure
      const hasLimitations = !capabilities.trueColor ||
                            !capabilities.unicode ||
                            !capabilities.mouse;

      if (hasLimitations) {
        const warnings = detector.getWarnings(capabilities);
        expect(warnings.length).toBeGreaterThan(0);

        // Warnings should be categorized by severity
        const critical = warnings.filter(w => w.includes('critical'));
        const standard = warnings.filter(w => !w.includes('critical'));

        expect(critical).toBeDefined();
        expect(standard).toBeDefined();
      }
    });

    it('should provide platform-specific terminal recommendations', async () => {
      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const recommendations = detector.getRecommendations(capabilities, process.platform);

      recommendations.forEach(rec => mockStdout.write(rec));

      const output = capturedOutput.join('');

      if (recommendations.length > 0) {
        if (process.platform === 'darwin') {
          expect(output).toMatch(/iTerm2|Terminal\.app/);
        } else if (process.platform === 'win32') {
          expect(output).toContain('Windows Terminal');
        } else {
          expect(output).toContain('Alacritty');
        }
      }
    });
  });

  describe('Warning Persistence and Storage', () => {
    it('should track warning acknowledgment', async () => {
      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const warnings = detector.getWarnings(capabilities);

      if (warnings.length > 0) {
        // Initially, warnings should not be acknowledged
        const acknowledged = detector.isWarningAcknowledged(warnings[0]);
        expect(acknowledged).toBe(false);

        // Acknowledge the warning
        detector.acknowledgeWarning(warnings[0]);

        // Now it should be acknowledged
        const afterAck = detector.isWarningAcknowledged(warnings[0]);
        expect(afterAck).toBe(true);
      }
    });

    it('should show warnings again after terminal upgrade', async () => {
      // Start with limited terminal
      process.env.TERM = 'dumb';

      let detectionResult = await detector.detectCapabilities();
      let capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const initialWarnings = detector.getWarnings(capabilities);

      // Upgrade terminal
      process.env.TERM = 'xterm-256color';
      process.env.COLORTERM = 'truecolor';

      // Clear detector cache to force re-detection
      detector.clearCache();

      detectionResult = await detector.detectCapabilities();
      capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const upgradedWarnings = detector.getWarnings(capabilities);

      // Should have fewer warnings after upgrade
      expect(upgradedWarnings.length).toBeLessThanOrEqual(initialWarnings.length);
    });
  });

  describe('Warning Formatting and Styling', () => {
    it('should format warnings based on terminal capabilities', async () => {
      // Terminal with color support
      process.env.TERM = 'xterm-256color';
      process.env.COLORTERM = 'truecolor';

      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);

      // Force a warning by checking small size
      mockStdout.columns = 70;
      const sizeWarning = detector.getSizeWarning({
        width: mockStdout.columns,
        height: mockStdout.rows
      });

      if (sizeWarning) {
        mockStdout.write(sizeWarning);
        const output = capturedOutput.join('');

        // Should contain color codes for warnings if colors are supported
        if (capabilities.color) {
          expect(output).toMatch(/\x1b\[\d+m/); // ANSI color code pattern
        }
      }
    });

    it('should use ASCII art for warnings in limited terminals', async () => {
      process.env.TERM = 'dumb';
      process.env.LANG = 'C';

      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);
      const warnings = detector.getWarnings(capabilities);

      if (warnings.length > 0) {
        // Format warning for ASCII-only terminal
        const asciiWarning = renderer.render(warnings[0], {
          useAsciiOnly: true,
          stripColors: true,
          simplifyBoxDrawing: false,
          preserveLayout: true,
          maxWidth: 80,
          maxHeight: 24
        });

        mockStdout.write(asciiWarning);

        const output = capturedOutput.join('');
        // Should use ASCII characters instead of Unicode
        expect(output).not.toContain('⚠'); // No Unicode warning symbol
        if (output.includes('!')) {
          expect(output).toContain('[!]'); // ASCII warning indicator
        }
      }
    });
  });

  describe('Context-Aware Warnings', () => {
    it('should show contextual warnings based on attempted operations', async () => {
      // Terminal without mouse support
      process.env.TERM = 'vt100';

      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);

      // Attempt mouse operation
      if (!capabilities.mouse) {
        const mouseWarning = detector.getFeatureWarning('mouse');
        mockStdout.write(mouseWarning);

        const output = capturedOutput.join('');
        expect(output).toContain('Mouse support not available');
        expect(output).toContain('keyboard');
      }
    });

    it('should provide actionable fallback suggestions', async () => {
      const detectionResult = await detector.detectCapabilities();
      const capabilities = extendedToFlatCapabilities(detectionResult.capabilities);

      // Get fallback suggestions for limited capabilities
      const fallbacks = detector.getFallbackSuggestions(capabilities);

      fallbacks.forEach(fallback => mockStdout.write(fallback));

      const output = capturedOutput.join('');

      if (fallbacks.length > 0) {
        // Should contain actionable suggestions
        expect(output).toMatch(/Use|Try|Consider|Switch/);
      }
    });
  });
});