import { describe, it, expect, beforeEach } from 'bun:test';
import { ColorSupport } from '../../src/terminal/ColorSupport';
import { ColorFormat, ColorSupportSummary } from '../../src/terminal/ColorSupport';

describe('ColorSupport', () => {
  let colorSupport: ColorSupport;

  beforeEach(() => {
    colorSupport = new ColorSupport();
  });

  describe('Basic Detection', () => {
    it('should detect basic color support from environment', () => {
      // Test with mock environment
      const originalTerm = Bun.env.TERM;
      const originalColorTerm = Bun.env.COLORTERM;

      Bun.env.TERM = 'xterm-256color';
      Bun.env.COLORTERM = 'truecolor';

      const basicSupport = colorSupport.detectBasicColor();
      expect(basicSupport === null || typeof basicSupport === 'boolean').toBe(true);

      // Restore environment
      Bun.env.TERM = originalTerm;
      Bun.env.COLORTERM = originalColorTerm;
    });

    it('should handle NO_COLOR environment variable', () => {
      const originalNoColor = Bun.env.NO_COLOR;
      Bun.env.NO_COLOR = '1';

      const support = colorSupport.detectBasicColor();
      expect(support).toBe(false);

      Bun.env.NO_COLOR = originalNoColor;
    });

    it('should handle FORCE_COLOR environment variable', () => {
      const originalForceColor = Bun.env.FORCE_COLOR;

      Bun.env.FORCE_COLOR = '1';
      let support = colorSupport.detectBasicColor();
      expect(support).toBe(true);

      Bun.env.FORCE_COLOR = '0';
      support = colorSupport.detectBasicColor();
      expect(support).toBe(false);

      Bun.env.FORCE_COLOR = originalForceColor;
    });

    it('should detect dumb terminal', () => {
      const originalTerm = Bun.env.TERM;
      const originalForceColor = Bun.env.FORCE_COLOR;
      const originalNoColor = Bun.env.NO_COLOR;

      // Clear conflicting env vars
      delete Bun.env.FORCE_COLOR;
      delete Bun.env.NO_COLOR;
      Bun.env.TERM = 'dumb';

      // Create new instance to pick up env changes
      const dumbTermSupport = new ColorSupport();
      const support = dumbTermSupport.detectBasicColor();
      expect(support).toBe(false);

      Bun.env.TERM = originalTerm;
      if (originalForceColor !== undefined) Bun.env.FORCE_COLOR = originalForceColor;
      if (originalNoColor !== undefined) Bun.env.NO_COLOR = originalNoColor;
    });
  });

  describe('256 Color Detection', () => {
    it('should detect 256 color from TERM variable', () => {
      const originalTerm = Bun.env.TERM;
      const originalColorTerm = Bun.env.COLORTERM;

      // Clear COLORTERM to avoid interference
      delete Bun.env.COLORTERM;

      Bun.env.TERM = 'xterm-256color';
      let test256Support = new ColorSupport();
      let support = test256Support.detect256Color();
      expect(support).toBe(true);

      Bun.env.TERM = 'screen-256color';
      test256Support = new ColorSupport();
      support = test256Support.detect256Color();
      expect(support).toBe(true);

      Bun.env.TERM = 'xterm';
      test256Support = new ColorSupport();
      support = test256Support.detect256Color();
      expect(support).toBe(false);

      Bun.env.TERM = originalTerm;
      if (originalColorTerm !== undefined) Bun.env.COLORTERM = originalColorTerm;
    });

    it('should detect 256 color from COLORTERM', () => {
      const originalColorTerm = Bun.env.COLORTERM;

      Bun.env.COLORTERM = '256color';
      const support = colorSupport.detect256Color();
      expect(support).toBe(true);

      Bun.env.COLORTERM = originalColorTerm;
    });
  });

  describe('True Color Detection', () => {
    it('should detect true color from COLORTERM', () => {
      const originalColorTerm = Bun.env.COLORTERM;

      Bun.env.COLORTERM = 'truecolor';
      let support = colorSupport.detectTrueColor();
      expect(support).toBe(true);

      Bun.env.COLORTERM = '24bit';
      support = colorSupport.detectTrueColor();
      expect(support).toBe(true);

      Bun.env.COLORTERM = 'unknown';
      support = colorSupport.detectTrueColor();
      expect(support).toBe(false);

      Bun.env.COLORTERM = originalColorTerm;
    });

    it('should detect true color from TERM_PROGRAM', () => {
      const originalTermProgram = Bun.env.TERM_PROGRAM;
      const originalColorTerm = Bun.env.COLORTERM;

      // Clear COLORTERM to avoid interference
      delete Bun.env.COLORTERM;

      Bun.env.TERM_PROGRAM = 'iTerm.app';
      let testTrueColor = new ColorSupport();
      let support = testTrueColor.detectTrueColor();
      expect(support).toBe(true);

      Bun.env.TERM_PROGRAM = 'alacritty';
      testTrueColor = new ColorSupport();
      support = testTrueColor.detectTrueColor();
      expect(support).toBe(true);

      Bun.env.TERM_PROGRAM = 'terminal'; // macOS Terminal
      testTrueColor = new ColorSupport();
      support = testTrueColor.detectTrueColor();
      expect(support).toBe(false);

      Bun.env.TERM_PROGRAM = originalTermProgram;
      if (originalColorTerm !== undefined) Bun.env.COLORTERM = originalColorTerm;
    });
  });

  describe('Color Level and Format', () => {
    it('should return correct color level', () => {
      const level = colorSupport.getColorLevel();
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(3);
    });

    it('should get best supported format', () => {
      const format = colorSupport.getBestSupportedFormat();
      const validFormats: ColorFormat[] = ['none', '16color', '256color', 'truecolor'];

      expect(validFormats).toContain(format);
    });

    it('should format colors safely', () => {
      // Test with valid RGB values
      const red = colorSupport.formatColor(255, 0, 0);
      const green = colorSupport.formatColor(0, 255, 0);
      const blue = colorSupport.formatColor(0, 0, 255);

      expect(typeof red).toBe('string');
      expect(typeof green).toBe('string');
      expect(typeof blue).toBe('string');

      // Test with background colors
      const redBg = colorSupport.formatColor(255, 0, 0, true);
      expect(typeof redBg).toBe('string');
    });

    it('should handle out of range color values', () => {
      // Test with out of range values (should clamp or handle gracefully)
      const invalid1 = colorSupport.formatColor(-1, 300, 128);
      const invalid2 = colorSupport.formatColor(1000, -50, 500);

      expect(typeof invalid1).toBe('string');
      expect(typeof invalid2).toBe('string');
    });
  });

  describe('Color Conversion', () => {
    it('should convert RGB to 256-color index', () => {
      // Test some known conversions
      const black = colorSupport['rgbTo256'](0, 0, 0); // Access private method for testing
      const white = colorSupport['rgbTo256'](255, 255, 255);
      const red = colorSupport['rgbTo256'](255, 0, 0);

      expect(typeof black).toBe('number');
      expect(typeof white).toBe('number');
      expect(typeof red).toBe('number');

      expect(black).toBeGreaterThanOrEqual(0);
      expect(black).toBeLessThanOrEqual(255);
    });

    it('should convert RGB to 16-color index', () => {
      const black = colorSupport['rgbTo16'](0, 0, 0); // Access private method for testing
      const red = colorSupport['rgbTo16'](255, 0, 0);
      const green = colorSupport['rgbTo16'](0, 255, 0);

      expect(typeof black).toBe('number');
      expect(typeof red).toBe('number');
      expect(typeof green).toBe('number');

      // ANSI color codes start at 30 for foreground
      expect(black).toBeGreaterThanOrEqual(30);
      expect(black).toBeLessThan(50);
    });
  });

  describe('Color Test Generation', () => {
    it('should create color test string', () => {
      const test = colorSupport.createColorTest();
      expect(typeof test).toBe('string');
      expect(test.length).toBeGreaterThan(0);
    });

    it('should handle no color support', () => {
      // Set NO_COLOR to force no color support
      const originalNoColor = Bun.env.NO_COLOR;
      const originalTerm = Bun.env.TERM;
      const originalForceColor = Bun.env.FORCE_COLOR;
      const originalColorTerm = Bun.env.COLORTERM;

      // Clear all color-related env vars
      delete Bun.env.FORCE_COLOR;
      delete Bun.env.COLORTERM;
      Bun.env.NO_COLOR = '1';
      Bun.env.TERM = 'dumb';

      // Create a new instance to pick up the environment changes
      const noColorSupport = new ColorSupport();
      const test = noColorSupport.createColorTest();
      expect(test).toContain('No color support detected');

      // Restore environment
      if (originalNoColor !== undefined) Bun.env.NO_COLOR = originalNoColor;
      else delete Bun.env.NO_COLOR;
      if (originalTerm !== undefined) Bun.env.TERM = originalTerm;
      if (originalForceColor !== undefined) Bun.env.FORCE_COLOR = originalForceColor;
      if (originalColorTerm !== undefined) Bun.env.COLORTERM = originalColorTerm;
    });
  });

  describe('Color Support Summary', () => {
    it('should generate color support summary', () => {
      const summary = colorSupport.getColorSupportSummary();

      expect(summary).toHaveProperty('basic');
      expect(summary).toHaveProperty('color256');
      expect(summary).toHaveProperty('trueColor');
      expect(summary).toHaveProperty('level');
      expect(summary).toHaveProperty('format');
      expect(summary).toHaveProperty('method');
      expect(summary).toHaveProperty('confidence');

      expect(typeof summary.basic).toBe('boolean');
      expect(typeof summary.color256).toBe('boolean');
      expect(typeof summary.trueColor).toBe('boolean');
      expect(typeof summary.level).toBe('number');
      expect(['none', '16color', '256color', 'truecolor']).toContain(summary.format);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', () => {
      // First run a detection to populate cache
      colorSupport.detectBasicColor();

      // Clear cache
      colorSupport.clearCache();

      // Should not throw errors
      expect(() => colorSupport.clearCache()).not.toThrow();
    });
  });

  describe('Environment Detection', () => {
    it('should handle CI environments', () => {
      const originalCi = Bun.env.CI;

      Bun.env.CI = 'true';
      const ciSupport = colorSupport['checkEnvironmentVariables']();

      Bun.env.CI = undefined;
      const normalSupport = colorSupport['checkEnvironmentVariables']();

      Bun.env.CI = originalCi;

      // Results should be boolean or null
      expect(ciSupport === null || typeof ciSupport === 'boolean').toBe(true);
      expect(normalSupport === null || typeof normalSupport === 'boolean').toBe(true);
    });

    it('should detect specific CI platforms', () => {
      const originalEnv = { ...Bun.env };

      // Test GitHub Actions
      Bun.env.CI = 'true';
      Bun.env.GITHUB_ACTIONS = 'true';
      const githubSupport = colorSupport['checkEnvironmentVariables']();
      expect(githubSupport).toBe(true);

      // Test GitLab CI
      delete Bun.env.GITHUB_ACTIONS;
      Bun.env.GITLAB_CI = 'true';
      const gitlabSupport = colorSupport['checkEnvironmentVariables']();
      expect(gitlabSupport).toBe(true);

      // Restore environment
      for (const key in Bun.env) {
        delete Bun.env[key];
      }
      for (const key in originalEnv) {
        Bun.env[key] = originalEnv[key];
      }
    });
  });

  describe('Terminal Capabilities Lookup', () => {
    it('should have terminal capability mappings', () => {
      const capabilities = colorSupport['getTerminalCapabilities']();

      expect(typeof capabilities).toBe('object');
      expect(capabilities).toHaveProperty('xterm');
      expect(capabilities).toHaveProperty('xterm-256color');
      expect(capabilities).toHaveProperty('screen');
      expect(capabilities).toHaveProperty('alacritty');
      expect(capabilities).toHaveProperty('kitty');
    });

    it('should have program capability mappings', () => {
      const capabilities = colorSupport['getProgramCapabilities']();

      expect(typeof capabilities).toBe('object');
      expect(capabilities).toHaveProperty('iterm');
      expect(capabilities).toHaveProperty('alacritty');
      expect(capabilities).toHaveProperty('kitty');
      expect(capabilities).toHaveProperty('wezterm');
      expect(capabilities).toHaveProperty('terminal');
    });

    it('should get color support from capability mapping', () => {
      const capabilities = colorSupport['getTerminalCapabilities']();
      const xtermCaps = capabilities.xterm;

      const basicSupport = colorSupport['getColorSupport'](xtermCaps, 16);
      const color256Support = colorSupport['getColorSupport'](xtermCaps, 256);
      const trueColorSupport = colorSupport['getColorSupport'](xtermCaps, 16777216);

      expect(basicSupport).toBe(true);
      expect(color256Support).toBe(false); // Plain xterm doesn't support 256 colors
      expect(trueColorSupport).toBe(false);
    });
  });
});