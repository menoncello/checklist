import { EventEmitter } from 'events';
import * as pty from 'node-pty';

export interface TUITestHarnessOptions {
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
}

export class TUITestHarness extends EventEmitter {
  private pty: pty.IPty | null = null;
  private output: string = '';
  private outputBuffer: string[] = [];
  private cols: number;
  private rows: number;
  private isRunning: boolean = false;

  constructor(options: TUITestHarnessOptions = {}) {
    super();
    this.cols = options.cols ?? 80;
    this.rows = options.rows ?? 24;
  }

  async spawn(
    command: string,
    args: string[] = [],
    options: TUITestHarnessOptions = {}
  ): Promise<void> {
    if (this.pty) {
      throw new Error('PTY already spawned');
    }

    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLUMNS: String(this.cols),
      LINES: String(this.rows),
      ...options.env,
    };

    this.pty = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: options.cols ?? this.cols,
      rows: options.rows ?? this.rows,
      cwd: options.cwd ?? process.cwd(),
      env,
    });

    this.isRunning = true;

    this.pty.onData((data: string) => {
      this.output += data;
      this.outputBuffer.push(data);
      this.emit('data', data);
    });

    this.pty.onExit(({ exitCode, signal }) => {
      this.isRunning = false;
      this.emit('exit', { exitCode, signal });
    });
  }

  write(data: string): void {
    if (!this.pty) {
      throw new Error('PTY not spawned');
    }
    this.pty.write(data);
  }

  sendKey(key: string): void {
    const keyMap: Record<string, string> = {
      enter: '\r',
      tab: '\t',
      backspace: '\x7f',
      escape: '\x1b',
      up: '\x1b[A',
      down: '\x1b[B',
      right: '\x1b[C',
      left: '\x1b[D',
      home: '\x1b[H',
      end: '\x1b[F',
      pageup: '\x1b[5~',
      pagedown: '\x1b[6~',
      delete: '\x1b[3~',
      'ctrl+c': '\x03',
      'ctrl+d': '\x04',
      'ctrl+z': '\x1a',
      'ctrl+l': '\x0c',
    };

    const sequence = keyMap[key.toLowerCase()] || key;
    this.write(sequence);
  }

  async waitForText(text: string, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.output.includes(text)) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);

      if (this.output.includes(text)) {
        clearInterval(checkInterval);
        resolve(true);
      }
    });
  }

  async waitForRegex(
    pattern: RegExp,
    timeout: number = 5000
  ): Promise<string | null> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const match = this.output.match(pattern);
        if (match) {
          clearInterval(checkInterval);
          resolve(match[0]);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 100);

      const match = this.output.match(pattern);
      if (match) {
        clearInterval(checkInterval);
        resolve(match[0]);
      }
    });
  }

  getOutput(): string {
    return this.output;
  }

  getCleanOutput(): string {
    return this.stripAnsi(this.output);
  }

  getLines(): string[] {
    return this.output.split('\n');
  }

  getScreen(): string[] {
    const lines = this.getLines();
    const lastLines = lines.slice(-this.rows);

    while (lastLines.length < this.rows) {
      lastLines.push('');
    }

    return lastLines.map((line) => {
      if (line.length > this.cols) {
        return line.substring(0, this.cols);
      }
      return line.padEnd(this.cols, ' ');
    });
  }

  clear(): void {
    this.output = '';
    this.outputBuffer = [];
  }

  resize(cols: number, rows: number): void {
    if (this.pty) {
      this.pty.resize(cols, rows);
    }
    this.cols = cols;
    this.rows = rows;
  }

  async close(): Promise<void> {
    if (this.pty) {
      this.pty.kill();
      this.pty = null;
      this.isRunning = false;
    }
  }

  async waitForExit(timeout: number = 10000): Promise<{
    exitCode: number | undefined;
    signal: number | undefined;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.isRunning) {
        resolve({ exitCode: 0, signal: undefined });
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error(`Process did not exit within ${timeout}ms`));
      }, timeout);

      this.once('exit', ({ exitCode, signal }) => {
        clearTimeout(timer);
        resolve({ exitCode, signal });
      });
    });
  }

  private stripAnsi(str: string): string {
    return str.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ''
    );
  }

  async screenshot(): Promise<string> {
    const screen = this.getScreen();
    return screen.join('\n');
  }

  async assertScreen(expected: string[]): Promise<void> {
    const actual = this.getScreen();
    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(
          `Screen mismatch at line ${i}:\nExpected: "${expected[i]}"\nActual:   "${actual[i]}"`
        );
      }
    }
  }

  async typeSequence(sequence: string, delay: number = 50): Promise<void> {
    for (const char of sequence) {
      this.write(char);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  getCursorPosition(): { x: number; y: number } | null {
    const match = this.output.match(/\x1b\[(\d+);(\d+)R$/);
    if (match) {
      return {
        x: parseInt(match[2], 10) - 1,
        y: parseInt(match[1], 10) - 1,
      };
    }
    return null;
  }
}
