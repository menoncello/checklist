/**
 * ConditionDebugScreen - Display condition evaluation debug information
 * Story 3.6: Conditional Workflow Branching (Task 6)
 */

import type { ConditionDebugReport } from '@checklist/core/workflow';
import { BaseScreen } from './BaseScreen';

export interface ConditionDebugScreenProps extends Record<string, unknown> {
  reports: ConditionDebugReport[];
  onRefresh?: () => void;
  onExport?: () => Promise<void>;
  onClose?: () => void;
}

export class ConditionDebugScreen extends BaseScreen {
  public readonly id = 'condition-debug';
  public readonly name = 'Condition Debug Screen';

  private scrollOffset: number = 0;
  private selectedIndex: number = 0;

  constructor(props: ConditionDebugScreenProps) {
    super(props);
  }

  protected initialize(): void {
    this.setState({
      scrollOffset: 0,
      selectedIndex: 0,
    });
  }

  public render(): string {
    const props = this.getProps() as ConditionDebugScreenProps;
    const reports = props.reports ?? [];
    const lines: string[] = [];

    this.renderHeader(lines);
    this.renderSummary(lines, reports);
    this.renderTable(lines, reports);
    this.renderFooter(lines);

    this.markClean();
    return lines.join('\n');
  }

  private renderHeader(lines: string[]): void {
    lines.push(
      this.applyStyle(
        this.centerText('─── Condition Debug Screen ───', this.width),
        { color: 'cyan', bold: true }
      )
    );
    lines.push('');
  }

  private renderSummary(
    lines: string[],
    reports: ConditionDebugReport[]
  ): void {
    const visibleCount = reports.filter((r) => r.result).length;
    const hiddenCount = reports.length - visibleCount;
    lines.push(
      `Total Steps: ${reports.length}  |  ` +
        this.applyStyle(`Visible: ${visibleCount}`, { color: 'green' }) +
        '  |  ' +
        this.applyStyle(`Hidden: ${hiddenCount}`, { color: 'red' })
    );
    lines.push('');
  }

  private renderTable(lines: string[], reports: ConditionDebugReport[]): void {
    lines.push(
      this.applyStyle(this.formatTableHeader(), { bold: true, color: 'white' })
    );
    lines.push('─'.repeat(this.width));

    const viewportHeight = this.height - 10;
    const visibleReports = this.getVisibleReports(reports, viewportHeight);

    this.renderTableRows(lines, visibleReports);
    this.fillEmptySpace(lines);
    this.renderScrollIndicator(lines, reports, viewportHeight);
  }

  private renderTableRows(
    lines: string[],
    visibleReports: ConditionDebugReport[]
  ): void {
    if (visibleReports.length === 0) {
      lines.push(this.centerText('No condition reports available', this.width));
    } else {
      for (const report of visibleReports) {
        lines.push(this.formatTableRow(report));
      }
    }
  }

  private fillEmptySpace(lines: string[]): void {
    while (lines.length < this.height - 4) {
      lines.push('');
    }
  }

  private renderScrollIndicator(
    lines: string[],
    reports: ConditionDebugReport[],
    viewportHeight: number
  ): void {
    if (reports.length > viewportHeight) {
      const end = Math.min(this.scrollOffset + viewportHeight, reports.length);
      const scrollInfo = `(${this.scrollOffset + 1}-${end} of ${reports.length})`;
      lines.push(this.centerText(scrollInfo, this.width));
    } else {
      lines.push('');
    }
  }

  private renderFooter(lines: string[]): void {
    lines.push('─'.repeat(this.width));
    lines.push(
      this.centerText(
        '↑↓: Scroll  |  E: Export  |  R: Refresh  |  ESC: Close',
        this.width
      )
    );
  }

  public handleInput(input: string): void {
    const props = this.getProps() as ConditionDebugScreenProps;
    const key = input.toLowerCase();

    if (this.isScrollKey(key)) {
      this.handleScroll(key, props);
    } else if (this.isActionKey(key)) {
      this.handleAction(key, props);
    } else {
      super.handleInput(input);
    }
  }

  private isScrollKey(key: string): boolean {
    return (
      key === '\u001b[a' || key === 'k' || key === '\u001b[b' || key === 'j'
    );
  }

  private isActionKey(key: string): boolean {
    return key === 'r' || key === 'e' || key === '\u001b' || key === 'q';
  }

  private handleScroll(key: string, props: ConditionDebugScreenProps): void {
    const reports = props.reports ?? [];
    const viewportHeight = this.height - 10;
    const maxScroll = Math.max(0, reports.length - viewportHeight);

    if (key === '\u001b[a' || key === 'k') {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
    } else if (key === '\u001b[b' || key === 'j') {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 1);
    }

    this.markDirty();
  }

  private handleAction(key: string, props: ConditionDebugScreenProps): void {
    if (key === 'r' && props.onRefresh) {
      props.onRefresh();
      this.scrollOffset = 0;
      this.markDirty();
    } else if (key === 'e' && props.onExport) {
      void props.onExport();
    } else if (key === '\u001b' || key === 'q') {
      if (props.onClose) {
        props.onClose();
      }
      this.emit('close');
    }
  }

  private getVisibleReports(
    reports: ConditionDebugReport[],
    viewportHeight: number
  ): ConditionDebugReport[] {
    return reports.slice(this.scrollOffset, this.scrollOffset + viewportHeight);
  }

  private formatTableHeader(): string {
    const stepIdWidth = 15;
    const conditionWidth = 25;
    const resultWidth = 10;
    const variablesWidth = 20;

    const stepId = this.padEnd('Step ID', stepIdWidth);
    const condition = this.padEnd('Condition', conditionWidth);
    const result = this.padEnd('Result', resultWidth);
    const variables = this.padEnd('Variables', variablesWidth);

    return `${stepId} ${condition} ${result} ${variables}`;
  }

  private formatTableRow(report: ConditionDebugReport): string {
    const stepIdWidth = 15;
    const conditionWidth = 25;
    const resultWidth = 10;
    const variablesWidth = 20;

    const stepId = this.truncateText(report.stepId, stepIdWidth);
    const condition = this.truncateText(
      report.condition ?? 'None',
      conditionWidth
    );
    const resultText = report.result ? '✓ Visible' : '✗ Hidden';
    const variableCount = Object.keys(report.variablesUsed).length;
    const variables = `${variableCount} var(s)`;

    const stepIdPadded = this.padEnd(stepId, stepIdWidth);
    const conditionPadded = this.padEnd(condition, conditionWidth);
    const resultPadded = this.padEnd(resultText, resultWidth);
    const variablesPadded = this.padEnd(variables, variablesWidth);

    // Color coding: Green (visible), Red (hidden), Gray (no condition)
    const color = this.getColorForReport(report);
    const row = `${stepIdPadded} ${conditionPadded} ${resultPadded} ${variablesPadded}`;

    return this.applyStyle(row, { color });
  }

  private getColorForReport(
    report: ConditionDebugReport
  ): 'green' | 'red' | 'white' {
    if (report.condition === undefined) {
      return 'white'; // No condition - default color (gray would be 'dim')
    }
    return report.result ? 'green' : 'red';
  }

  private padEnd(text: string, width: number): string {
    if (text.length >= width) return text;
    return text + ' '.repeat(width - text.length);
  }
}
