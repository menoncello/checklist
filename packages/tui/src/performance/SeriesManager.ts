export class SeriesManager {
  private series = new Map<string, unknown[]>();

  constructor() {}

  addSeries(name: string, data: unknown[]): void {
    this.series.set(name, data);
  }

  getSeries(name: string): unknown[] | undefined {
    return this.series.get(name);
  }

  getAllSeries(): Map<string, unknown[]> {
    return new Map(this.series);
  }

  clearSeries(name?: string): void {
    if (name !== undefined && name !== null && name !== '') {
      this.series.delete(name);
    } else {
      this.series.clear();
    }
  }
}
