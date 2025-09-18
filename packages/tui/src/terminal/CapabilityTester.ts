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
      {
        name: 'color',
        test: () => this.testColorSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Basic color support (16 colors)',
      },
      {
        name: 'color256',
        test: () => this.testColor256Support(),
        fallback: false,
        timeout: 1000,
        description: '256 color support',
      },
      {
        name: 'trueColor',
        test: () => this.testTrueColorSupport(),
        fallback: false,
        timeout: 1000,
        description: '24-bit true color support',
      },
    ];
  }

  private createUITests(): CapabilityTest[] {
    return [
      {
        name: 'unicode',
        test: () => this.testUnicodeSupport(),
        fallback: true,
        timeout: 500,
        description: 'Unicode character support',
      },
      {
        name: 'mouse',
        test: () => this.testMouseSupport(),
        fallback: false,
        timeout: 2000,
        description: 'Mouse event support',
      },
      {
        name: 'cursorShape',
        test: () => this.testCursorShapeSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Cursor shape modification support',
      },
    ];
  }

  private createTerminalFeatureTests(): CapabilityTest[] {
    return [
      {
        name: 'altScreen',
        test: () => this.testAlternateScreenSupport(),
        fallback: false,
        timeout: 1500,
        description: 'Alternate screen buffer support',
      },
      {
        name: 'windowTitle',
        test: () => this.testWindowTitleSupport(),
        fallback: false,
        timeout: 1000,
        description: 'Window title modification support',
      },
      {
        name: 'clipboard',
        test: () => this.testClipboardSupport(),
        fallback: false,
        timeout: 1500,
        description: 'Clipboard access support',
      },
    ];
  }

  public async runTestWithTimeout(test: CapabilityTest): Promise<boolean> {
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout')), test.timeout ?? 1000);
    });

    return Promise.race([test.test(), timeoutPromise]);
  }

  private async testColorSupport(): Promise<boolean> {
    const colorSupport = this.colorSupport.detectBasicColor();
    if (colorSupport !== null) {
      return colorSupport;
    }

    return this.terminalInfo.supportsColor();
  }

  private async testColor256Support(): Promise<boolean> {
    const colorSupport = this.colorSupport.detect256Color();
    if (colorSupport !== null) {
      return colorSupport;
    }

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
    if (this.isUnicodeEnvironment()) {
      return true;
    }

    return this.testUnicodeOutput();
  }

  private isUnicodeEnvironment(): boolean {
    const lang = Bun.env.LANG ?? '';
    return lang.includes('UTF-8') || lang.includes('utf8');
  }

  private async testUnicodeOutput(): Promise<boolean> {
    try {
      const testString = '▲△▼▽◆◇○●★☆';
      const encoded = Buffer.from(testString, 'utf8');
      const decoded = encoded.toString('utf8');
      return decoded === testString;
    } catch {
      return false;
    }
  }

  private async testMouseSupport(): Promise<boolean> {
    const term = this.terminalInfo.getTerminalType();

    if (this.isMouseCapableTerminal(term)) {
      return this.queryTerminalCapability('\x1b[?1000h\x1b[?1000l', 500);
    }

    return false;
  }

  private isMouseCapableTerminal(term: string): boolean {
    const mouseCapableTerminals = [
      'xterm',
      'screen',
      'tmux',
      'alacritty',
      'kitty',
    ];

    return mouseCapableTerminals.some((t) => term.includes(t));
  }

  private async testAlternateScreenSupport(): Promise<boolean> {
    const term = this.terminalInfo.getTerminalType();

    if (this.isAlternateScreenCapable(term)) {
      return true;
    }

    return this.queryTerminalCapability('\x1b[?1049h\x1b[?1049l', 500);
  }

  private isAlternateScreenCapable(term: string): boolean {
    return (
      term.includes('xterm') || term.includes('screen') || term.includes('tmux')
    );
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
    if (this.isSSHSession()) {
      return false;
    }

    const term = this.terminalInfo.getTerminalType();
    return this.isWindowTitleCapable(term);
  }

  private isSSHSession(): boolean {
    return (
      (Bun.env.SSH_TTY !== undefined && Bun.env.SSH_TTY.length > 0) ||
      (Bun.env.SSH_CONNECTION !== undefined &&
        Bun.env.SSH_CONNECTION.length > 0)
    );
  }

  private isWindowTitleCapable(term: string): boolean {
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

      const responseHandler = this.createResponseHandler(resolve, () => {
        responded = true;
      });

      const timeoutHandle = this.setupQueryTimeout(
        timeout,
        responseHandler,
        resolve,
        () => {
          responded = true;
        }
      );

      if (!responded) {
        this.executeQuery(sequence, responseHandler, timeoutHandle);
      }
    });
  }

  private createResponseHandler(
    resolve: (value: boolean) => void,
    onResponse: () => void
  ): (data: Buffer) => void {
    const handler = (_data: Buffer) => {
      this.cleanupQuery(handler, () => {
        resolve(true);
        onResponse();
      });
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
      this.cleanupQuery(responseHandler, () => {
        resolve(false);
        onTimeout();
      });
    }, timeout);
  }

  private executeQuery(
    sequence: string,
    responseHandler: (data: Buffer) => void,
    timeoutHandle: NodeJS.Timeout
  ): void {
    process.stdin.on('data', responseHandler);
    process.stdout.write(sequence);

    Promise.resolve().then(() => {
      clearTimeout(timeoutHandle);
    });
  }

  private cleanupQuery(
    handler: (data: Buffer) => void,
    callback: () => void
  ): void {
    process.stdin.off('data', handler);
    callback();
  }
}
