export interface Command {
  id: string;
  type: 'claude' | 'bash' | 'internal';
  content: string;
  description?: string;
}

export interface Step {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'confirmation' | 'input' | 'automated' | 'multi-command';
  commands: Command[];
  completed?: boolean;
  metadata?: Record<string, unknown>;
}
