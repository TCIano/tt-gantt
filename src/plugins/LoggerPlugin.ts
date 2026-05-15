import type { GanttPlugin, GanttEventBus } from '../composables/useGanttPlugin';

export const LoggerPlugin: GanttPlugin = {
  name: 'LoggerPlugin',
  install(bus: GanttEventBus) {
    bus.on('onTaskDragStart', (payload) => {
      console.log(`[LoggerPlugin] Task drag started: ${payload.task.name}`);
    });

    bus.on('onTaskDrop', (payload) => {
      console.log(
        `[LoggerPlugin] Task dropped: ${payload.task.name}, new start: ${payload.newStartDate}, new end: ${payload.newEndDate}`
      );
    });

    bus.on('onTaskClick', (payload) => {
      console.log(`[LoggerPlugin] Task clicked: ${payload.task.name}`);
    });

    bus.on('onTaskToggle', (payload) => {
      console.log(
        `[LoggerPlugin] Task toggled: ${payload.task.name}, expanded: ${payload.expanded}`
      );
    });
  }
};
