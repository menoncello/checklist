import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { TerminalInfo } from '@checklist/tui/src/terminal/TerminalInfo';
import { EnvironmentDetector, type EnvironmentInfo } from '@checklist/tui/src/terminal/helpers/EnvironmentDetector';
import { TTYInfoProvider, type TTYInfo } from '@checklist/tui/src/terminal/helpers/TTYInfoProvider';
import { TerminalCapabilitiesDetector } from '@checklist/tui/src/terminal/helpers/TerminalCapabilitiesDetector';
import { TerminalVersionDetector } from '@checklist/tui/src/terminal/helpers/TerminalVersionDetector';

// Mock environment info
const mockEnvironmentInfo: EnvironmentInfo = {
  term: 'xterm-256color',
  termProgram: 'iTerm.app',
  colorTerm: 'truecolor',
  lang: 'en_US.UTF-8',
  lc_all: 'en_US.UTF-8',
  ssh: false,
  tmux: false,
  screen: false,
};

const mockTTYInfo: TTYInfo = {
  isTTY: true,
  columns: 80,
  rows: 24,
  colorDepth: 24,
};

describe('TerminalInfo', () => {
  let terminalInfo: TerminalInfo;

  beforeEach(() => {
    // Mock static methods
    spyOn(EnvironmentDetector, 'gatherEnvironmentInfo').mockReturnValue(mockEnvironmentInfo);
    spyOn(EnvironmentDetector, 'getTerminalProgram').mockReturnValue('iTerm.app');
    spyOn(EnvironmentDetector, 'isRemoteSession').mockReturnValue(false);
    spyOn(EnvironmentDetector, 'getSessionType').mockReturnValue('local');
    spyOn(EnvironmentDetector, 'hasColorSupport').mockReturnValue(true);

    spyOn(TTYInfoProvider, 'gatherTTYInfo').mockReturnValue(mockTTYInfo);
    spyOn(TTYInfoProvider, 'getFreshTTYInfo').mockReturnValue(mockTTYInfo);
    spyOn(TTYInfoProvider, 'getCurrentSize').mockReturnValue({ width: 80, height: 24 });
    spyOn(TTYInfoProvider, 'isTTY').mockReturnValue(true);

    spyOn(TerminalCapabilitiesDetector, 'supportsColor').mockReturnValue(true);
    spyOn(TerminalCapabilitiesDetector, 'supports256Colors').mockReturnValue(true);
    spyOn(TerminalCapabilitiesDetector, 'supportsTrueColor').mockReturnValue(true);
    spyOn(TerminalCapabilitiesDetector, 'supportsUnicode').mockReturnValue(true);
    spyOn(TerminalCapabilitiesDetector, 'supportsMouseReporting').mockReturnValue(false);
    spyOn(TerminalCapabilitiesDetector, 'getColorDepthLevel').mockReturnValue('truecolor');

    spyOn(TerminalVersionDetector, 'getTerminalType').mockReturnValue('xterm-256color');
    spyOn(TerminalVersionDetector, 'getVersion').mockReturnValue('3.4.15');
    spyOn(TerminalVersionDetector, 'detectTerminalFamily').mockReturnValue('iTerm2');
    spyOn(TerminalVersionDetector, 'isKnownTerminal').mockReturnValue(true);
    spyOn(TerminalVersionDetector, 'getTerminalFeatures').mockReturnValue({
      supportsImages: true,
      supportsHyperlinks: true,
      supportsNotifications: true,
    });

    terminalInfo = new TerminalInfo();
  });

  afterEach(() => {
    // Restore all mocked methods to prevent test contamination
    (EnvironmentDetector.gatherEnvironmentInfo as any).mockRestore();
    (EnvironmentDetector.getTerminalProgram as any).mockRestore();
    (EnvironmentDetector.isRemoteSession as any).mockRestore();
    (EnvironmentDetector.getSessionType as any).mockRestore();
    (EnvironmentDetector.hasColorSupport as any).mockRestore();

    (TTYInfoProvider.gatherTTYInfo as any).mockRestore();
    (TTYInfoProvider.getFreshTTYInfo as any).mockRestore();
    (TTYInfoProvider.getCurrentSize as any).mockRestore();
    (TTYInfoProvider.isTTY as any).mockRestore();

    (TerminalCapabilitiesDetector.supportsColor as any).mockRestore();
    (TerminalCapabilitiesDetector.supports256Colors as any).mockRestore();
    (TerminalCapabilitiesDetector.supportsTrueColor as any).mockRestore();
    (TerminalCapabilitiesDetector.supportsUnicode as any).mockRestore();
    (TerminalCapabilitiesDetector.supportsMouseReporting as any).mockRestore();
    (TerminalCapabilitiesDetector.getColorDepthLevel as any).mockRestore();

    (TerminalVersionDetector.getTerminalType as any).mockRestore();
    (TerminalVersionDetector.getVersion as any).mockRestore();
    (TerminalVersionDetector.detectTerminalFamily as any).mockRestore();
    (TerminalVersionDetector.isKnownTerminal as any).mockRestore();
    (TerminalVersionDetector.getTerminalFeatures as any).mockRestore();
  });

  describe('constructor', () => {
    it('should create instance with initialized properties', () => {
      expect(terminalInfo).toBeDefined();
      expect(terminalInfo).toBeInstanceOf(TerminalInfo);
      expect((terminalInfo as any).platformInfo).toBe(process.platform);
    });

    it('should gather environment info during construction', () => {
      expect(EnvironmentDetector.gatherEnvironmentInfo).toHaveBeenCalled();
    });

    it('should gather TTY info during construction', () => {
      expect(TTYInfoProvider.gatherTTYInfo).toHaveBeenCalled();
    });
  });

  describe('terminal type detection', () => {
    describe('getTerminalType', () => {
      it('should return terminal type from environment info', () => {
        const result = terminalInfo.getTerminalType();

        expect(result).toBe('xterm-256color');
        expect(TerminalVersionDetector.getTerminalType).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle null/undefined terminal type', () => {
        (TerminalVersionDetector.getTerminalType as any).mockReturnValue(null);

        const result = terminalInfo.getTerminalType();

        expect(result).toBeNull();
      });
    });

    describe('getTerminalProgram', () => {
      it('should return terminal program name', () => {
        const result = terminalInfo.getTerminalProgram();

        expect(result).toBe('iTerm.app');
        expect(EnvironmentDetector.getTerminalProgram).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle undefined terminal program', () => {
        (EnvironmentDetector.getTerminalProgram as any).mockReturnValue(undefined);

        const result = terminalInfo.getTerminalProgram();

        expect(result).toBeUndefined();
      });
    });

    describe('getVersion', () => {
      it('should return terminal version', () => {
        const result = terminalInfo.getVersion();

        expect(result).toBe('3.4.15');
        expect(TerminalVersionDetector.getVersion).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle null version', () => {
        (TerminalVersionDetector.getVersion as any).mockReturnValue(null);

        const result = terminalInfo.getVersion();

        expect(result).toBeNull();
      });
    });

    describe('detectTerminalFamily', () => {
      it('should detect terminal family', () => {
        const result = terminalInfo.detectTerminalFamily();

        expect(result).toBe('iTerm2');
        expect(TerminalVersionDetector.detectTerminalFamily).toHaveBeenCalledWith(mockEnvironmentInfo);
      });
    });

    describe('isKnownTerminal', () => {
      it('should return true for known terminals', () => {
        const result = terminalInfo.isKnownTerminal();

        expect(result).toBe(true);
        expect(TerminalVersionDetector.isKnownTerminal).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should return false for unknown terminals', () => {
        (TerminalVersionDetector.isKnownTerminal as any).mockReturnValue(false);

        const result = terminalInfo.isKnownTerminal();

        expect(result).toBe(false);
      });
    });
  });

  describe('platform information', () => {
    describe('getPlatform', () => {
      it('should return current platform', () => {
        const result = terminalInfo.getPlatform();

        expect(result).toBe(process.platform);
      });
    });
  });

  describe('TTY information', () => {
    describe('getTTYInfo', () => {
      it('should return fresh TTY info', () => {
        const result = terminalInfo.getTTYInfo();

        expect(result).toBe(mockTTYInfo);
        expect(TTYInfoProvider.getFreshTTYInfo).toHaveBeenCalled();
      });
    });

    describe('isTTY', () => {
      it('should return TTY status from initial info', () => {
        const result = terminalInfo.isTTY();

        expect(result).toBe(true);
      });
    });

    describe('getSize', () => {
      it('should return current terminal size', () => {
        const result = terminalInfo.getSize();

        expect(result).toEqual({ width: 80, height: 24 });
        expect(TTYInfoProvider.getCurrentSize).toHaveBeenCalled();
      });
    });

    describe('getColorDepth', () => {
      it('should return color depth from TTY info', () => {
        const result = terminalInfo.getColorDepth();

        expect(result).toBe(24);
      });
    });

    describe('getColorDepthLevel', () => {
      it('should return color depth level', () => {
        const result = terminalInfo.getColorDepthLevel();

        expect(result).toBe('truecolor');
        expect(TerminalCapabilitiesDetector.getColorDepthLevel).toHaveBeenCalledWith(24);
      });
    });
  });

  describe('capability detection', () => {
    describe('supportsColor', () => {
      it('should return color support status', () => {
        const result = terminalInfo.supportsColor();

        expect(result).toBe(true);
        expect(TerminalCapabilitiesDetector.supportsColor).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle false color support', () => {
        (TerminalCapabilitiesDetector.supportsColor as any).mockReturnValue(false);

        const result = terminalInfo.supportsColor();

        expect(result).toBe(false);
      });
    });

    describe('supports256Colors', () => {
      it('should return 256 color support status', () => {
        const result = terminalInfo.supports256Colors();

        expect(result).toBe(true);
        expect(TerminalCapabilitiesDetector.supports256Colors).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle false 256 color support', () => {
        (TerminalCapabilitiesDetector.supports256Colors as any).mockReturnValue(false);

        const result = terminalInfo.supports256Colors();

        expect(result).toBe(false);
      });
    });

    describe('supportsTrueColor', () => {
      it('should return true color support status', () => {
        const result = terminalInfo.supportsTrueColor();

        expect(result).toBe(true);
        expect(TerminalCapabilitiesDetector.supportsTrueColor).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle false true color support', () => {
        (TerminalCapabilitiesDetector.supportsTrueColor as any).mockReturnValue(false);

        const result = terminalInfo.supportsTrueColor();

        expect(result).toBe(false);
      });
    });

    describe('supportsUnicode', () => {
      it('should return unicode support status', () => {
        const result = terminalInfo.supportsUnicode();

        expect(result).toBe(true);
        expect(TerminalCapabilitiesDetector.supportsUnicode).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle false unicode support', () => {
        (TerminalCapabilitiesDetector.supportsUnicode as any).mockReturnValue(false);

        const result = terminalInfo.supportsUnicode();

        expect(result).toBe(false);
      });
    });

    describe('supportsMouseReporting', () => {
      it('should return mouse reporting support status', () => {
        const result = terminalInfo.supportsMouseReporting();

        expect(result).toBe(false);
        expect(TerminalCapabilitiesDetector.supportsMouseReporting).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle true mouse reporting support', () => {
        (TerminalCapabilitiesDetector.supportsMouseReporting as any).mockReturnValue(true);

        const result = terminalInfo.supportsMouseReporting();

        expect(result).toBe(true);
      });
    });
  });

  describe('session information', () => {
    describe('isRemoteSession', () => {
      it('should return remote session status', () => {
        const result = terminalInfo.isRemoteSession();

        expect(result).toBe(false);
        expect(EnvironmentDetector.isRemoteSession).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle true remote session', () => {
        (EnvironmentDetector.isRemoteSession as any).mockReturnValue(true);

        const result = terminalInfo.isRemoteSession();

        expect(result).toBe(true);
      });
    });

    describe('getSessionType', () => {
      it('should return session type', () => {
        const result = terminalInfo.getSessionType();

        expect(result).toBe('local');
        expect(EnvironmentDetector.getSessionType).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle different session types', () => {
        (EnvironmentDetector.getSessionType as any).mockReturnValue('SSH');

        const result = terminalInfo.getSessionType();

        expect(result).toBe('SSH');
      });
    });
  });

  describe('terminal features', () => {
    describe('getTerminalFeatures', () => {
      it('should return terminal features', () => {
        const result = terminalInfo.getTerminalFeatures();

        expect(result).toEqual({
          supportsImages: true,
          supportsHyperlinks: true,
          supportsNotifications: true,
        });
        expect(TerminalVersionDetector.getTerminalFeatures).toHaveBeenCalledWith(mockEnvironmentInfo);
      });

      it('should handle limited features', () => {
        (TerminalVersionDetector.getTerminalFeatures as any).mockReturnValue({
          supportsImages: false,
          supportsHyperlinks: false,
          supportsNotifications: false,
        });

        const result = terminalInfo.getTerminalFeatures();

        expect(result).toEqual({
          supportsImages: false,
          supportsHyperlinks: false,
          supportsNotifications: false,
        });
      });
    });
  });

  describe('error handling', () => {
    it('should throw errors in environment detection', () => {
      // Reset and mock to throw error
      (EnvironmentDetector.gatherEnvironmentInfo as any).mockRestore();
      spyOn(EnvironmentDetector, 'gatherEnvironmentInfo').mockImplementation(() => {
        throw new Error('Environment detection failed');
      });

      expect(() => {
        new TerminalInfo();
      }).toThrow('Environment detection failed');
    });

    it('should throw errors in TTY detection', () => {
      // Reset and mock to throw error
      (TTYInfoProvider.gatherTTYInfo as any).mockRestore();
      spyOn(TTYInfoProvider, 'gatherTTYInfo').mockImplementation(() => {
        throw new Error('TTY detection failed');
      });

      expect(() => {
        new TerminalInfo();
      }).toThrow('TTY detection failed');
    });
  });

  describe('edge cases', () => {
    it('should handle minimal environment info', () => {
      // Reset and mock with minimal info for all tests in this block
      (EnvironmentDetector.gatherEnvironmentInfo as any).mockRestore();
      const minimalEnvInfo: EnvironmentInfo = {
        term: 'unknown',
        ssh: false,
        tmux: false,
        screen: false,
      };
      spyOn(EnvironmentDetector, 'gatherEnvironmentInfo').mockReturnValue(minimalEnvInfo);

      // Also need to mock other dependencies that are called
      spyOn(TTYInfoProvider, 'gatherTTYInfo').mockReturnValue(mockTTYInfo);
      spyOn(TerminalVersionDetector, 'getTerminalType').mockReturnValue('unknown');

      const newTerminalInfo = new TerminalInfo();

      expect(newTerminalInfo.getTerminalType()).toBe('unknown');
    });

    it('should handle minimal TTY info', () => {
      // Reset and mock with minimal info for all tests in this block
      (TTYInfoProvider.gatherTTYInfo as any).mockRestore();
      const minimalTTYInfo: TTYInfo = {
        isTTY: false,
        columns: 80,
        rows: 24,
      };
      spyOn(TTYInfoProvider, 'gatherTTYInfo').mockReturnValue(minimalTTYInfo);

      // Also need to mock other dependencies that are called
      spyOn(EnvironmentDetector, 'gatherEnvironmentInfo').mockReturnValue(mockEnvironmentInfo);

      const newTerminalInfo = new TerminalInfo();

      expect(newTerminalInfo.isTTY()).toBe(false);
    });
  });

  describe('performance considerations', () => {
    it('should cache environment info after initial gathering', () => {
      // Create a fresh instance for this test
      (EnvironmentDetector.gatherEnvironmentInfo as any).mockRestore();
      spyOn(EnvironmentDetector, 'gatherEnvironmentInfo').mockReturnValue(mockEnvironmentInfo);
      const freshTerminalInfo = new TerminalInfo();

      // Reset call count
      (EnvironmentDetector.gatherEnvironmentInfo as any).mockClear();

      freshTerminalInfo.getTerminalProgram();

      // Should not call gatherEnvironmentInfo again
      expect(EnvironmentDetector.gatherEnvironmentInfo).toHaveBeenCalledTimes(0);
    });

    it('should cache TTY info after initial gathering', () => {
      // Create a fresh instance for this test
      (TTYInfoProvider.gatherTTYInfo as any).mockRestore();
      spyOn(TTYInfoProvider, 'gatherTTYInfo').mockReturnValue(mockTTYInfo);
      const freshTerminalInfo = new TerminalInfo();

      // Reset call count
      (TTYInfoProvider.gatherTTYInfo as any).mockClear();

      freshTerminalInfo.isTTY();

      // Should not call gatherTTYInfo again
      expect(TTYInfoProvider.gatherTTYInfo).toHaveBeenCalledTimes(0);
    });
  });
});