import { inject, provide } from 'vue';
import type { GanttTask, FlatGanttTask, GanttTaskPreview } from '../types/gantt';

export interface GanttEventPayloads {
  onTaskDragStart: { task: GanttTask | FlatGanttTask; event: PointerEvent };
  onTaskDrop: { task: GanttTask | FlatGanttTask; newStartDate: string | Date | number; newEndDate: string | Date | number };
  onTaskClick: { task: GanttTask | FlatGanttTask; event: MouseEvent };
  onTaskToggle: { task: GanttTask | FlatGanttTask; expanded: boolean };
  onTaskPreviewChange: GanttTaskPreview;
  onTaskPreviewEnd: { taskId: string | number };
}

export type GanttEventName = keyof GanttEventPayloads;
export type GanttEventHandler<T extends GanttEventName> = (payload: GanttEventPayloads[T]) => void;

export class GanttEventBus {
  private listeners: { [K in GanttEventName]?: GanttEventHandler<K>[] } = {};

  on<K extends GanttEventName>(event: K, handler: GanttEventHandler<K>) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  off<K extends GanttEventName>(event: K, handler: GanttEventHandler<K>) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event]!.filter(h => h !== handler) as any;
  }

  emit<K extends GanttEventName>(event: K, payload: GanttEventPayloads[K]) {
    if (!this.listeners[event]) return;
    this.listeners[event]!.forEach(handler => handler(payload));
  }
}

const GANTT_EVENT_BUS_KEY = Symbol('GANTT_EVENT_BUS_KEY');

export function provideGanttEventBus(bus: GanttEventBus) {
  provide(GANTT_EVENT_BUS_KEY, bus);
  return bus;
}

export function useGanttEventBus(): GanttEventBus {
  const bus = inject<GanttEventBus | null>(GANTT_EVENT_BUS_KEY, null);
  if (!bus) {
    throw new Error('useGanttEventBus must be used within a component that provides it.');
  }
  return bus;
}

// Plugin interface
export interface GanttPlugin {
  name: string;
  install: (bus: GanttEventBus) => void;
}
