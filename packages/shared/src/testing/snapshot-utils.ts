import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

export class SnapshotUtils {
  private snapshotDir: string;

  constructor(snapshotDir: string = 'tests/snapshots') {
    this.snapshotDir = snapshotDir;
  }

  async saveSnapshot(name: string, content: string): Promise<void> {
    const filePath = join(this.snapshotDir, `${name}.snap`);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(filePath, content, 'utf-8');
  }

  async loadSnapshot(name: string): Promise<string | null> {
    const filePath = join(this.snapshotDir, `${name}.snap`);

    if (!existsSync(filePath)) {
      return null;
    }

    return await readFile(filePath, 'utf-8');
  }

  async compareSnapshot(name: string, content: string): Promise<boolean> {
    const existing = await this.loadSnapshot(name);
    if (existing === null) {
      await this.saveSnapshot(name, content);
      return true;
    }

    return existing === content;
  }

  async updateSnapshot(name: string, content: string): Promise<void> {
    await this.saveSnapshot(name, content);
  }

  normalizeTerminalOutput(output: string): string {
    return output
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+$/gm, '');
  }

  stripAnsiCodes(str: string): string {
    return str.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ''
    );
  }

  stripTimestamps(str: string): string {
    return str
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g, '<TIMESTAMP>')
      .replace(/\d{1,2}:\d{2}:\d{2} (AM|PM)/gi, '<TIME>')
      .replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '<DATE>');
  }

  stripDynamicValues(str: string): string {
    return str
      .replace(
        /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
        '<UUID>'
      )
      .replace(/\b\d+ms\b/g, '<DURATION>')
      .replace(/\b\d+\.\d+s\b/g, '<DURATION>')
      .replace(/pid:\s*\d+/g, 'pid: <PID>')
      .replace(/port:\s*\d{4,5}/g, 'port: <PORT>');
  }

  prepareForSnapshot(output: string): string {
    let prepared = this.normalizeTerminalOutput(output);
    prepared = this.stripAnsiCodes(prepared);
    prepared = this.stripTimestamps(prepared);
    prepared = this.stripDynamicValues(prepared);
    return prepared;
  }

  async assertSnapshot(name: string, actual: string): Promise<void> {
    const prepared = this.prepareForSnapshot(actual);
    const isMatch = await this.compareSnapshot(name, prepared);

    if (!isMatch) {
      const existing = await this.loadSnapshot(name);
      const diff = this.generateDiff(existing ?? '', prepared);
      throw new Error(`Snapshot mismatch for "${name}":\n${diff}`);
    }
  }

  private generateDiff(expected: string, actual: string): string {
    const expectedLines = expected.split('\n');
    const actualLines = actual.split('\n');
    const maxLines = Math.max(expectedLines.length, actualLines.length);
    const diff: string[] = [];

    for (let i = 0; i < maxLines; i++) {
      const expectedLine = expectedLines[i] ?? '';
      const actualLine = actualLines[i] ?? '';

      if (expectedLine === actualLine) {
        diff.push(`  ${expectedLine}`);
      } else {
        if (expectedLine) {
          diff.push(`- ${expectedLine}`);
        }
        if (actualLine) {
          diff.push(`+ ${actualLine}`);
        }
      }
    }

    return diff.join('\n');
  }
}

export async function toMatchSnapshot(
  actual: string,
  name: string,
  options?: { update?: boolean }
): Promise<{ pass: boolean; message?: string }> {
  const utils = new SnapshotUtils();
  const prepared = utils.prepareForSnapshot(actual);

  if (options?.update === true || process.env.UPDATE_SNAPSHOTS === 'true') {
    await utils.updateSnapshot(name, prepared);
    return { pass: true };
  }

  try {
    await utils.assertSnapshot(name, actual);
    return { pass: true };
  } catch (error) {
    return {
      pass: false,
      message: (error as Error).message,
    };
  }
}
