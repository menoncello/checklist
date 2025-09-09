import type {
  IFileSystemService,
  FileInfo,
  ReadOptions,
  WriteOptions,
  WatchOptions,
  FileChangeHandler,
} from '../src/interfaces/IFileSystemService';

interface VirtualFile {
  content: string | Buffer;
  metadata: FileInfo;
}

export class MockFileSystemService implements IFileSystemService {
  private files: Map<string, VirtualFile> = new Map();
  private directories: Set<string> = new Set();
  private watchers: Map<string, Set<FileChangeHandler>> = new Map();

  // Spy tracking
  public methodCalls: Map<string, unknown[]> = new Map();
  public shouldFailNext: string | null = null;
  public readHistory: string[] = [];
  public writeHistory: Array<{ path: string; content: string | Buffer }> = [];

  async exists(path: string): Promise<boolean> {
    this.trackCall('exists', path);

    if (this.shouldFailNext === 'exists') {
      this.shouldFailNext = null;
      throw new Error('Mock error: exists failed');
    }

    return this.files.has(path) || this.directories.has(path);
  }

  async readFile(path: string, options?: ReadOptions): Promise<string> {
    this.trackCall('readFile', path, options);
    this.readHistory.push(path);

    if (this.shouldFailNext === 'readFile') {
      this.shouldFailNext = null;
      throw new Error('Mock error: readFile failed');
    }

    const file = this.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    if (Buffer.isBuffer(file.content)) {
      return file.content.toString(
        (options?.encoding as BufferEncoding) ?? 'utf8'
      );
    }

    return file.content;
  }

  async readFileBuffer(path: string): Promise<Buffer> {
    this.trackCall('readFileBuffer', path);

    if (this.shouldFailNext === 'readFileBuffer') {
      this.shouldFailNext = null;
      throw new Error('Mock error: readFileBuffer failed');
    }

    const file = this.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }

    if (Buffer.isBuffer(file.content)) {
      return file.content;
    }

    return Buffer.from(file.content);
  }

  async writeFile(
    path: string,
    data: string | Buffer,
    options?: WriteOptions
  ): Promise<void> {
    this.trackCall('writeFile', path, data, options);
    this.writeHistory.push({ path, content: data });

    if (this.shouldFailNext === 'writeFile') {
      this.shouldFailNext = null;
      throw new Error('Mock error: writeFile failed');
    }

    this.files.set(path, {
      content: data,
      metadata: this.createFileInfo(path, data),
    });

    this.triggerWatchers(path, 'change');
  }

  async appendFile(
    path: string,
    data: string | Buffer,
    options?: WriteOptions
  ): Promise<void> {
    this.trackCall('appendFile', path, data, options);

    if (this.shouldFailNext === 'appendFile') {
      this.shouldFailNext = null;
      throw new Error('Mock error: appendFile failed');
    }

    const existing = this.files.get(path);
    let newContent: string | Buffer;

    if (existing) {
      if (Buffer.isBuffer(existing.content) && Buffer.isBuffer(data)) {
        newContent = Buffer.concat([existing.content, data]);
      } else {
        const existingStr = Buffer.isBuffer(existing.content)
          ? existing.content.toString()
          : existing.content;
        const dataStr = Buffer.isBuffer(data) ? data.toString() : data;
        newContent = existingStr + dataStr;
      }
    } else {
      newContent = data;
    }

    await this.writeFile(path, newContent, options);
  }

  async deleteFile(path: string): Promise<void> {
    this.trackCall('deleteFile', path);

    if (this.shouldFailNext === 'deleteFile') {
      this.shouldFailNext = null;
      throw new Error('Mock error: deleteFile failed');
    }

    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }

    this.files.delete(path);
    this.triggerWatchers(path, 'rename');
  }

  async createDirectory(path: string, recursive?: boolean): Promise<void> {
    this.trackCall('createDirectory', path, recursive);

    if (this.shouldFailNext === 'createDirectory') {
      this.shouldFailNext = null;
      throw new Error('Mock error: createDirectory failed');
    }

    this.directories.add(path);

    if (recursive === true) {
      const parts = path.split('/');
      let currentPath = '';
      for (const part of parts) {
        if (part) {
          currentPath += '/' + part;
          this.directories.add(currentPath);
        }
      }
    }
  }

  async removeDirectory(path: string, recursive?: boolean): Promise<void> {
    this.trackCall('removeDirectory', path, recursive);

    if (this.shouldFailNext === 'removeDirectory') {
      this.shouldFailNext = null;
      throw new Error('Mock error: removeDirectory failed');
    }

    if (!this.directories.has(path)) {
      throw new Error(`Directory not found: ${path}`);
    }

    this.directories.delete(path);

    if (recursive === true) {
      // Remove all subdirectories and files
      const toRemove: string[] = [];

      for (const dir of this.directories) {
        if (dir.startsWith(path + '/')) {
          toRemove.push(dir);
        }
      }

      for (const file of this.files.keys()) {
        if (file.startsWith(path + '/')) {
          toRemove.push(file);
        }
      }

      for (const item of toRemove) {
        this.directories.delete(item);
        this.files.delete(item);
      }
    }
  }

  async readDirectory(path: string): Promise<string[]> {
    this.trackCall('readDirectory', path);

    if (this.shouldFailNext === 'readDirectory') {
      this.shouldFailNext = null;
      throw new Error('Mock error: readDirectory failed');
    }

    if (!this.directories.has(path)) {
      throw new Error(`Directory not found: ${path}`);
    }

    const entries: Set<string> = new Set();
    const pathWithSlash = path.endsWith('/') ? path : path + '/';

    // Find direct children
    for (const file of this.files.keys()) {
      if (file.startsWith(pathWithSlash)) {
        const relative = file.substring(pathWithSlash.length);
        const firstSlash = relative.indexOf('/');
        if (firstSlash === -1) {
          entries.add(relative);
        } else {
          entries.add(relative.substring(0, firstSlash));
        }
      }
    }

    for (const dir of this.directories) {
      if (dir.startsWith(pathWithSlash) && dir !== path) {
        const relative = dir.substring(pathWithSlash.length);
        const firstSlash = relative.indexOf('/');
        if (firstSlash === -1) {
          entries.add(relative);
        } else {
          entries.add(relative.substring(0, firstSlash));
        }
      }
    }

    return Array.from(entries);
  }

  async getFileInfo(path: string): Promise<FileInfo> {
    this.trackCall('getFileInfo', path);

    if (this.shouldFailNext === 'getFileInfo') {
      this.shouldFailNext = null;
      throw new Error('Mock error: getFileInfo failed');
    }

    const file = this.files.get(path);
    if (file) {
      return file.metadata;
    }

    if (this.directories.has(path)) {
      return {
        path,
        size: 0,
        isDirectory: true,
        isFile: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
        permissions: '755',
      };
    }

    throw new Error(`Path not found: ${path}`);
  }

  async copyFile(source: string, destination: string): Promise<void> {
    this.trackCall('copyFile', source, destination);

    if (this.shouldFailNext === 'copyFile') {
      this.shouldFailNext = null;
      throw new Error('Mock error: copyFile failed');
    }

    const file = this.files.get(source);
    if (!file) {
      throw new Error(`Source file not found: ${source}`);
    }

    this.files.set(destination, {
      content: file.content,
      metadata: this.createFileInfo(destination, file.content),
    });

    this.triggerWatchers(destination, 'change');
  }

  async moveFile(source: string, destination: string): Promise<void> {
    this.trackCall('moveFile', source, destination);

    if (this.shouldFailNext === 'moveFile') {
      this.shouldFailNext = null;
      throw new Error('Mock error: moveFile failed');
    }

    const file = this.files.get(source);
    if (!file) {
      throw new Error(`Source file not found: ${source}`);
    }

    this.files.set(destination, file);
    this.files.delete(source);

    this.triggerWatchers(source, 'rename');
    this.triggerWatchers(destination, 'change');
  }

  async createTempFile(prefix?: string, extension?: string): Promise<string> {
    this.trackCall('createTempFile', prefix, extension);

    if (this.shouldFailNext === 'createTempFile') {
      this.shouldFailNext = null;
      throw new Error('Mock error: createTempFile failed');
    }

    const path = `/tmp/${prefix ?? 'tmp'}-${Date.now()}${extension ?? ''}`;
    await this.writeFile(path, '');
    return path;
  }

  async createTempDirectory(prefix?: string): Promise<string> {
    this.trackCall('createTempDirectory', prefix);

    if (this.shouldFailNext === 'createTempDirectory') {
      this.shouldFailNext = null;
      throw new Error('Mock error: createTempDirectory failed');
    }

    const path = `/tmp/${prefix ?? 'tmp'}-${Date.now()}`;
    await this.createDirectory(path);
    return path;
  }

  watch(
    path: string,
    handler: FileChangeHandler,
    options?: WatchOptions
  ): () => void {
    this.trackCall('watch', path, options);

    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set());
    }

    this.watchers.get(path)?.add(handler);

    return () => {
      const handlers = this.watchers.get(path);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.watchers.delete(path);
        }
      }
    };
  }

  async ensureDirectory(path: string): Promise<void> {
    this.trackCall('ensureDirectory', path);

    if (!(await this.exists(path))) {
      await this.createDirectory(path, true);
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    this.trackCall('isDirectory', path);
    return this.directories.has(path);
  }

  async isFile(path: string): Promise<boolean> {
    this.trackCall('isFile', path);
    return this.files.has(path);
  }

  // Test utilities
  addFile(path: string, content: string | Buffer): void {
    this.files.set(path, {
      content,
      metadata: this.createFileInfo(path, content),
    });
  }

  addDirectory(path: string): void {
    this.directories.add(path);
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.watchers.clear();
    this.clearHistory();
  }

  failNextCall(methodName: string): void {
    this.shouldFailNext = methodName;
  }

  clearHistory(): void {
    this.methodCalls.clear();
    this.readHistory = [];
    this.writeHistory = [];
  }

  getCallCount(methodName: string): number {
    return this.methodCalls.get(methodName)?.length ?? 0;
  }

  wasCalled(methodName: string): boolean {
    return this.getCallCount(methodName) > 0;
  }

  getFileContent(path: string): string | Buffer | undefined {
    return this.files.get(path)?.content;
  }

  triggerFileChange(path: string): void {
    this.triggerWatchers(path, 'change');
  }

  private trackCall(methodName: string, ...args: unknown[]): void {
    if (!this.methodCalls.has(methodName)) {
      this.methodCalls.set(methodName, []);
    }
    this.methodCalls.get(methodName)?.push(args);
  }

  private createFileInfo(path: string, content: string | Buffer): FileInfo {
    const size = Buffer.isBuffer(content)
      ? content.length
      : Buffer.byteLength(content);

    return {
      path,
      size,
      isDirectory: false,
      isFile: true,
      createdAt: new Date(),
      modifiedAt: new Date(),
      permissions: '644',
    };
  }

  private triggerWatchers(path: string, event: 'change' | 'rename'): void {
    const handlers = this.watchers.get(path);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event, path);
        } catch (_error) {
          // Swallow errors in test watchers
        }
      }
    }
  }
}
