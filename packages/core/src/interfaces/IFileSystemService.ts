export interface FileInfo {
  path: string;
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt?: Date;
  permissions?: string;
}

export interface ReadOptions {
  encoding?: 'utf8' | 'utf16le' | 'base64' | 'binary' | 'hex';
  flag?: string;
  maxLength?: number;
}

export interface WriteOptions extends ReadOptions {
  mode?: number;
  flag?: string;
  createDirectories?: boolean;
}

export interface WatchOptions {
  persistent?: boolean;
  recursive?: boolean;
  encoding?: string;
}

export type FileChangeHandler = (
  event: 'change' | 'rename',
  filename: string
) => void;

export interface IFileSystemService {
  exists(path: string): Promise<boolean>;
  readFile(path: string, options?: ReadOptions): Promise<string>;
  readFileBuffer(path: string): Promise<Buffer>;
  writeFile(
    path: string,
    data: string | Buffer,
    options?: WriteOptions
  ): Promise<void>;
  appendFile(
    path: string,
    data: string | Buffer,
    options?: WriteOptions
  ): Promise<void>;
  deleteFile(path: string): Promise<void>;
  createDirectory(path: string, recursive?: boolean): Promise<void>;
  removeDirectory(path: string, recursive?: boolean): Promise<void>;
  readDirectory(path: string): Promise<string[]>;
  getFileInfo(path: string): Promise<FileInfo>;
  copyFile(source: string, destination: string): Promise<void>;
  moveFile(source: string, destination: string): Promise<void>;
  createTempFile(prefix?: string, extension?: string): Promise<string>;
  createTempDirectory(prefix?: string): Promise<string>;
  watch(
    path: string,
    handler: FileChangeHandler,
    options?: WatchOptions
  ): () => void;
  ensureDirectory(path: string): Promise<void>;
  isDirectory(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
}
