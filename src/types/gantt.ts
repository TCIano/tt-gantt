export interface GanttColumn {
  field: string;
  label: string;
  width?: number;
  minWidth?: number;
  tree?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, task: FlatGanttTask | GanttTask) => string;
}

export type GanttScale = 'day' | 'week' | 'month';

export type GanttPreviewMode = 'drag' | 'resize-left' | 'resize-right';
export type GanttDependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type GanttSnapMode = 'day' | 'week' | 'month';

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
  dependencies?: (string | number)[];
  dependencyTypes?: Partial<Record<string | number, GanttDependencyType>>;
  children?: GanttTask[];
  // 允许任何其他自定义属性
  [key: string]: any;
}

export interface FlatGanttTask extends Omit<GanttTask, 'children'> {
  _level: number;
  _hasChildren: boolean;
  _parent?: string | number;
  _visible: boolean;
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
