import { ColorSupport } from './ColorSupport';
import { TerminalInfo } from './TerminalInfo';
import { CapabilityTest } from './types';

export class CapabilityTester {
  private terminalInfo: TerminalInfo;
  private colorSupport: ColorSupport;

  constructor(terminalInfo: TerminalInfo, colorSupport: ColorSupport) {
    this.terminalInfo = terminalInfo;
    this.colorSupport = colorSupport;
  }

  public createCapabilityTests(): CapabilityTest[] {
    return [
      ...this.createColorTests(),
      ...this.createUITests(),
      ...this.createTerminalFeatureTests(),
    ];
  }

  private createColorTests(): CapabilityTest[] {
    return [
      this.createTest({
        name: 'color',
        test: () => this.testColorSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Basic color support (16 colors)',
      }),
      this.createTest({
        name: 'color256',
        test: () => this.testColor256Support(),
        fallback: false,
        timeout: 1000,
        description: '256 color support',
      }),
      this.createTest({
        name: 'trueColor',
        test: () => this.testTrueColorSupport(),
        fallback: false,
        timeout: 1000,
        description: '24-bit true color support',
      }),
    ];
  }

  private createTest(options: {
    name: string;
    test: () => Promise<boolean>;
    fallback: boolean;
    timeout: number;
    description: string;
  }): CapabilityTest {
    return options;
  }

  private createUITests(): CapabilityTest[] {
    return [
      this.createTest({
        name: 'unicode',
        test: () => this.testUnicodeSupport(),
        fallback: true,
        timeout: 500,
        description: 'Unicode character support',
      }),
      this.createTest({
        name: 'mouse',
        test: () => this.testMouseSupport(),
        fallback: false,
        timeout: 2000,
        description: 'Mouse event support',
      }),
      this.createTest({
        name: 'cursorShape',
        test: () => this.testCursorShapeSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Cursor shape modification support',
      }),
    ];
  }

  private createTerminalFeatureTests(): CapabilityTest[] {
    return [
      this.createTest({
        name: 'altScreen',
        test: () => this.testAlternateScreenSupport(),
        fallback: false,
        timeout: 1500,
        description: 'Alternate screen buffer support',
      }),
      this.createTest({
        name: 'windowTitle',
        test: () => this.testWindowTitleSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Window title modification support',
      }),
      this.createTest({
        name: 'clipboard',
        test: () => this.testClipboardSupport(),
        fallback: false,
        timeout: 1500,
        description: 'Clipboard access support',
      }),
    ];
  }

  public async runTestWithTimeout(test: CapabilityTest): Promise<boolean> {
    return Promise.race([
      test.test(),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), test.timeout ?? 1000)
      ),
    ]);
  }

  private async testColorSupport(): Promise<boolean> {
    const colorSupport = this.colorSupport.detectBasicColor();
    return colorSupport ?? this.terminalInfo.supportsColor();
  }

  private async testColor256Support(): Promise<boolean> {
    const colorSupport = this.colorSupport.detect256Color();
    if (colorSupport !== null) return colorSupport;

    const term = this.terminalInfo.getTerminalType();
    return term.includes('256color') || term.includes('xterm');
  }

  private async testTrueColorSupport(): Promise<boolean> {
    const trueColorSupport = this.colorSupport.detectTrueColor();
    if (trueColorSupport !== null) {
      return trueColorSupport;
    }

    return this.queryTerminalCapability('\x1b[48;2;1;2;3m\x1b[0m', 1000);
  }

  private async testUnicodeSupport(): Promise<boolean> {
    const lang = Bun.env.LANG ?? '';
    if (lang.includes('UTF-8') || lang.includes('utf8')) return true;

    try {
      const testString = '▲△▼▽◆◇○●★☆';
      const encoded = Buffer.from(testString, 'utf8');
      return encoded.toString('utf8') === testString;
    } catch {
      return false;
    }
  }

  private async testMouseSupport(): Promise<boolean> {
    const term = this.terminalInfo.getTerminalType();
    const mouseCapableTerminals = [
      'xterm',
      'screen',
      'tmux',
      'alacritty',
      'kitty',
    ];

    return mouseCapableTerminals.some((t) => term.includes(t))
      ? this.queryTerminalCapability('\x1b[?1000h\x1b[?1000l', 500)
      : false;
  }

  private async testAlternateScreenSupport(): Promise<boolean> {
    const term = this.terminalInfo.getTerminalType();
    return term.includes('xterm') ||
      term.includes('screen') ||
      term.includes('tmux')
      ? true
      : this.queryTerminalCapability('\x1b[?1049h\x1b[?1049l', 500);
  }

  private async testCursorShapeSupport(): Promise<boolean> {
    const term = this.terminalInfo.getTerminalType();
    const cursorShapeTerminals = [
      'xterm',
      'gnome-terminal',
      'alacritty',
      'kitty',
    ];
    return cursorShapeTerminals.some((t) => term.includes(t));
  }

  private async testWindowTitleSupport(): Promise<boolean> {
    const sshTty = Bun.env.SSH_TTY;
    const sshConnection = Bun.env.SSH_CONNECTION;

    if (
      (sshTty !== undefined && sshTty.length > 0) ||
      (sshConnection !== undefined && sshConnection.length > 0)
    ) {
      return false;
    }

    const term = this.terminalInfo.getTerminalType();
    return (
      term.includes('xterm') ||
      term.includes('gnome') ||
      term.includes('alacritty')
    );
  }

  private async testClipboardSupport(): Promise<boolean> {
    const term = this.terminalInfo.getTerminalType();
    const clipboardCapableTerminals = [
      'xterm',
      'alacritty',
      'kitty',
      'wezterm',
    ];
    return clipboardCapableTerminals.some((t) => term.includes(t));
  }

  private async queryTerminalCapability(
    sequence: string,
    timeout: number
  ): Promise<boolean> {
    if (!this.isTTYAvailable()) {
      return false;
    }

    return this.performTerminalQuery(sequence, timeout);
  }

  private isTTYAvailable(): boolean {
    return process.stdin.isTTY === true && process.stdout.isTTY === true;
  }

  private async performTerminalQuery(
    sequence: string,
    timeout: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let responded = false;
      const cleanup = () => {
        if (!responded) {
          responded = true;
        }
      };
      const responseHandler = this.createResponseHandler(resolve, cleanup);
      const timeoutHandle = this.setupQueryTimeout(
        timeout,
        responseHandler,
        resolve,
        cleanup
      );

      if (!responded)
        this.executeQuery(sequence, responseHandler, timeoutHandle, cleanup);
    });
  }

  private createResponseHandler(
    resolve: (value: boolean) => void,
    onResponse: () => void
  ): (data: Buffer) => void {
    const handler = (_data: Buffer) => {
      this.cleanupQuery(handler);
      resolve(true);
      onResponse();
    };
    return handler;
  }

  private setupQueryTimeout(
    timeout: number,
    responseHandler: (data: Buffer) => void,
    resolve: (value: boolean) => void,
    onTimeout: () => void
  ): NodeJS.Timeout {
    return setTimeout(() => {
      this.cleanupQuery(responseHandler);
      resolve(false);
      onTimeout();
    }, timeout);
  }

  private cleanupQuery(responseHandler: (data: Buffer) => void): void {
    process.stdin.off('data', responseHandler);
  }

  private executeQuery(
    sequence: string,
    responseHandler: (data: Buffer) => void,
    _timeoutHandle: NodeJS.Timeout,
    _cleanup: () => void
  ): void {
    const isTest = process.env.NODE_ENV === 'test';

    try {
      process.stdout.write(sequence);
    } catch {
      // Ignore write errors
    }

    if (isTest) return;

    try {
      process.stdin.on('data', responseHandler);
    } catch (_error) {
      this.removeAllDataListeners();
      process.stdin.on('data', responseHandler);
    }
  }

  private removeAllDataListeners(): void {
    try {
      const listeners = (
        process.stdin as { listeners(event: string): unknown[] }
      ).listeners('data');
      if (Array.isArray(listeners)) {
        listeners.forEach((listener) => {
          process.stdin.off(
            'data',
            listener as (data: Buffer | string) => void
          );
        });
      }
    } catch {
      // Fallback: ignore if we can't remove listeners
    }
  }
}
