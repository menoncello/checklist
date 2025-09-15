export class PathFinder {
  private distances = new Map<string, number>();
  private previous = new Map<string, string | null>();
  private unvisited = new Set<string>();

  constructor(
    private versionGraph: Map<string, Set<string>>,
    private allVersions: string[]
  ) {}

  findPath(start: string, end: string): string[] | null {
    this.initializeGraph(start, end);

    while (this.unvisited.size > 0) {
      const current = this.getNextNode();

      if (
        current === null ||
        current === undefined ||
        this.distances.get(current) === Infinity
      ) {
        break;
      }

      if (current === end) {
        return this.reconstructPath(start, end);
      }

      this.processNode(current);
    }

    return null;
  }

  private initializeGraph(start: string, end: string): void {
    // Initialize all known versions
    for (const version of this.allVersions) {
      this.distances.set(version, version === start ? 0 : Infinity);
      this.previous.set(version, null);
      this.unvisited.add(version);
    }

    // Ensure end version is included
    if (!this.unvisited.has(end)) {
      this.unvisited.add(end);
      this.distances.set(end, Infinity);
      this.previous.set(end, null);
    }
  }

  private getNextNode(): string | null {
    let current: string | null = null;
    let minDistance = Infinity;

    for (const version of this.unvisited) {
      const distance = this.distances.get(version) ?? Infinity;
      if (distance < minDistance) {
        minDistance = distance;
        current = version;
      }
    }

    return current;
  }

  private processNode(current: string): void {
    this.unvisited.delete(current);
    const currentDistance = this.distances.get(current) ?? 0;
    const neighbors = this.versionGraph.get(current) ?? new Set();

    for (const neighbor of neighbors) {
      if (this.unvisited.has(neighbor)) {
        this.updateNeighborDistance(current, neighbor, currentDistance);
      }
    }
  }

  private updateNeighborDistance(
    current: string,
    neighbor: string,
    currentDistance: number
  ): void {
    const altDistance = currentDistance + 1;
    const neighborDistance = this.distances.get(neighbor) ?? Infinity;

    if (altDistance < neighborDistance) {
      this.distances.set(neighbor, altDistance);
      this.previous.set(neighbor, current);
    }
  }

  private reconstructPath(start: string, end: string): string[] | null {
    const path: string[] = [];
    let node: string | null = end;

    while (node !== null) {
      path.unshift(node);
      node = this.previous.get(node) ?? null;
    }

    return path[0] === start ? path : null;
  }
}
