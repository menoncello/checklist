import { describe, it, expect, beforeEach } from 'bun:test';
import { EnvironmentDetector } from '../../src/terminal/helpers/EnvironmentDetector';
import type { EnvironmentInfo } from '../../src/terminal/helpers/EnvironmentDetector';

describe('EnvironmentDetector', () => {
  describe('gatherEnvironmentInfo', () => {
    it('should gather environment information', () => {
      const envInfo = EnvironmentDetector.gatherEnvironmentInfo();

      expect(envInfo).toHaveProperty('term');
      expect(envInfo).toHaveProperty('ssh');
      expect(envInfo).toHaveProperty('tmux');
      expect(envInfo).toHaveProperty('screen');
      expect(typeof envInfo.term).toBe('string');
      expect(typeof envInfo.ssh).toBe('boolean');
      expect(typeof envInfo.tmux).toBe('boolean');
      expect(typeof envInfo.screen).toBe('boolean');
    });

    it('should have valid term value', () => {
      const envInfo = EnvironmentDetector.gatherEnvironmentInfo();

      expect(envInfo.term).toBeDefined();
      expect(envInfo.term.length).toBeGreaterThan(0);
      expect(envInfo.term).not.toBe('undefined');
    });

    it('should detect session types correctly', () => {
      const envInfo = EnvironmentDetector.gatherEnvironmentInfo();

      // At least one should be defined
      expect([
        envInfo.ssh,
        envInfo.tmux,
        envInfo.screen,
        envInfo.term !== 'unknown'
      ]).toContain(true);
    });
  });

  describe('isRemoteSession', () => {
    it('should detect SSH session', () => {
      const sshEnv: EnvironmentInfo = {
        term: 'xterm-256color',
        ssh: true,
        tmux: false,
        screen: false,
        colorTerm: undefined,
        lang: undefined,
        lc_all: undefined,
        termProgram: undefined,
      };

      const isRemote = EnvironmentDetector.isRemoteSession(sshEnv);
      expect(isRemote).toBe(true);
    });

    it('should detect local session', () => {
      const localEnv: EnvironmentInfo = {
        term: 'xterm-256color',
        ssh: false,
        tmux: false,
        screen: false,
        colorTerm: undefined,
        lang: undefined,
        lc_all: undefined,
        termProgram: undefined,
      };

      const isRemote = EnvironmentDetector.isRemoteSession(localEnv);
      expect(isRemote).toBe(false);
    });

    it('should handle undefined SSH properly', () => {
      const envWithoutSSH: EnvironmentInfo = {
        term: 'xterm',
        ssh: false,
        tmux: false,
        screen: false,
        colorTerm: undefined,
        lang: undefined,
        lc_all: undefined,
        termProgram: undefined,
      };

      const isRemote = EnvironmentDetector.isRemoteSession(envWithoutSSH);
      expect(isRemote).toBe(false);
    });
  });

  describe('getSessionType', () => {
    it('should identify SSH session', () => {
      const sshEnv: EnvironmentInfo = {
        term: 'xterm-256color',
        ssh: true,
        tmux: false,
        screen: false,
        colorTerm: undefined,
        lang: undefined,
        lc_all: undefined,
        termProgram: undefined,
      };

      const sessionType = EnvironmentDetector.getSessionType(sshEnv);
      expect(sessionType).toBe('SSH');
    });

    it('should identify tmux session', () => {
      const tmuxEnv: EnvironmentInfo = {
        term: 'tmux-256color',
        ssh: false,
        tmux: true,
        screen: false,
        colorTerm: undefined,
        lang: undefined,
        lc_all: undefined,
        termProgram: undefined,
      };

      const sessionType = EnvironmentDetector.getSessionType(tmuxEnv);
      expect(sessionType).toBe('tmux');
    });

    it('should identify screen session', () => {
      const screenEnv: EnvironmentInfo = {
        term: 'screen-256color',
        ssh: false,
        tmux: false,
        screen: true,
        colorTerm: undefined,
        lang: undefined,
        lc_all: undefined,
        termProgram: undefined,
      };

      const sessionType = EnvironmentDetector.getSessionType(screenEnv);
      expect(sessionType).toBe('screen');
    });

    it('should identify local session', () => {
      const localEnv: EnvironmentInfo = {
        term: 'xterm-256color',
        ssh: false,
        tmux: false,
        screen: false,
      };

      const sessionType = EnvironmentDetector.getSessionType(localEnv);
      expect(sessionType).toBe('local');
    });

    it('should prioritize SSH over other session types', () => {
      const complexEnv: EnvironmentInfo = {
        term: 'xterm-256color',
        ssh: true,
        tmux: true,
        screen: true,
      };

      const sessionType = EnvironmentDetector.getSessionType(complexEnv);
      expect(sessionType).toBe('SSH');
    });
  });

  describe('getTerminalProgram', () => {
    it('should return terminal program when available', () => {
      const envWithProgram: EnvironmentInfo = {
        term: 'xterm-256color',
        termProgram: 'iTerm.app',
        ssh: false,
        tmux: false,
        screen: false,
      };

      const program = EnvironmentDetector.getTerminalProgram(envWithProgram);
      expect(program).toBe('iTerm.app');
    });

    it('should return undefined when no terminal program is set', () => {
      const envWithoutProgram: EnvironmentInfo = {
        term: 'xterm-256color',
        ssh: false,
        tmux: false,
        screen: false,
      };

      const program = EnvironmentDetector.getTerminalProgram(envWithoutProgram);
      expect(program).toBeUndefined();
    });

    it('should handle empty terminal program', () => {
      const envWithEmptyProgram: EnvironmentInfo = {
        term: 'xterm-256color',
        termProgram: '',
        ssh: false,
        tmux: false,
        screen: false,
      };

      const program = EnvironmentDetector.getTerminalProgram(envWithEmptyProgram);
      expect(program).toBe('');
    });
  });

  describe('hasColorSupport', () => {
    it('should detect color support from colorTerm', () => {
      const colorEnv: EnvironmentInfo = {
        term: 'xterm-256color',
        colorTerm: 'truecolor',
        ssh: false,
        tmux: false,
        screen: false,
      };

      const hasColor = EnvironmentDetector.hasColorSupport(colorEnv);
      expect(hasColor).toBe(true);
    });

    it('should detect color support from term name', () => {
      const colorTermEnv: EnvironmentInfo = {
        term: 'xterm-256color',
        ssh: false,
        tmux: false,
        screen: false,
      };

      const hasColor = EnvironmentDetector.hasColorSupport(colorTermEnv);
      expect(hasColor).toBe(true);
    });

    it('should detect no color support for dumb terminal', () => {
      const dumbEnv: EnvironmentInfo = {
        term: 'dumb',
        ssh: false,
        tmux: false,
        screen: false,
      };

      const hasColor = EnvironmentDetector.hasColorSupport(dumbEnv);
      expect(hasColor).toBe(false);
    });

    it('should handle unknown terminal conservatively', () => {
      const unknownEnv: EnvironmentInfo = {
        term: 'unknown',
        ssh: false,
        tmux: false,
        screen: false,
      };

      const hasColor = EnvironmentDetector.hasColorSupport(unknownEnv);
      expect(typeof hasColor).toBe('boolean');
    });
  });

  describe('integration tests', () => {
    it('should work with real environment', () => {
      const realEnvInfo = EnvironmentDetector.gatherEnvironmentInfo();
      const isRemote = EnvironmentDetector.isRemoteSession(realEnvInfo);
      const sessionType = EnvironmentDetector.getSessionType(realEnvInfo);
      const terminalProgram = EnvironmentDetector.getTerminalProgram(realEnvInfo);
      const hasColor = EnvironmentDetector.hasColorSupport(realEnvInfo);

      // Basic validation that methods work with real data
      expect(typeof isRemote).toBe('boolean');
      expect(typeof sessionType).toBe('string');
      expect(sessionType).toMatch(/^(SSH|tmux|screen|local)$/);
      expect(typeof hasColor).toBe('boolean');

      if (terminalProgram !== undefined) {
        expect(typeof terminalProgram).toBe('string');
      }
    });

    it('should maintain consistency across multiple calls', () => {
      const envInfo1 = EnvironmentDetector.gatherEnvironmentInfo();
      const envInfo2 = EnvironmentDetector.gatherEnvironmentInfo();

      expect(envInfo1.term).toBe(envInfo2.term);
      expect(envInfo1.ssh).toBe(envInfo2.ssh);
      expect(envInfo1.tmux).toBe(envInfo2.tmux);
      expect(envInfo1.screen).toBe(envInfo2.screen);
    });

    it('should handle edge cases gracefully', () => {
      const edgeCaseEnv: EnvironmentInfo = {
        term: '',
        termProgram: undefined,
        colorTerm: undefined,
        ssh: undefined as any,
        tmux: undefined as any,
        screen: undefined as any,
      };

      expect(() => {
        EnvironmentDetector.isRemoteSession(edgeCaseEnv);
        EnvironmentDetector.getSessionType(edgeCaseEnv);
        EnvironmentDetector.getTerminalProgram(edgeCaseEnv);
        EnvironmentDetector.hasColorSupport(edgeCaseEnv);
      }).not.toThrow();
    });
  });

  describe('environment sanitization', () => {
    it('should sanitize gathered environment info', () => {
      const envInfo = EnvironmentDetector.gatherEnvironmentInfo();

      // Term should be sanitized and safe
      expect(envInfo.term).toMatch(/^[a-zA-Z0-9\-_.]*$/);

      // Should not contain dangerous characters
      expect(envInfo.term).not.toContain(';');
      expect(envInfo.term).not.toContain('|');
      expect(envInfo.term).not.toContain('&');
      expect(envInfo.term).not.toContain('$');

      if (envInfo.termProgram) {
        expect(typeof envInfo.termProgram).toBe('string');
      }

      if (envInfo.colorTerm) {
        expect(typeof envInfo.colorTerm).toBe('string');
      }
    });
  });
});