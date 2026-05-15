import type { CSSProperties } from 'vue';

export interface GanttColumn {
  field: string;
  label: string;
  width?: number;
  minWidth?: number;
  tree?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: (value: string | number | Date | boolean, task: FlatGanttTask | GanttTask) => string;
}

export type GanttScale = 'day' | 'week' | 'month';

export type GanttPreviewMode = 'drag' | 'resize-left' | 'resize-right';
export type GanttDependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type GanttSnapMode = 'day' | 'week' | 'month';
export type GanttLayoutMode = 'task' | 'resource';

export interface GanttStatusStyle {
  barColor?: string;
  progressColor?: string;
  textColor?: string;
}

export interface GanttTask {
  id: string | number;
  name: string;
  startDate: string | Date | number;
  endDate: string | Date | number;
  resourceId?: string | number;
  baselineStartDate?: string | Date | number;
  baselineEndDate?: string | Date | number;
  expanded?: boolean;
  progress?: number;
  status?: string;
  type?: 'task' | 'group' | 'milestone';
  readOnly?: boolean;
  disabled?: boolean;
  isCritical?: boolean;
  selectable?: boolean;
  dependencies?: (string | number)[]
  dependencyTypes?: Partial<Record<string | number, GanttDependencyType>>
  dependencyLags?: Partial<Record<string | number, number>>
  children?: GanttTask[]
  [key: string]: any;
}

export interface FlatGanttTask extends Omit<GanttTask, 'children'> {
  _level: number;
  _hasChildren: boolean;
  _parent?: string | number;
  _visible: boolean;
  _resourceIndex?: number;
  _rowType?: 'task' | 'resource';
  _rowId?: string | number;
}

export interface FlatResourceRow {
  id: string;
  name: string;
  type: string;
  _level: number;
  _hasChildren: boolean;
  _parent?: string;
  _visible: boolean;
  _expanded: boolean;
  _index: number;
}

export interface GanttTaskPreview {
  taskId: string | number;
  mode: GanttPreviewMode;
  draftLeftPx: number;
  draftWidthPx: number;
  draftStartDate: string;
  draftEndDate: string;
}

export interface GanttDependencyLine {
  id: string;
  sourceId: string | number;
  targetId: string | number;
  type: GanttDependencyType;
  path: string;
  arrow: string;
  highlighted?: boolean;
}

export type GanttRowClassFn = (task: FlatGanttTask) => string | string[] | Record<string, boolean>;
export type GanttRowStyleFn = (task: FlatGanttTask) => CSSProperties;
export type GanttBarClassFn = (task: FlatGanttTask) => string | string[] | Record<string, boolean>;
export type GanttBarStyleFn = (task: FlatGanttTask) => CSSProperties;

// Re-export core types for backward compatibility
export type {
  ResourceNode,
  ResourceType,
  ResourceCapacity,
  ResourceShift,
  ResourceCalendar,
  UnavailablePeriod,
  MaintenanceWindow,
  Command,
  PatchRecord,
  Constraint,
  ValidationResult,
  ValidationItem,
  Severity,
  Scenario,
  EngineState,
  GanttTaskSnapshot,
  DependencyType as CoreDependencyType
} from '../core/types';
