import { EventBus as EventBusCore } from './EventBusCore';

export {
  type BusMessage,
  type MessageFilter,
  type Subscriber,
  type EventBusDebugInfo,
  type EventBusValidationResult,
  EventBusChannel,
} from './EventBusCore';

export class EventBus extends EventBusCore {
  constructor() {
    super();
  }
}
