import { describe, test, expect, beforeEach, mock} from 'bun:test';
import { CapabilityDetector } from '../../src/terminal/CapabilityDetector';
import { TerminalTestHarness } from '../../src/terminal/TerminalTestHarness';
import { FallbackRenderer} from '../../src/terminal/FallbackRenderer';
import type { TerminalCapabilities} from '../../src/framework/UIFramework';
describe('Warning Messages Display', () => {
  describe('User-Facing Warning System', () => {
    let detector: CapabilityDetector;
    let harness: TerminalTestHarness;
    let renderer: FallbackRenderer;

    beforeEach(() => {
      detector = new CapabilityDetector();
      harness = new TerminalTestHarness();
      renderer = new FallbackRenderer();
    });

    test('should display warnings for missing color support', async () => {
      const capabilities: TerminalCapabilities = {
        color: false,
        color256: false,
        trueColor: false,
        unicode: true,
        mouse: false,
        altScreen: false,
        cursorShape: false,
      };

      const warnings = renderer.getCompatibilityWarnings(capabilities);

      expect(warnings.some(w => w.includes('Limited color support'))).toBe(true);
      expect(warnings.some(w => w.includes('monochrome'))).toBe(true);
    });

    test('should display warnings for missing Unicode support', async () => {
      const capabilities: TerminalCapabilities = {
        color: true,
        color256: true,
        trueColor: false,
        unicode: false,
        mouse: false,
        altScreen: false,
        cursorShape: false,
      };

      const warnings = renderer.getCompatibilityWarnings(capabilities);

      expect(warnings.some(w => w.includes('Limited Unicode support'))).toBe(true);
      expect(warnings.some(w => w.includes('Box drawing characters'))).toBe(true);
    });

    test('should display warnings for limited terminal features', async () => {
      const capabilities: TerminalCapabilities = {
        color: true,
        color256: false, // Limited to basic colors
        trueColor: false,
        unicode: true,
        mouse: false, // No mouse support
        altScreen: false,
        cursorShape: false,
      };

      const warnings = renderer.getCompatibilityWarnings(capabilities);

      expect(warnings.some(w => w.includes('Mouse input unavailable'))).toBe(true);
      expect(warnings.some(w => w.includes('Use keyboard navigation'))).toBe(true);
    });

    test('should provide terminal upgrade suggestions', async () => {
      const terminalInfo = detector.getTerminalInfo();
      const terminalType = terminalInfo.getTerminalType();
      const capabilities = await detector.getCapabilities();

      const suggestions = getUpgradeSuggestions(terminalType, capabilities);

      if (!capabilities.trueColor && terminalType === 'Terminal.app') {
        expect(suggestions).toContain('Consider upgrading to iTerm2 for better color support');
      }

      if (!capabilities.mouse) {
        expect(suggestions).toContain('Enable mouse reporting in terminal preferences');
      }

      if (!capabilities.unicode) {
        expect(suggestions).toContain('Install a Unicode-capable font');
        expect(suggestions).toContain('Configure UTF-8 encoding');
      }
    });

    test('should implement progressive feature disclosure', async () => {
      const capabilities: TerminalCapabilities = {
        color: true,
        color256: true,
        trueColor: true,
        unicode: true,
        mouse: true,
        altScreen: false, // Missing feature
        cursorShape: false, // Missing feature
      };

      const disclosedFeatures = getProgressiveFeatures(capabilities);

      // Should show available features positively
      expect(disclosedFeatures.available).toContain('✓ Full color support (24-bit)');
      expect(disclosedFeatures.available).toContain('✓ Unicode rendering');
      expect(disclosedFeatures.available).toContain('✓ Mouse interaction');

      // Should mention missing features as optional enhancements
      expect(disclosedFeatures.optional).toContain('○ Alternate screen buffer (optional)');
      expect(disclosedFeatures.optional).toContain('○ Cursor shape control (optional)');
    });

    test('should display warnings in TUI header/footer', () => {
      const mockUI = {
        header: mock((content: string) => {}),
        footer: mock((content: string) => {}),
        notification: mock((message: string, type: string) => {}),
      };

      const capabilities: TerminalCapabilities = {
        color: false,
        color256: false,
        trueColor: false,
        unicode: false,
        mouse: false,
        altScreen: false,
        cursorShape: false,
      };

      const warnings = renderer.getCompatibilityWarnings(capabilities);

      // Display critical warnings in footer
      if (warnings.length > 0) {
        const criticalWarning = warnings[0];
        mockUI.footer(criticalWarning);
        mockUI.notification('Limited terminal capabilities detected', 'warning');
      }

      expect(mockUI.footer).toHaveBeenCalledWith(expect.stringContaining('⚠'));
      expect(mockUI.notification).toHaveBeenCalledWith(
        'Limited terminal capabilities detected',
        'warning'
      );
    });

    test('should prioritize warnings by severity', async () => {
      const capabilities: TerminalCapabilities = {
        color: false, // High priority
        color256: false,
        trueColor: false,
        unicode: false, // High priority
        mouse: false, // Low priority
        altScreen: false, // Low priority
        cursorShape: false, // Low priority
      };

      const prioritizedWarnings = getPrioritizedWarnings(capabilities);

      // High priority warnings should come first
      expect(prioritizedWarnings[0]).toContain('color');
      expect(prioritizedWarnings[1]).toContain('Unicode');

      // Low priority warnings should come later
      const mouseWarningIndex = prioritizedWarnings.findIndex(w => w.includes('Mouse'));
      expect(mouseWarningIndex).toBeGreaterThan(1);
    });

    test('should provide actionable remediation steps', async () => {
      const capabilities: TerminalCapabilities = {
        color: false,
        color256: false,
        trueColor: false,
        unicode: true,
        mouse: false,
        altScreen: false,
        cursorShape: false,
      };

      const remediation = getRemediationSteps(capabilities);

      expect(remediation.colorFix).toEqual({
        problem: 'No color support',
        solution: 'Set TERM=xterm-256color',
        command: 'export TERM=xterm-256color',
        permanent: 'Add to ~/.bashrc or ~/.zshrc',
      });

      expect(remediation.mouseFix).toEqual({
        problem: 'Mouse input disabled',
        solution: 'Enable mouse reporting',
        terminalSpecific: expect.any(Object),
      });
    });

    test('should handle warning dismissal and persistence', () => {
      const warningState = {
        dismissed: new Set<string>(),
        shown: new Map<string, number>(),
      };

      const warning = 'no-unicode-support';

      // First display
      if (!warningState.dismissed.has(warning)) {
        warningState.shown.set(warning, Date.now());
        expect(warningState.shown.has(warning)).toBe(true);
      }

      // User dismisses warning
      warningState.dismissed.add(warning);
      warningState.shown.delete(warning);

      // Warning should not show again
      if (!warningState.dismissed.has(warning)) {
        warningState.shown.set(warning, Date.now());
      }

      expect(warningState.shown.has(warning)).toBe(false);
      expect(warningState.dismissed.has(warning)).toBe(true);
    });

    test('should integrate with debug overlay for detailed info', () => {
      const debugInfo = {
        terminalType: 'xterm',
        capabilities: {
          color: false,
          unicode: false,
        },
        warnings: [] as string[],
        suggestions: [] as string[],
      };

      // Populate debug information
      if (!debugInfo.capabilities.color) {
        debugInfo.warnings.push('Color support missing');
        debugInfo.suggestions.push('Try TERM=xterm-256color');
      }

      if (!debugInfo.capabilities.unicode) {
        debugInfo.warnings.push('Unicode support missing');
        debugInfo.suggestions.push('Set LC_ALL=en_US.UTF-8');
      }

      expect(debugInfo.warnings).toHaveLength(2);
      expect(debugInfo.suggestions).toHaveLength(2);
      expect(debugInfo.warnings).toContain('Color support missing');
      expect(debugInfo.suggestions).toContain('Try TERM=xterm-256color');
    });

    test('should display terminal recommendation based on platform', () => {
      const platform = process.platform;
      const recommendations = getTerminalRecommendations(platform);

      if (platform === 'darwin') {
        expect(recommendations).toContain('iTerm2');
        expect(recommendations).toContain('Alacritty');
      } else if (platform === 'win32') {
        expect(recommendations).toContain('Windows Terminal');
        expect(recommendations).toContain('Alacritty');
      } else {
        expect(recommendations).toContain('Alacritty');
        expect(recommendations).toContain('Kitty');
      }
    });
  });

  // Helper functions for testing
  function getUpgradeSuggestions(
    terminalType: string,
    capabilities: TerminalCapabilities
  ): string[] {
    const suggestions: string[] = [];

    if (!capabilities.trueColor && terminalType === 'Terminal.app') {
      suggestions.push('Consider upgrading to iTerm2 for better color support');
    }

    if (!capabilities.mouse) {
      suggestions.push('Enable mouse reporting in terminal preferences');
    }

    if (!capabilities.unicode) {
      suggestions.push('Install a Unicode-capable font');
      suggestions.push('Configure UTF-8 encoding');
    }

    return suggestions;
  }

  function getProgressiveFeatures(capabilities: TerminalCapabilities): {
    available: string[];
    optional: string[];
  } {
    const available: string[] = [];
    const optional: string[] = [];

    if (capabilities.trueColor) {
      available.push('✓ Full color support (24-bit)');
    } else if (capabilities.color256) {
      available.push('✓ 256 color support');
    } else if (capabilities.color) {
      available.push('✓ Basic color support');
    }

    if (capabilities.unicode) {
      available.push('✓ Unicode rendering');
    }

    if (capabilities.mouse) {
      available.push('✓ Mouse interaction');
    }

    if (!capabilities.altScreen) {
      optional.push('○ Alternate screen buffer (optional)');
    }

    if (!capabilities.cursorShape) {
      optional.push('○ Cursor shape control (optional)');
    }

    return { available, optional };
  }

  function getPrioritizedWarnings(capabilities: TerminalCapabilities): string[] {
    const warnings: Array<{ message: string; priority: number }> = [];

    if (!capabilities.color) {
      warnings.push({ message: '⚠ No color support detected', priority: 1 });
    }

    if (!capabilities.unicode) {
      warnings.push({ message: '⚠ Unicode not supported', priority: 1 });
    }

    if (!capabilities.mouse) {
      warnings.push({ message: '⚠ Mouse input not available', priority: 3 });
    }

    if (!capabilities.altScreen) {
      warnings.push({ message: '○ Alternate screen not available', priority: 4 });
    }

    return warnings
      .sort((a, b) => a.priority - b.priority)
      .map((w) => w.message);
  }

  function getRemediationSteps(capabilities: TerminalCapabilities): any {
    const steps: any = {};

    if (!capabilities.color) {
      steps.colorFix = {
        problem: 'No color support',
        solution: 'Set TERM=xterm-256color',
        command: 'export TERM=xterm-256color',
        permanent: 'Add to ~/.bashrc or ~/.zshrc',
      };
    }

    if (!capabilities.mouse) {
      steps.mouseFix = {
        problem: 'Mouse input disabled',
        solution: 'Enable mouse reporting',
        terminalSpecific: {
          iTerm2: 'Preferences > Profiles > Terminal > Enable mouse reporting',
          Terminal: 'Preferences > Profiles > Keyboard > Use mouse',
          Alacritty: 'Enabled by default',
        },
      };
    }

    return steps;
  }

  function getTerminalRecommendations(platform: string): string[] {
    const recommendations: string[] = [];

    if (platform === 'darwin') {
      recommendations.push('iTerm2');
      recommendations.push('Alacritty');
      recommendations.push('Kitty');
    } else if (platform === 'win32') {
      recommendations.push('Windows Terminal');
      recommendations.push('Alacritty');
    } else {
      recommendations.push('Alacritty');
      recommendations.push('Kitty');
      recommendations.push('Terminator');
    }

    return recommendations;
  }
});