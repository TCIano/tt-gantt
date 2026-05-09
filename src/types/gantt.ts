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

export interface GanttTask {
  id: string | number;
  name: string;
  startDate: string | Date | number;
  endDate: string | Date | number;
  expanded?: boolean;
  progress?: number;
  dependencies?: (string | number)[];
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
