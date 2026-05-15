export { default as GanttLayout } from './components/GanttLayout.vue'
export { default as GanttBar } from './components/GanttBar.vue'
export { default as GanttTable } from './components/GanttTable.vue'
export { default as GanttTimeline } from './components/GanttTimeline.vue'
export { default as GanttTooltip } from './components/GanttTooltip.vue'

export * from './types/gantt'
export * from './composables/useGanttStore'

// Core exports (Phase 1: headless engine, commands, constraints)
export {
  GanttEngine,
  CommandBus,
  MoveTaskCommand,
  ResizeTaskCommand,
  CreateDependencyCommand,
  RemoveDependencyCommand,
  ChangeDependencyTypeCommand,
  SetDependencyLagCommand,
  BatchCommand,
  ConstraintEngine,
  PluginSystem,
  ReadOnlyConstraint,
  DateOrderConstraint,
  DependencyConstraint,
  OverlapConstraint,
  ResourceCapacityConstraint,
  fromDTO,
  toDTO
} from './core'
export type {
  MoveTaskPayload,
  ResizeTaskPayload,
  CreateDependencyPayload,
  RemoveDependencyPayload,
  ChangeDependencyTypePayload,
  SetDependencyLagPayload
} from './core'
