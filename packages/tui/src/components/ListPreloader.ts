export class ListPreloader {
  private accessPattern: number[] = [];
  private preloadDistance: number;
  private maxPatternSize = 1000;
  private keepPatternSize = 500;

  constructor(preloadDistance: number) {
    this.preloadDistance = preloadDistance;
  }

  recordAccess(index: number): void {
    this.accessPattern.push(index);

    if (this.accessPattern.length > this.maxPatternSize) {
      this.accessPattern = this.accessPattern.slice(-this.keepPatternSize);
    }
  }

  detectScrollDirection(): 'up' | 'down' | 'random' {
    if (this.accessPattern.length < 3) return 'random';

    const recent = this.accessPattern.slice(-10);
    let upCount = 0;
    let downCount = 0;

    for (let i = 1; i < recent.length; i++) {
      const diff = recent[i] - recent[i - 1];
      if (diff > 0) downCount++;
      else if (diff < 0) upCount++;
    }

    if (downCount > upCount * 2) return 'down';
    if (upCount > downCount * 2) return 'up';
    return 'random';
  }

  getPreloadIndices(
    currentIndex: number,
    totalItems: number,
    isInCache: (index: number) => boolean
  ): number[] {
    const direction = this.detectScrollDirection();

    switch (direction) {
      case 'down':
        return this.getDirectionalIndices(
          currentIndex,
          totalItems,
          isInCache,
          1
        );
      case 'up':
        return this.getDirectionalIndices(
          currentIndex,
          totalItems,
          isInCache,
          -1
        );
      default:
        return this.getBidirectionalIndices(
          currentIndex,
          totalItems,
          isInCache
        );
    }
  }

  private getDirectionalIndices(
    currentIndex: number,
    totalItems: number,
    isInCache: (index: number) => boolean,
    direction: number
  ): number[] {
    const indices: number[] = [];

    for (let i = 1; i <= this.preloadDistance; i++) {
      const index = currentIndex + i * direction;
      if (index >= 0 && index < totalItems && !isInCache(index)) {
        indices.push(index);
      }
    }

    return indices;
  }

  private getBidirectionalIndices(
    currentIndex: number,
    totalItems: number,
    isInCache: (index: number) => boolean
  ): number[] {
    const indices: number[] = [];
    const halfDistance = Math.floor(this.preloadDistance / 2);

    for (let i = 1; i <= halfDistance; i++) {
      const upIndex = currentIndex - i;
      const downIndex = currentIndex + i;

      if (upIndex >= 0 && !isInCache(upIndex)) {
        indices.push(upIndex);
      }
      if (downIndex < totalItems && !isInCache(downIndex)) {
        indices.push(downIndex);
      }
    }

    return indices;
  }

  getAccessPattern(): number[] {
    return [...this.accessPattern];
  }

  clearPattern(): void {
    this.accessPattern = [];
  }
}