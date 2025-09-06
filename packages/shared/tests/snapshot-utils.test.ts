import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SnapshotUtils, toMatchSnapshot } from '../src/testing/snapshot-utils';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';

describe('SnapshotUtils', () => {
  const testSnapshotDir = 'test-snapshots-temp';
  let utils: SnapshotUtils;

  beforeEach(() => {
    utils = new SnapshotUtils(testSnapshotDir);
    if (!existsSync(testSnapshotDir)) {
      mkdirSync(testSnapshotDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testSnapshotDir)) {
      rmSync(testSnapshotDir, { recursive: true, force: true });
    }
  });

  describe('Snapshot Management', () => {
    it('should save and load snapshots', async () => {
      const content = 'Test snapshot content\nLine 2';
      
      await utils.saveSnapshot('test-snap', content);
      const loaded = await utils.loadSnapshot('test-snap');
      
      expect(loaded).toBe(content);
    });

    it('should return null for non-existent snapshot', async () => {
      const loaded = await utils.loadSnapshot('non-existent');
      expect(loaded).toBeNull();
    });

    it('should compare snapshots', async () => {
      const content = 'Snapshot content';
      
      // First time should save and return true
      const firstMatch = await utils.compareSnapshot('compare-test', content);
      expect(firstMatch).toBe(true);
      
      // Same content should match
      const secondMatch = await utils.compareSnapshot('compare-test', content);
      expect(secondMatch).toBe(true);
      
      // Different content should not match
      const thirdMatch = await utils.compareSnapshot('compare-test', 'Different');
      expect(thirdMatch).toBe(false);
    });

    it('should update snapshot', async () => {
      await utils.saveSnapshot('update-test', 'Original');
      await utils.updateSnapshot('update-test', 'Updated');
      
      const loaded = await utils.loadSnapshot('update-test');
      expect(loaded).toBe('Updated');
    });
  });

  describe('Text Normalization', () => {
    it('should normalize terminal output', () => {
      const tests = [
        { input: 'Line1\r\nLine2\r\n', expected: 'Line1\nLine2' },
        { input: 'Line1\rLine2\r', expected: 'Line1\nLine2' },
        { input: 'Line1  \nLine2   \n', expected: 'Line1\nLine2' },
        { input: 'Line1\n\n\nLine2', expected: 'Line1\nLine2' },  // Empty lines in middle are removed
        { input: '  Leading spaces\n', expected: '  Leading spaces' },
      ];

      tests.forEach(({ input, expected }) => {
        const result = utils.normalizeTerminalOutput(input);
        expect(result).toBe(expected);
      });
    });

    it('should strip ANSI codes', () => {
      const tests = [
        { 
          input: '\x1b[31mRed\x1b[0m', 
          expected: 'Red' 
        },
        { 
          input: '\x1b[1m\x1b[32mBold Green\x1b[0m', 
          expected: 'Bold Green' 
        },
        { 
          input: '\x1b[?25lHide cursor\x1b[?25h', 
          expected: 'Hide cursor' 
        },
        {
          input: '\x1b[2J\x1b[HClear and home',
          expected: 'Clear and home'
        }
      ];

      tests.forEach(({ input, expected }) => {
        const result = utils.stripAnsiCodes(input);
        expect(result).toBe(expected);
      });
    });

    it('should strip timestamps', () => {
      const tests = [
        {
          input: 'Log at 2024-03-15T10:30:45.123Z',
          expected: 'Log at <TIMESTAMP>'
        },
        {
          input: 'Time is 3:45:30 PM',
          expected: 'Time is <TIME>'
        },
        {
          input: 'Date: 12/25/2024',
          expected: 'Date: <DATE>'
        },
        {
          input: 'Multiple 2024-01-01T00:00:00.000Z and 2:30:00 AM',
          expected: 'Multiple <TIMESTAMP> and <TIME>'
        }
      ];

      tests.forEach(({ input, expected }) => {
        const result = utils.stripTimestamps(input);
        expect(result).toBe(expected);
      });
    });

    it('should strip dynamic values', () => {
      const tests = [
        {
          input: 'UUID: 123e4567-e89b-12d3-a456-426614174000',
          expected: 'UUID: <UUID>'
        },
        {
          input: 'Took 125ms to complete',
          expected: 'Took <DURATION> to complete'
        },
        {
          input: 'Elapsed: 3.45s',
          expected: 'Elapsed: <DURATION>'
        },
        {
          input: 'Process pid: 12345',
          expected: 'Process pid: <PID>'
        },
        {
          input: 'Server running on port: 8080',
          expected: 'Server running on port: <PORT>'
        }
      ];

      tests.forEach(({ input, expected }) => {
        const result = utils.stripDynamicValues(input);
        expect(result).toBe(expected);
      });
    });

    it('should prepare text for snapshot', () => {
      const input = `
        \x1b[32mGreen text\x1b[0m at 2024-01-01T00:00:00.000Z
        UUID: 550e8400-e29b-41d4-a716-446655440000
        Process pid: 1234 on port: 3000
        Completed in 123ms  
      `;

      const result = utils.prepareForSnapshot(input);
      
      expect(result).not.toContain('\x1b[32m');
      expect(result).not.toContain('2024-01-01');
      expect(result).toContain('<TIMESTAMP>');
      expect(result).toContain('<UUID>');
      expect(result).toContain('pid: <PID>');
      expect(result).toContain('port: <PORT>');
      expect(result).toContain('<DURATION>');
      expect(result).not.toMatch(/\s+$/gm); // No trailing spaces
    });
  });

  describe('Snapshot Assertions', () => {
    it('should assert snapshot match', async () => {
      const content = 'Test content for assertion';
      
      // First time should pass (creates snapshot)
      await utils.assertSnapshot('assert-test', content);
      
      // Same content should pass
      await utils.assertSnapshot('assert-test', content);
      
      // Different content should throw
      await expect(
        utils.assertSnapshot('assert-test', 'Different content')
      ).rejects.toThrow('Snapshot mismatch');
    });

    it('should generate diff for mismatches', async () => {
      await utils.saveSnapshot('diff-test', 'Line 1\nLine 2\nLine 3');
      
      try {
        await utils.assertSnapshot('diff-test', 'Line 1\nModified\nLine 3');
      } catch (error: any) {
        expect(error.message).toContain('Snapshot mismatch');
        expect(error.message).toContain('- Line 2');
        expect(error.message).toContain('+ Modified');
      }
    });
  });

  describe('toMatchSnapshot Helper', () => {
    it('should match snapshot', async () => {
      const result = await toMatchSnapshot('Test content', 'helper-test');
      expect(result.pass).toBe(true);
      
      const secondResult = await toMatchSnapshot('Test content', 'helper-test');
      expect(secondResult.pass).toBe(true);
    });

    it('should fail on mismatch', async () => {
      await toMatchSnapshot('Original', 'helper-mismatch');
      
      const result = await toMatchSnapshot('Changed', 'helper-mismatch');
      expect(result.pass).toBe(false);
      expect(result.message).toContain('Snapshot mismatch');
    });

    it('should update snapshot when requested', async () => {
      await toMatchSnapshot('Original', 'helper-update');
      
      const result = await toMatchSnapshot('Updated', 'helper-update', { update: true });
      expect(result.pass).toBe(true);
      
      // Verify it was updated
      const verifyResult = await toMatchSnapshot('Updated', 'helper-update');
      expect(verifyResult.pass).toBe(true);
    });

    it('should respect UPDATE_SNAPSHOTS env var', async () => {
      const originalEnv = process.env.UPDATE_SNAPSHOTS;
      
      await toMatchSnapshot('Original', 'env-test');
      
      process.env.UPDATE_SNAPSHOTS = 'true';
      const result = await toMatchSnapshot('New content', 'env-test');
      expect(result.pass).toBe(true);
      
      process.env.UPDATE_SNAPSHOTS = originalEnv;
      
      // Verify it was updated
      const verifyResult = await toMatchSnapshot('New content', 'env-test');
      expect(verifyResult.pass).toBe(true);
    });
  });
});