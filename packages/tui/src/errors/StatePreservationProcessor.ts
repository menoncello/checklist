export class StatePreservationProcessor {
  private processors: Array<(state: unknown) => unknown> = [];

  addProcessor(processor: (state: unknown) => unknown): void {
    this.processors.push(processor);
  }

  process(state: unknown): unknown {
    let processedState = state;
    for (const processor of this.processors) {
      processedState = processor(processedState);
    }
    return processedState;
  }

  removeProcessor(processor: (state: unknown) => unknown): void {
    const index = this.processors.indexOf(processor);
    if (index !== -1) {
      this.processors.splice(index, 1);
    }
  }

  clearProcessors(): void {
    this.processors = [];
  }
}
