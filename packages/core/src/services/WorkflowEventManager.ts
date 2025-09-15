import { EventEmitter } from 'events';
import type {
  WorkflowEvent,
  WorkflowEventHandler,
} from '../interfaces/IWorkflowEngine';
import type { Logger } from '../utils/logger';

export class WorkflowEventManager {
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(
    private logger: Logger,
    private enableEventLogging: boolean = false
  ) {}

  on(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void {
    this.eventEmitter.off(event, handler);
  }

  async emit(event: WorkflowEvent): Promise<void> {
    if (this.enableEventLogging) {
      this.logger.debug({
        msg: 'Workflow event',
        event,
      });
    }

    this.eventEmitter.emit(event.type, event);
  }

  removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }
}
