// @ts-nocheck - TODO: Create MockFileSystemService implementation
import { describe, it, expect, beforeEach } from 'bun:test';
import type { FileChangeHandler } from '../../src/interfaces/IFileSystemService';

describe('MockFileSystemService', () => {
  let mockFS: MockFileSystemService;

  beforeEach(() => {
    mockFS = new MockFileSystemService();
  });

  describe('exists', () => {
    it('should return false for non-existent paths', async () => {
      expect(await mockFS.exists('/nonexistent')).toBe(false);
    });

    it('should return true for files that exist', async () => {
      mockFS.addFile('/test.txt', 'content');
      expect(await mockFS.exists('/test.txt')).toBe(true);
    });

    it('should return true for directories that exist', async () => {
      mockFS.addDirectory('/testdir');
      expect(await mockFS.exists('/testdir')).toBe(true);
    });

    it('should track method calls', async () => {
      await mockFS.exists('/test');
      expect(mockFS.wasCalled('exists')).toBe(true);
      expect(mockFS.getCallCount('exists')).toBe(1);
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('exists');
      await expect(mockFS.exists('/test')).rejects.toThrow('Mock error: exists failed');
      expect(mockFS.shouldFailNext).toBeNull();
    });
  });

  describe('readFile', () => {
    it('should read string content', async () => {
      mockFS.addFile('/test.txt', 'test content');
      const content = await mockFS.readFile('/test.txt');
      expect(content).toBe('test content');
    });

    it('should read buffer content as string', async () => {
      const buffer = Buffer.from('buffer content');
      mockFS.addFile('/test.bin', buffer);
      const content = await mockFS.readFile('/test.bin');
      expect(content).toBe('buffer content');
    });

    it('should respect encoding option for buffer content', async () => {
      const buffer = Buffer.from('test', 'utf8');
      mockFS.addFile('/test.txt', buffer);
      const content = await mockFS.readFile('/test.txt', { encoding: 'utf8' });
      expect(content).toBe('test');
    });

    it('should throw error for non-existent file', async () => {
      await expect(mockFS.readFile('/nonexistent')).rejects.toThrow('File not found: /nonexistent');
    });

    it('should track read history', async () => {
      mockFS.addFile('/test.txt', 'content');
      await mockFS.readFile('/test.txt');
      expect(mockFS.readHistory).toContain('/test.txt');
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('readFile');
      await expect(mockFS.readFile('/test')).rejects.toThrow('Mock error: readFile failed');
    });
  });

  describe('readFileBuffer', () => {
    it('should return buffer for string content', async () => {
      mockFS.addFile('/test.txt', 'test content');
      const buffer = await mockFS.readFileBuffer('/test.txt');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe('test content');
    });

    it('should return buffer for buffer content', async () => {
      const originalBuffer = Buffer.from('buffer content');
      mockFS.addFile('/test.bin', originalBuffer);
      const buffer = await mockFS.readFileBuffer('/test.bin');
      expect(buffer).toEqual(originalBuffer);
    });

    it('should throw error for non-existent file', async () => {
      await expect(mockFS.readFileBuffer('/nonexistent')).rejects.toThrow('File not found: /nonexistent');
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('readFileBuffer');
      await expect(mockFS.readFileBuffer('/test')).rejects.toThrow('Mock error: readFileBuffer failed');
    });
  });

  describe('writeFile', () => {
    it('should write string content', async () => {
      await mockFS.writeFile('/test.txt', 'test content');
      expect(mockFS.getFileContent('/test.txt')).toBe('test content');
    });

    it('should write buffer content', async () => {
      const buffer = Buffer.from('buffer content');
      await mockFS.writeFile('/test.bin', buffer);
      expect(mockFS.getFileContent('/test.bin')).toEqual(buffer);
    });

    it('should track write history', async () => {
      await mockFS.writeFile('/test.txt', 'content');
      expect(mockFS.writeHistory).toHaveLength(1);
      expect(mockFS.writeHistory[0]).toEqual({ path: '/test.txt', content: 'content' });
    });

    it('should trigger watchers on write', async () => {
      let triggered = false;
      let eventType: string | undefined;
      let eventPath: string | undefined;

      const handler: FileChangeHandler = (event, path) => {
        triggered = true;
        eventType = event;
        eventPath = path;
      };

      mockFS.watch('/test.txt', handler);
      await mockFS.writeFile('/test.txt', 'content');

      expect(triggered).toBe(true);
      expect(eventType).toBe('change');
      expect(eventPath).toBe('/test.txt');
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('writeFile');
      await expect(mockFS.writeFile('/test', 'content')).rejects.toThrow('Mock error: writeFile failed');
    });

    it('should handle write options', async () => {
      await mockFS.writeFile('/test.txt', 'content', { encoding: 'utf8' });
      expect(mockFS.wasCalled('writeFile')).toBe(true);
    });
  });

  describe('appendFile', () => {
    it('should append to existing string file', async () => {
      mockFS.addFile('/test.txt', 'initial');
      await mockFS.appendFile('/test.txt', ' appended');
      expect(mockFS.getFileContent('/test.txt')).toBe('initial appended');
    });

    it('should append to existing buffer file', async () => {
      const initial = Buffer.from('initial');
      const append = Buffer.from(' appended');
      mockFS.addFile('/test.bin', initial);
      await mockFS.appendFile('/test.bin', append);
      const result = mockFS.getFileContent('/test.bin') as Buffer;
      expect(result.toString()).toBe('initial appended');
    });

    it('should append buffer to string file', async () => {
      mockFS.addFile('/test.txt', 'initial');
      const append = Buffer.from(' appended');
      await mockFS.appendFile('/test.txt', append);
      expect(mockFS.getFileContent('/test.txt')).toBe('initial appended');
    });

    it('should append string to buffer file', async () => {
      const initial = Buffer.from('initial');
      mockFS.addFile('/test.bin', initial);
      await mockFS.appendFile('/test.bin', ' appended');
      expect(mockFS.getFileContent('/test.bin')).toBe('initial appended');
    });

    it('should create new file if it does not exist', async () => {
      await mockFS.appendFile('/new.txt', 'content');
      expect(mockFS.getFileContent('/new.txt')).toBe('content');
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('appendFile');
      await expect(mockFS.appendFile('/test', 'content')).rejects.toThrow('Mock error: appendFile failed');
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      mockFS.addFile('/test.txt', 'content');
      await mockFS.deleteFile('/test.txt');
      expect(await mockFS.exists('/test.txt')).toBe(false);
    });

    it('should throw error for non-existent file', async () => {
      await expect(mockFS.deleteFile('/nonexistent')).rejects.toThrow('File not found: /nonexistent');
    });

    it('should trigger watchers on delete', async () => {
      let triggered = false;
      let eventType: string | undefined;

      const handler: FileChangeHandler = (event) => {
        triggered = true;
        eventType = event;
      };

      mockFS.addFile('/test.txt', 'content');
      mockFS.watch('/test.txt', handler);
      await mockFS.deleteFile('/test.txt');

      expect(triggered).toBe(true);
      expect(eventType).toBe('rename');
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('deleteFile');
      await expect(mockFS.deleteFile('/test')).rejects.toThrow('Mock error: deleteFile failed');
    });
  });

  describe('createDirectory', () => {
    it('should create directory', async () => {
      await mockFS.createDirectory('/testdir');
      expect(await mockFS.isDirectory('/testdir')).toBe(true);
    });

    it('should create directory recursively', async () => {
      await mockFS.createDirectory('/path/to/nested/dir', true);
      expect(await mockFS.isDirectory('/path')).toBe(true);
      expect(await mockFS.isDirectory('/path/to')).toBe(true);
      expect(await mockFS.isDirectory('/path/to/nested')).toBe(true);
      expect(await mockFS.isDirectory('/path/to/nested/dir')).toBe(true);
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('createDirectory');
      await expect(mockFS.createDirectory('/test')).rejects.toThrow('Mock error: createDirectory failed');
    });
  });

  describe('removeDirectory', () => {
    it('should remove empty directory', async () => {
      mockFS.addDirectory('/testdir');
      await mockFS.removeDirectory('/testdir');
      expect(await mockFS.isDirectory('/testdir')).toBe(false);
    });

    it('should throw error for non-existent directory', async () => {
      await expect(mockFS.removeDirectory('/nonexistent')).rejects.toThrow('Directory not found: /nonexistent');
    });

    it('should remove directory recursively', async () => {
      mockFS.addDirectory('/parent');
      mockFS.addDirectory('/parent/child');
      mockFS.addFile('/parent/file.txt', 'content');
      mockFS.addFile('/parent/child/nested.txt', 'nested');

      await mockFS.removeDirectory('/parent', true);

      expect(await mockFS.isDirectory('/parent')).toBe(false);
      expect(await mockFS.isDirectory('/parent/child')).toBe(false);
      expect(await mockFS.exists('/parent/file.txt')).toBe(false);
      expect(await mockFS.exists('/parent/child/nested.txt')).toBe(false);
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('removeDirectory');
      await expect(mockFS.removeDirectory('/test')).rejects.toThrow('Mock error: removeDirectory failed');
    });
  });

  describe('readDirectory', () => {
    it('should read directory contents', async () => {
      mockFS.addDirectory('/testdir');
      mockFS.addFile('/testdir/file1.txt', 'content1');
      mockFS.addFile('/testdir/file2.txt', 'content2');
      mockFS.addDirectory('/testdir/subdir');

      const entries = await mockFS.readDirectory('/testdir');
      expect(entries).toContain('file1.txt');
      expect(entries).toContain('file2.txt');
      expect(entries).toContain('subdir');
    });

    it('should handle directory path with trailing slash', async () => {
      mockFS.addDirectory('/testdir');
      mockFS.addDirectory('/testdir/'); // Add both forms to handle edge case
      mockFS.addFile('/testdir/file.txt', 'content');

      const entries = await mockFS.readDirectory('/testdir/');
      expect(entries).toContain('file.txt');
    });

    it('should only return direct children', async () => {
      mockFS.addDirectory('/testdir');
      mockFS.addFile('/testdir/file.txt', 'content');
      mockFS.addDirectory('/testdir/subdir');
      mockFS.addFile('/testdir/subdir/nested.txt', 'nested');

      const entries = await mockFS.readDirectory('/testdir');
      expect(entries).toContain('file.txt');
      expect(entries).toContain('subdir');
      expect(entries).not.toContain('nested.txt');
    });

    it('should throw error for non-existent directory', async () => {
      await expect(mockFS.readDirectory('/nonexistent')).rejects.toThrow('Directory not found: /nonexistent');
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('readDirectory');
      await expect(mockFS.readDirectory('/test')).rejects.toThrow('Mock error: readDirectory failed');
    });
  });

  describe('getFileInfo', () => {
    it('should return file info for file', async () => {
      mockFS.addFile('/test.txt', 'content');
      const info = await mockFS.getFileInfo('/test.txt');

      expect(info.path).toBe('/test.txt');
      expect(info.size).toBe(7); // 'content' is 7 bytes
      expect(info.isFile).toBe(true);
      expect(info.isDirectory).toBe(false);
      expect(info.permissions).toBe('644');
      expect(info.createdAt).toBeInstanceOf(Date);
      expect(info.modifiedAt).toBeInstanceOf(Date);
    });

    it('should return file info for buffer file', async () => {
      const buffer = Buffer.from('buffer content');
      mockFS.addFile('/test.bin', buffer);
      const info = await mockFS.getFileInfo('/test.bin');

      expect(info.size).toBe(buffer.length);
    });

    it('should return directory info for directory', async () => {
      mockFS.addDirectory('/testdir');
      const info = await mockFS.getFileInfo('/testdir');

      expect(info.path).toBe('/testdir');
      expect(info.size).toBe(0);
      expect(info.isFile).toBe(false);
      expect(info.isDirectory).toBe(true);
      expect(info.permissions).toBe('755');
    });

    it('should throw error for non-existent path', async () => {
      await expect(mockFS.getFileInfo('/nonexistent')).rejects.toThrow('Path not found: /nonexistent');
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('getFileInfo');
      await expect(mockFS.getFileInfo('/test')).rejects.toThrow('Mock error: getFileInfo failed');
    });
  });

  describe('copyFile', () => {
    it('should copy file content', async () => {
      mockFS.addFile('/source.txt', 'content');
      await mockFS.copyFile('/source.txt', '/dest.txt');

      expect(mockFS.getFileContent('/dest.txt')).toBe('content');
      expect(mockFS.getFileContent('/source.txt')).toBe('content'); // Original should still exist
    });

    it('should copy buffer content', async () => {
      const buffer = Buffer.from('buffer content');
      mockFS.addFile('/source.bin', buffer);
      await mockFS.copyFile('/source.bin', '/dest.bin');

      expect(mockFS.getFileContent('/dest.bin')).toEqual(buffer);
    });

    it('should throw error for non-existent source', async () => {
      await expect(mockFS.copyFile('/nonexistent', '/dest')).rejects.toThrow('Source file not found: /nonexistent');
    });

    it('should trigger watchers on destination', async () => {
      let triggered = false;
      const handler: FileChangeHandler = () => { triggered = true; };

      mockFS.addFile('/source.txt', 'content');
      mockFS.watch('/dest.txt', handler);
      await mockFS.copyFile('/source.txt', '/dest.txt');

      expect(triggered).toBe(true);
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('copyFile');
      await expect(mockFS.copyFile('/source', '/dest')).rejects.toThrow('Mock error: copyFile failed');
    });
  });

  describe('moveFile', () => {
    it('should move file content', async () => {
      mockFS.addFile('/source.txt', 'content');
      await mockFS.moveFile('/source.txt', '/dest.txt');

      expect(mockFS.getFileContent('/dest.txt')).toBe('content');
      expect(await mockFS.exists('/source.txt')).toBe(false);
    });

    it('should throw error for non-existent source', async () => {
      await expect(mockFS.moveFile('/nonexistent', '/dest')).rejects.toThrow('Source file not found: /nonexistent');
    });

    it('should trigger watchers on both paths', async () => {
      const events: Array<{ event: string; path: string }> = [];
      const handler = (event: string, path: string) => {
        events.push({ event, path });
      };

      mockFS.addFile('/source.txt', 'content');
      mockFS.watch('/source.txt', handler);
      mockFS.watch('/dest.txt', handler);
      await mockFS.moveFile('/source.txt', '/dest.txt');

      expect(events).toContainEqual({ event: 'rename', path: '/source.txt' });
      expect(events).toContainEqual({ event: 'change', path: '/dest.txt' });
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('moveFile');
      await expect(mockFS.moveFile('/source', '/dest')).rejects.toThrow('Mock error: moveFile failed');
    });
  });

  describe('createTempFile', () => {
    it('should create temp file with default name', async () => {
      const path = await mockFS.createTempFile();
      expect(path).toMatch(/^\/tmp\/tmp-\d+$/);
      expect(await mockFS.exists(path)).toBe(true);
    });

    it('should create temp file with custom prefix and extension', async () => {
      const path = await mockFS.createTempFile('test', '.txt');
      expect(path).toMatch(/^\/tmp\/test-\d+\.txt$/);
      expect(await mockFS.exists(path)).toBe(true);
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('createTempFile');
      await expect(mockFS.createTempFile()).rejects.toThrow('Mock error: createTempFile failed');
    });
  });

  describe('createTempDirectory', () => {
    it('should create temp directory with default name', async () => {
      const path = await mockFS.createTempDirectory();
      expect(path).toMatch(/^\/tmp\/tmp-\d+$/);
      expect(await mockFS.isDirectory(path)).toBe(true);
    });

    it('should create temp directory with custom prefix', async () => {
      const path = await mockFS.createTempDirectory('test');
      expect(path).toMatch(/^\/tmp\/test-\d+$/);
      expect(await mockFS.isDirectory(path)).toBe(true);
    });

    it('should fail when configured to fail', async () => {
      mockFS.failNextCall('createTempDirectory');
      await expect(mockFS.createTempDirectory()).rejects.toThrow('Mock error: createTempDirectory failed');
    });
  });

  describe('watch', () => {
    it('should register watcher', () => {
      const handler: FileChangeHandler = () => {};
      const unwatch = mockFS.watch('/test.txt', handler);

      expect(typeof unwatch).toBe('function');
      expect(mockFS.wasCalled('watch')).toBe(true);
    });

    it('should handle multiple watchers for same path', () => {
      const handler1: FileChangeHandler = () => {};
      const handler2: FileChangeHandler = () => {};

      mockFS.watch('/test.txt', handler1);
      mockFS.watch('/test.txt', handler2);

      expect(mockFS.getCallCount('watch')).toBe(2);
    });

    it('should allow unwatching', () => {
      let triggered = false;
      const handler: FileChangeHandler = () => { triggered = true; };

      const unwatch = mockFS.watch('/test.txt', handler);
      unwatch();

      mockFS.triggerFileChange('/test.txt');
      expect(triggered).toBe(false);
    });

    it('should clean up empty watcher sets', () => {
      const handler: FileChangeHandler = () => {};
      const unwatch = mockFS.watch('/test.txt', handler);
      unwatch();

      // Internal implementation detail: empty handler sets should be removed
      expect((mockFS as any).watchers.has('/test.txt')).toBe(false);
    });
  });

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', async () => {
      await mockFS.ensureDirectory('/newdir');
      expect(await mockFS.isDirectory('/newdir')).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      mockFS.addDirectory('/existingdir');
      await mockFS.ensureDirectory('/existingdir');
      expect(await mockFS.isDirectory('/existingdir')).toBe(true);
    });
  });

  describe('isDirectory and isFile', () => {
    it('should correctly identify directories', async () => {
      mockFS.addDirectory('/testdir');
      expect(await mockFS.isDirectory('/testdir')).toBe(true);
      expect(await mockFS.isDirectory('/nonexistent')).toBe(false);
    });

    it('should correctly identify files', async () => {
      mockFS.addFile('/test.txt', 'content');
      expect(await mockFS.isFile('/test.txt')).toBe(true);
      expect(await mockFS.isFile('/nonexistent')).toBe(false);
    });
  });

  describe('test utilities', () => {
    it('should clear all data', async () => {
      mockFS.addFile('/test.txt', 'content');
      mockFS.addDirectory('/testdir');
      mockFS.readHistory.push('/test.txt');
      mockFS.writeHistory.push({ path: '/test.txt', content: 'content' });

      mockFS.clear();

      expect(await mockFS.exists('/test.txt')).toBe(false);
      expect(await mockFS.exists('/testdir')).toBe(false);
      expect(mockFS.readHistory).toHaveLength(0);
      expect(mockFS.writeHistory).toHaveLength(0);
    });

    it('should clear history only', async () => {
      mockFS.addFile('/test.txt', 'content');
      await mockFS.readFile('/test.txt');

      expect(mockFS.readHistory).toHaveLength(1);
      expect(mockFS.methodCalls.size).toBeGreaterThan(0);

      mockFS.clearHistory();

      expect(mockFS.readHistory).toHaveLength(0);
      expect(mockFS.methodCalls.size).toBe(0);
      // File should still exist after clearing history
      expect(mockFS.getFileContent('/test.txt')).toBe('content');
    });

    it('should track method call counts', async () => {
      await mockFS.exists('/test1');
      await mockFS.exists('/test2');
      expect(mockFS.getCallCount('exists')).toBe(2);
    });

    it('should check if method was called', async () => {
      expect(mockFS.wasCalled('exists')).toBe(false);
      await mockFS.exists('/test');
      expect(mockFS.wasCalled('exists')).toBe(true);
    });

    it('should return undefined for non-existent file content', () => {
      expect(mockFS.getFileContent('/nonexistent')).toBeUndefined();
    });

    it('should manually trigger file changes', () => {
      let triggered = false;
      const handler: FileChangeHandler = () => { triggered = true; };

      mockFS.watch('/test.txt', handler);
      mockFS.triggerFileChange('/test.txt');

      expect(triggered).toBe(true);
    });
  });

  describe('watcher error handling', () => {
    it('should swallow errors in watcher handlers', () => {
      const errorHandler: FileChangeHandler = () => {
        throw new Error('Handler error');
      };

      mockFS.watch('/test.txt', errorHandler);

      // Should not throw
      expect(() => mockFS.triggerFileChange('/test.txt')).not.toThrow();
    });

    it('should continue calling other handlers after one throws', () => {
      let handler1Called = false;
      let handler2Called = false;

      const errorHandler: FileChangeHandler = () => {
        handler1Called = true;
        throw new Error('Handler error');
      };

      const goodHandler: FileChangeHandler = () => {
        handler2Called = true;
      };

      mockFS.watch('/test.txt', errorHandler);
      mockFS.watch('/test.txt', goodHandler);

      mockFS.triggerFileChange('/test.txt');

      expect(handler1Called).toBe(true);
      expect(handler2Called).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty file content', async () => {
      mockFS.addFile('/empty.txt', '');
      const content = await mockFS.readFile('/empty.txt');
      expect(content).toBe('');
    });

    it('should handle root directory operations', async () => {
      mockFS.addDirectory('/');
      mockFS.addFile('/root-file.txt', 'content');

      const entries = await mockFS.readDirectory('/');
      expect(entries).toContain('root-file.txt');
    });

    it('should handle paths with multiple consecutive slashes', async () => {
      mockFS.addDirectory('/test//dir');
      expect(await mockFS.isDirectory('/test//dir')).toBe(true);
    });

    it('should maintain file metadata consistency', async () => {
      const content = 'test content with unicode: 🚀';
      mockFS.addFile('/unicode.txt', content);

      const info = await mockFS.getFileInfo('/unicode.txt');
      expect(info.size).toBe(Buffer.byteLength(content));
    });
  });
});