import type { TerminalCapabilities } from '../framework/UIFramework';
import { CapabilityDetector } from './CapabilityDetector';
import { TerminalTestHarness } from './TerminalTestHarness';
import { CompatibilityRecommendations } from './helpers/CompatibilityRecommendations';
import {
  TerminalDataCollector,
  type TerminalCompatibilityEntry,
} from './helpers/TerminalDataCollector';
export interface CompatibilityMatrix {
  version: string;
  generatedAt: string;
  terminals: TerminalCompatibilityEntry[];
  recommendations: Map<string, string>;
  knownIssues: Map<string, string[]>;
  workarounds: Map<string, string>;
}
export class CompatibilityMatrixGenerator {
  private detector: CapabilityDetector;
  private testHarness: TerminalTestHarness;
  private dataCollector: TerminalDataCollector;
  private recommendations: CompatibilityRecommendations;
  private matrixVersion = '1.0.0';
  private customTerminals: TerminalCompatibilityEntry[] = [];
  constructor() {
    this.detector = new CapabilityDetector();
    this.testHarness = new TerminalTestHarness();
    this.dataCollector = new TerminalDataCollector(
      this.detector,
      this.testHarness
    );
    this.recommendations = new CompatibilityRecommendations();
  }
  public async generateMatrix(): Promise<CompatibilityMatrix> {
    const baseTerminals = await this.dataCollector.collectTerminalData();
    // Include custom terminals added via addTerminal()
    const terminals = [...baseTerminals, ...this.customTerminals];
    const recommendations =
      this.recommendations.generateRecommendations(terminals);
    const knownIssues = this.recommendations.collectKnownIssues();
    const workarounds = this.recommendations.collectWorkarounds();
    return {
      version: this.matrixVersion,
      generatedAt: new Date().toISOString(),
      terminals,
      recommendations,
      knownIssues,
      workarounds,
    };
  }
  public setVersion(version: string): void {
    this.matrixVersion = version;
  }
  public async generateMarkdown(): Promise<string> {
    const matrix = await this.generateMatrix();
    let markdown = this.generateMarkdownHeader(matrix);
    markdown += this.generateOverviewTable(matrix.terminals);
    markdown += this.generateFeatureDetails(matrix.terminals);
    return markdown;
  }
  private generateOverviewTable(
    terminals: TerminalCompatibilityEntry[]
  ): string {
    let markdown = '## Supported Terminals\n\n';
    markdown += '| Terminal | Platform | Color Support | Unicode | Mouse |\n';
    markdown += '|----------|----------|---------------|---------|-------|\n';
    terminals.forEach((terminal) => {
      const colorSupport = this.getColorSupportLevel(terminal.capabilities);
      const unicodeSupport = terminal.capabilities.unicode === true ? '✓' : '✗';
      const mouseSupport = terminal.capabilities.mouse === true ? '✓' : '✗';
      markdown += `| ${terminal.name} | ${terminal.platform} | ${colorSupport} | ${unicodeSupport} | ${mouseSupport} |\n`;
    });
    return markdown;
  }
  private generateFeatureDetails(
    terminals: TerminalCompatibilityEntry[]
  ): string {
    let markdown = '\n## Feature Details\n\n';
    terminals.forEach((terminal) => {
      markdown += `### ${terminal.name}\n\n`;
      markdown += `- **Platform**: ${terminal.platform}\n`;
      markdown += `- **Color Support**: ${this.getDetailedColorSupport(terminal.capabilities)}\n`;
      markdown += `- **Unicode Support**: ${terminal.capabilities.unicode === true ? 'Full' : 'Limited'}\n`;
      markdown += `- **Mouse Support**: ${terminal.capabilities.mouse === true ? 'Yes' : 'No'}\n`;
      markdown += `- **Last Tested**: ${new Date(terminal.lastUpdated).toLocaleDateString()}\n\n`;
    });
    return markdown;
  }
  private getDetailedColorSupport(capabilities: TerminalCapabilities): string {
    return capabilities.trueColor === true
      ? 'True Color'
      : capabilities.color256 === true
        ? '256 Color'
        : 'Basic';
  }
  public exportAsMarkdown(matrix: CompatibilityMatrix): string {
    let markdown = this.generateMarkdownHeader(matrix);
    markdown += this.generateTerminalTable(matrix.terminals);
    markdown += this.generateRecommendationsSection();
    markdown += this.generateKnownIssuesSection(matrix.knownIssues);
    markdown += this.generateWorkaroundsSection(matrix.workarounds);
    return markdown;
  }
  private generateMarkdownHeader(matrix: CompatibilityMatrix): string {
    let markdown = '# Terminal Compatibility Matrix\n\n';
    markdown += `*Generated on: ${new Date(matrix.generatedAt).toLocaleDateString()}*\n\n`;
    markdown += `Version: ${matrix.version}\n\n`;
    return markdown;
  }
  private generateTerminalTable(
    terminals: TerminalCompatibilityEntry[]
  ): string {
    let markdown = '## Supported Terminals\n\n';
    markdown +=
      '| Terminal | Version | Platform | Colors | Unicode | Mouse | Notes |\n';
    markdown +=
      '|----------|---------|----------|--------|---------|-------|-------|\n';
    terminals.forEach((terminal) => {
      const colorSupport = this.getColorSupportLevel(terminal.capabilities);
      const unicodeSupport = terminal.capabilities.unicode === true ? '✓' : '✗';
      const mouseSupport = terminal.capabilities.mouse === true ? '✓' : '✗';
      markdown += `| ${terminal.name} | Latest | ${terminal.platform} | ${colorSupport} | ${unicodeSupport} | ${mouseSupport} | - |\n`;
    });
    return markdown;
  }
  private getColorSupportLevel(capabilities: TerminalCapabilities): string {
    return capabilities.trueColor === true
      ? 'True Color'
      : capabilities.color256 === true
        ? '256 Color'
        : capabilities.color === true
          ? 'Basic'
          : 'None';
  }
  private generateRecommendationsSection(): string {
    return '\n## Recommendations\n\nUse terminals with full color and Unicode support for the best experience.\n\n';
  }
  private generateKnownIssuesSection(
    knownIssues: Map<string, string[]>
  ): string {
    if (knownIssues.size === 0) return '';
    let markdown = '## Known Issues\n\n';
    for (const [terminal, issues] of knownIssues) {
      markdown += `### ${terminal}\n\n`;
      issues.forEach((issue) => {
        markdown += `- ${issue}\n`;
      });
      markdown += '\n';
    }
    return markdown;
  }
  private generateWorkaroundsSection(workarounds: Map<string, string>): string {
    if (workarounds.size === 0) return '';
    let markdown = '## Workarounds\n\n';
    for (const [issue, workaround] of workarounds) {
      markdown += `### ${issue}\n\n`;
      markdown += `${workaround}\n\n`;
    }
    return markdown;
  }
  public async generateJSON(): Promise<string> {
    const matrix = await this.generateMatrix();
    return JSON.stringify(matrix, null, 2);
  }
  public exportAsJSON(matrix: CompatibilityMatrix): string {
    return JSON.stringify(matrix, null, 2);
  }
  public validateCompleteness(): {
    complete: boolean;
    missing: string[];
    issues: string[];
  } {
    const missing: string[] = [];
    const issues: string[] = [];
    if (this.testHarness == null) issues.push('Test harness not initialized');
    if (this.detector == null)
      issues.push('Capability detector not initialized');
    return {
      complete: missing.length === 0 && issues.length === 0,
      missing,
      issues,
    };
  }
  public addTerminal(terminal: TerminalCompatibilityEntry): void {
    this.customTerminals.push(terminal);
  }
  public updateCapabilities(
    terminalName: string,
    capabilities: TerminalCapabilities
  ): void {
    const terminal = this.customTerminals.find((t) => t.name === terminalName);
    if (terminal != null) {
      terminal.capabilities = capabilities;
      terminal.lastUpdated = new Date().toISOString();
    }
  }
  public validateTerminal(terminal: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    if (terminal.name == null || terminal.name === '')
      errors.push('Terminal name is required');
    if (terminal.platform == null || terminal.platform === '')
      errors.push('Platform is required');
    if (terminal.capabilities == null) errors.push('Capabilities are required');
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  public validateMatrix(_matrix: CompatibilityMatrix): string[] {
    const errors: string[] = [];
    if (!_matrix.version) errors.push('Missing version');
    if (_matrix.terminals == null || _matrix.terminals.length === 0) {
      errors.push('Missing required terminal data');
    }
    // Check for required terminals
    const terminalNames = _matrix.terminals.map((t) => t.name);
    const requiredTerminals = [
      'macOS Terminal.app',
      'iTerm2',
      'Alacritty',
      'Windows Terminal',
    ];
    for (const required of requiredTerminals) {
      if (!terminalNames.includes(required)) {
        errors.push(`Missing required terminal: ${required}`);
      }
    }
    // Check for outdated data (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    for (const terminal of _matrix.terminals) {
      const lastUpdated = new Date(terminal.lastUpdated);
      if (lastUpdated < thirtyDaysAgo) {
        errors.push(`Terminal data outdated: ${terminal.name}`);
      }
    }
    return errors;
  }
  public async generateComparison(terminalNames: string[]): Promise<{
    terminals: string[];
    differences: Record<string, Record<string, boolean>>;
    similarities: Record<string, Record<string, boolean>>;
  }> {
    const matrix = await this.generateMatrix();
    const selectedTerminals = this.filterTerminalsByNames(
      matrix.terminals,
      terminalNames
    );
    const differences = this.generateCapabilityDifferences(selectedTerminals);
    return {
      terminals: terminalNames,
      differences,
      similarities: differences,
    };
  }
  private filterTerminalsByNames(
    terminals: TerminalCompatibilityEntry[],
    terminalNames: string[]
  ): TerminalCompatibilityEntry[] {
    return terminals.filter((t) => terminalNames.includes(t.name));
  }
  private generateCapabilityDifferences(
    selectedTerminals: TerminalCompatibilityEntry[]
  ): Record<string, Record<string, boolean>> {
    const differences: Record<string, Record<string, boolean>> = {};
    differences.color = this.compareColorSupport(selectedTerminals);
    differences.unicode = this.compareUnicodeSupport(selectedTerminals);
    differences.mouse = this.compareMouseSupport(selectedTerminals);
    return differences;
  }
  private compareColorSupport(
    terminals: TerminalCompatibilityEntry[]
  ): Record<string, boolean> {
    const colorSupport: Record<string, boolean> = {};
    terminals.forEach((terminal) => {
      colorSupport[terminal.name] =
        terminal.capabilities.trueColor === true ||
        terminal.capabilities.color256 === true ||
        terminal.capabilities.color === true;
    });
    return colorSupport;
  }
  private compareUnicodeSupport(
    terminals: TerminalCompatibilityEntry[]
  ): Record<string, boolean> {
    const unicodeSupport: Record<string, boolean> = {};
    terminals.forEach((terminal) => {
      unicodeSupport[terminal.name] = terminal.capabilities.unicode;
    });
    return unicodeSupport;
  }
  private compareMouseSupport(
    terminals: TerminalCompatibilityEntry[]
  ): Record<string, boolean> {
    const mouseSupport: Record<string, boolean> = {};
    terminals.forEach((terminal) => {
      mouseSupport[terminal.name] = terminal.capabilities.mouse;
    });
    return mouseSupport;
  }
}
