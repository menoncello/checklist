export const tui = {
  version: '0.1.0',
  name: '@checklist/tui',
};

export function render(content: string): void {
  console.log(`[TUI]: ${content}`);
}
