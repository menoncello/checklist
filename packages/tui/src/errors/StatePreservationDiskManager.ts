import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class StatePreservationDiskManager {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? join(process.cwd(), '.state-preservation');
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  async save(id: string, data: unknown): Promise<void> {
    const filePath = join(this.basePath, `${id}.json`);
    await Bun.write(filePath, JSON.stringify(data, null, 2));
  }

  async load(id: string): Promise<unknown | null> {
    const filePath = join(this.basePath, `${id}.json`);
    if (!existsSync(filePath)) return null;
    const file = Bun.file(filePath);
    return file.json();
  }

  async delete(id: string): Promise<void> {
    const filePath = join(this.basePath, `${id}.json`);
    if (existsSync(filePath)) {
      await Bun.write(filePath, '');
    }
  }
}
