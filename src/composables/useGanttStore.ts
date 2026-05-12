import { ref, computed, provide, inject } from 'vue';
import type { InjectionKey } from 'vue';
import type {
  GanttTask,
  FlatGanttTask,
  GanttColumn,
  GanttScale,
  GanttSnapMode,
  GanttStatusStyle
} from '../types/gantt';
import { flattenTasks } from '../utils/gantt';
import {
  parseLocalDate,
  addDays,
  addMonths,
  diffDays,
  diffWeeks,
  diffMonths,
  startOfWeek,
  startOfMonth,
  formatLocalDate
} from '../utils/date';
import type { GanttEventBus } from './useGanttPlugin';

export function createGanttStore(eventBus: GanttEventBus) {
  const tasks = ref<GanttTask[]>([]);
  const columns = ref<GanttColumn[]>([
    { field: 'name', label: 'Task Name', width: 250, tree: true }
  ]);
  const scale = ref<GanttScale>('day');
  const scrollTop = ref(0);
  const scrollLeft = ref(0);
  const viewportHeight = ref(500);
  const viewportWidth = ref(800);
  const rowHeight = ref(40);
  const readOnly = ref(false);
  const editable = ref(true);
  const multiSelect = ref(true);
  const snapMode = ref<GanttSnapMode>('day');
  const weekStartsOn = ref(1);
  const selectedTaskIds = ref<(string | number)[]>([]);
  const linkingSourceTaskId = ref<string | number | null>(null);
  const statusStyleMap = ref<Record<string, GanttStatusStyle>>({});
  const nonWorkingWeekdays = ref<number[]>([0, 6]);
  const holidays = ref<string[]>([]);
  const hideHolidays = ref(false);
  const showBaseline = ref(false);
  const showTodayLine = ref(true);

  const historyPast = ref<{ taskId: string | number; prevStart: string; prevEnd: string; nextStart: string; nextEnd: string }[]>([]);
  const historyFuture = ref<{ taskId: string | number; prevStart: string; prevEnd: string; nextStart: string; nextEnd: string }[]>([]);

  const columnWidth = computed(() => {
    if (scale.value === 'month') return 180;
    if (scale.value === 'week') return 120;
    return 44;
  });

  const flatTasks = computed(() => flattenTasks(tasks.value));

  const allVisibleTasks = computed(() => flatTasks.value.filter(task => task._visible));

  const taskNodeMap = computed(() => {
    const map = new Map<string | number, GanttTask>();
    const walk = (nodes: GanttTask[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children);
        }
      }
    };
    walk(tasks.value);
    return map;
  });

  const manualStartDate = ref<Date | null>(null);
  const manualEndDate = ref<Date | null>(null);

  const computedDateRange = computed(() => {
    let minDate = new Date();
    let maxDate = new Date();
    let hasTasks = false;

    for (const task of flatTasks.value) {
      const sDate = parseLocalDate(task.startDate);
      const eDate = parseLocalDate(task.endDate);
      if (!hasTasks) {
        minDate = sDate;
        maxDate = eDate;
        hasTasks = true;
      } else {
        if (sDate < minDate) minDate = sDate;
        if (eDate > maxDate) maxDate = eDate;
      }
    }

    if (!hasTasks) {
      const now = new Date();
      minDate = new Date(now.getFullYear(), now.getMonth(), 1);
      maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      minDate = addDays(minDate, -7);
      maxDate = addDays(maxDate, 7);
    }
    
    // 如果设置了 manualStartDate/EndDate，它必须覆盖计算出来的值
    if (manualStartDate.value) minDate = manualStartDate.value;
    if (manualEndDate.value) maxDate = manualEndDate.value;

    if (scale.value === 'week') {
      minDate = startOfWeek(minDate, weekStartsOn.value);
      maxDate = startOfWeek(maxDate, weekStartsOn.value);
      maxDate = addDays(maxDate, 6);
    } else if (scale.value === 'month') {
      minDate = startOfMonth(minDate);
      maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
    }

    return { startDate: minDate, endDate: maxDate };
  });

  const isTimelineExpanding = ref(false);

  // Tooltip state
  const activeTooltipTask = ref<import('../types/gantt').FlatGanttTask | null>(null);
  const tooltipPosition = ref({ x: 0, y: 0 });
  
  const showTooltip = (task: import('../types/gantt').FlatGanttTask, event: MouseEvent) => {
    activeTooltipTask.value = task;
    tooltipPosition.value = { x: event.clientX, y: event.clientY };
  };
  const hideTooltip = () => {
    activeTooltipTask.value = null;
  };
  const updateTooltipPosition = (event: MouseEvent) => {
    if (activeTooltipTask.value) {
      tooltipPosition.value = { x: event.clientX, y: event.clientY };
    }
  };

  const expandStartDate = (days: number) => {
    isTimelineExpanding.value = true;
    const current = computedDateRange.value.startDate;
    manualStartDate.value =
      scale.value === 'month'
        ? addMonths(startOfMonth(current), -Math.max(1, Math.round(days / 30)))
        : addDays(current, -days);

    if (!manualEndDate.value) {
      manualEndDate.value = computedDateRange.value.endDate;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTimelineExpanding.value = false;
      });
    });
  };

  const prependTimeline = (days: number) => {
    expandStartDate(days);
  };

  const expandEndDate = (days: number) => {
    isTimelineExpanding.value = true;
    const current = computedDateRange.value.endDate;
    const monthStep = Math.max(1, Math.round(days / 30));
    const nextMonth = addMonths(startOfMonth(current), monthStep);
    manualEndDate.value =
      scale.value === 'month'
        ? new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)
        : addDays(current, days);

    if (!manualStartDate.value) {
      manualStartDate.value = computedDateRange.value.startDate;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isTimelineExpanding.value = false;
      });
    });
  };

  const appendTimeline = (days: number) => {
    expandEndDate(days);
  };

  const startDate = computed(() => computedDateRange.value.startDate);
  const endDate = computed(() => computedDateRange.value.endDate);
  const today = computed(() => parseLocalDate(new Date()));

  const totalHeight = computed(() => allVisibleTasks.value.length * rowHeight.value);

  // 纵向虚拟滚动切片
  const startIndex = computed(() => Math.floor(scrollTop.value / rowHeight.value));
  const endIndex = computed(() => Math.min(
    allVisibleTasks.value.length,
    Math.ceil((scrollTop.value + viewportHeight.value) / rowHeight.value)
  ));

  const bufferSize = 2;
  const renderStartIndex = computed(() => Math.max(0, startIndex.value - bufferSize));
  const renderEndIndex = computed(() => Math.min(allVisibleTasks.value.length, endIndex.value + bufferSize));

  const visibleTasks = computed(() => allVisibleTasks.value.slice(renderStartIndex.value, renderEndIndex.value));
  const offsetY = computed(() => renderStartIndex.value * rowHeight.value);

  // 横向虚拟滚动（计算时间范围）
  const startColIndex = computed(() => Math.floor(scrollLeft.value / columnWidth.value));
  const endColIndex = computed(() => Math.ceil((scrollLeft.value + viewportWidth.value) / columnWidth.value));

  const renderStartColIndex = computed(() => Math.max(0, startColIndex.value - bufferSize));
  
  const activeDates = computed(() => {
    const dates: Date[] = [];
    let current = new Date(startDate.value);
    const end = endDate.value;

    if (scale.value === 'week') {
      const weeks = Math.max(1, diffWeeks(startDate.value, end, weekStartsOn.value) + 1);
      for (let i = 0; i < weeks; i++) {
        dates.push(addDays(startDate.value, i * 7));
      }
    } else if (scale.value === 'month') {
      const months = Math.max(1, diffMonths(startDate.value, end) + 1);
      for (let i = 0; i < months; i++) {
        dates.push(addMonths(startDate.value, i));
      }
    } else {
      // Day scale
      while (current <= end) {
        if (!hideHolidays.value || !isNonWorkingDay(current)) {
          dates.push(new Date(current));
        }
        current = addDays(current, 1);
      }
    }
    return dates;
  });

  const totalCols = computed(() => activeDates.value.length);

  const renderEndColIndex = computed(() => Math.min(totalCols.value, endColIndex.value + bufferSize));

  const visibleDates = computed(() => {
    return activeDates.value.slice(renderStartColIndex.value, renderEndColIndex.value);
  });

  const getVisibleDayIndex = (date: Date) => {
    const d = parseLocalDate(date);
    if (scale.value !== 'day' || !hideHolidays.value) {
      if (scale.value === 'week') return diffWeeks(startDate.value, d, weekStartsOn.value);
      if (scale.value === 'month') return diffMonths(startDate.value, d);
      return diffDays(startDate.value, d);
    }

    // 对于隐藏节假日的情况，找到该日期或之后第一个可见日期的索引
    const dateStr = formatLocalDate(d);
    const index = activeDates.value.findIndex(ad => formatLocalDate(ad) >= dateStr);
    return index === -1 ? activeDates.value.length : index;
  };

  const getDateByVisibleIndex = (index: number) => {
    if (scale.value !== 'day' || !hideHolidays.value) {
      if (scale.value === 'week') return addDays(startDate.value, index * 7);
      if (scale.value === 'month') return addMonths(startDate.value, index);
      return addDays(startDate.value, index);
    }
    
    if (index < 0) return activeDates.value[0] || startDate.value;
    if (index >= activeDates.value.length) return activeDates.value[activeDates.value.length - 1] || endDate.value;
    return activeDates.value[index];
  };

  const getVisibleDaysCount = (start: Date, end: Date) => {
    const s = parseLocalDate(start);
    const e = parseLocalDate(end);
    if (scale.value !== 'day' || !hideHolidays.value) {
      return diffDays(s, e) + 1;
    }
    
    const sStr = formatLocalDate(s);
    const eStr = formatLocalDate(e);
    return activeDates.value.filter(ad => {
      const adStr = formatLocalDate(ad);
      return adStr >= sStr && adStr <= eStr;
    }).length;
  };

  const offsetX = computed(() => renderStartColIndex.value * columnWidth.value);
  const totalWidth = computed(() => totalCols.value * columnWidth.value);

  const isTaskReadOnly = (task: GanttTask | FlatGanttTask) => {
    return readOnly.value || !editable.value || task.readOnly === true || task.disabled === true;
  };

  const isHoliday = (date: Date) => holidays.value.includes(formatLocalDate(parseLocalDate(date)));

  const isNonWorkingDay = (date: Date) => {
    if (scale.value !== 'day') return false;
    return nonWorkingWeekdays.value.includes(date.getDay()) || isHoliday(date);
  };

  const normalizeTaskDates = (startInput: string | Date | number, endInput: string | Date | number) => {
    const start = parseLocalDate(startInput);
    const end = parseLocalDate(endInput);
    if (end < start) {
      return { start: formatLocalDate(start), end: formatLocalDate(start), corrected: true };
    }
    return { start: formatLocalDate(start), end: formatLocalDate(end), corrected: false };
  };

  const pushHistory = (record: { taskId: string | number; prevStart: string; prevEnd: string; nextStart: string; nextEnd: string }) => {
    historyPast.value.push(record);
    if (historyPast.value.length > 100) {
      historyPast.value.shift();
    }
    historyFuture.value = [];
  };

  const moveTaskByDays = (taskId: string | number, days: number) => {
    const task = taskNodeMap.value.get(taskId);
    if (!task || isTaskReadOnly(task)) return;
    const start = parseLocalDate(task.startDate);
    const end = parseLocalDate(task.endDate);
    const nextStart = addDays(start, days);
    const nextEnd = addDays(end, days);
    updateTaskDates(taskId, nextStart, nextEnd);
  };

  const moveSelectedTasks = (direction: 1 | -1) => {
    const unit =
      snapMode.value === 'week'
        ? 7
        : snapMode.value === 'month'
          ? 30
          : 1;
    selectedTaskIds.value.forEach((taskId) => moveTaskByDays(taskId, direction * unit));
  };

  const selectTask = (taskId: string | number, options?: { append?: boolean; toggle?: boolean }) => {
    const task = taskNodeMap.value.get(taskId);
    if (!task || task.selectable === false) return;

    if (!multiSelect.value || !options?.append) {
      selectedTaskIds.value = [taskId];
      eventBus.emit('onSelectionChange', { selectedTaskIds: selectedTaskIds.value });
      return;
    }

    if (options.toggle) {
      const exists = selectedTaskIds.value.includes(taskId);
      selectedTaskIds.value = exists
        ? selectedTaskIds.value.filter((id) => id !== taskId)
        : [...selectedTaskIds.value, taskId];
      eventBus.emit('onSelectionChange', { selectedTaskIds: selectedTaskIds.value });
      return;
    }

    if (!selectedTaskIds.value.includes(taskId)) {
      selectedTaskIds.value = [...selectedTaskIds.value, taskId];
      eventBus.emit('onSelectionChange', { selectedTaskIds: selectedTaskIds.value });
    }
  };

  const clearSelection = () => {
    selectedTaskIds.value = [];
    eventBus.emit('onSelectionChange', { selectedTaskIds: selectedTaskIds.value });
  };

  const beginDependencyLink = (taskId: string | number) => {
    const task = taskNodeMap.value.get(taskId);
    if (!task) return;
    linkingSourceTaskId.value = taskId;
  };

  const completeDependencyLink = (targetTaskId: string | number) => {
    const sourceId = linkingSourceTaskId.value;
    linkingSourceTaskId.value = null;
    if (sourceId === null) return false;
    if (sourceId === targetTaskId) return false;

    const targetTask = taskNodeMap.value.get(targetTaskId);
    if (!targetTask) return false;
    if (!Array.isArray(targetTask.dependencies)) {
      targetTask.dependencies = [];
    }
    if (targetTask.dependencies.includes(sourceId)) return false;
    targetTask.dependencies = [...targetTask.dependencies, sourceId];
    eventBus.emit('onDependencyCreate', { sourceId, targetId: targetTaskId });
    return true;
  };

  const undo = () => {
    const record = historyPast.value.pop();
    if (!record) return;
    const task = taskNodeMap.value.get(record.taskId);
    if (!task) return;
    task.startDate = record.prevStart;
    task.endDate = record.prevEnd;
    historyFuture.value.push(record);
  };

  const redo = () => {
    const record = historyFuture.value.pop();
    if (!record) return;
    const task = taskNodeMap.value.get(record.taskId);
    if (!task) return;
    task.startDate = record.nextStart;
    task.endDate = record.nextEnd;
    historyPast.value.push(record);
  };

  const setConfig = (config: {
    readOnly?: boolean;
    editable?: boolean;
    multiSelect?: boolean;
    snapMode?: GanttSnapMode;
    weekStartsOn?: number;
    statusStyleMap?: Record<string, GanttStatusStyle>;
    nonWorkingWeekdays?: number[];
    holidays?: string[];
    hideHolidays?: boolean;
    showBaseline?: boolean;
    showTodayLine?: boolean;
  }) => {
    if (typeof config.readOnly === 'boolean') readOnly.value = config.readOnly;
    if (typeof config.editable === 'boolean') editable.value = config.editable;
    if (typeof config.multiSelect === 'boolean') multiSelect.value = config.multiSelect;
    if (config.snapMode) snapMode.value = config.snapMode;
    if (typeof config.weekStartsOn === 'number') weekStartsOn.value = config.weekStartsOn;
    if (config.statusStyleMap) statusStyleMap.value = config.statusStyleMap;
    if (config.nonWorkingWeekdays) nonWorkingWeekdays.value = config.nonWorkingWeekdays;
    if (config.holidays) holidays.value = config.holidays;
    if (typeof config.hideHolidays === 'boolean') hideHolidays.value = config.hideHolidays;
    if (typeof config.showBaseline === 'boolean') showBaseline.value = config.showBaseline;
    if (typeof config.showTodayLine === 'boolean') showTodayLine.value = config.showTodayLine;
  };

  // 展开/折叠任务
  const toggleTask = (taskId: string | number) => {
    const node = taskNodeMap.value.get(taskId);
    if (!node) return;
    const currentExpanded = node.expanded !== false;
    node.expanded = !currentExpanded;
    eventBus.emit('onTaskToggle', { task: node, expanded: node.expanded });
  };

  const updateTaskDates = (taskId: string | number, newStart: string | Date | number, newEnd: string | Date | number) => {
    const node = taskNodeMap.value.get(taskId);
    if (!node || isTaskReadOnly(node)) return false;

    const prevStart = formatLocalDate(parseLocalDate(node.startDate));
    const prevEnd = formatLocalDate(parseLocalDate(node.endDate));
    const normalized = normalizeTaskDates(newStart, newEnd);

    if (prevStart === normalized.start && prevEnd === normalized.end) return true;

    manualStartDate.value = null;
    manualEndDate.value = null;

    node.startDate = normalized.start;
    node.endDate = normalized.end;
    pushHistory({
      taskId,
      prevStart,
      prevEnd,
      nextStart: normalized.start,
      nextEnd: normalized.end
    });

    if (normalized.corrected) {
      eventBus.emit('onValidationError', {
        task: node,
        reason: '结束时间早于开始时间，已自动修正为同一天'
      });
    };

    return true;
  };

  return {
    tasks,
    columns,
    scale,
    flatTasks,
    allVisibleTasks,
    visibleTasks,
    totalHeight,
    offsetY,
    
    scrollTop,
    scrollLeft,
    viewportHeight,
    viewportWidth,
    rowHeight,
    
    startDate,
    endDate,
    columnWidth,
    totalWidth,
    visibleDates,
    offsetX,
    today,

    isTimelineExpanding,
    activeTooltipTask,
    tooltipPosition,
    showTooltip,
    hideTooltip,
    updateTooltipPosition,
    expandStartDate,
    expandEndDate,
    prependTimeline,
    appendTimeline,
    readOnly,
    editable,
    multiSelect,
    snapMode,
    weekStartsOn,
    selectedTaskIds,
    linkingSourceTaskId,
    statusStyleMap,
    nonWorkingWeekdays,
    holidays,
    hideHolidays,
    showBaseline,
    showTodayLine,
    isTaskReadOnly,
    isNonWorkingDay,
    isHoliday,
    getVisibleDayIndex,
    getDateByVisibleIndex,
    getVisibleDaysCount,
    selectTask,
    clearSelection,
    beginDependencyLink,
    completeDependencyLink,
    moveSelectedTasks,
    undo,
    redo,
    setConfig,
    toggleTask,
    updateTaskDates
  };
}

export type GanttStore = ReturnType<typeof createGanttStore>;
const GanttStoreKey: InjectionKey<GanttStore> = Symbol('GanttStore');

export function provideGanttStore(eventBus: GanttEventBus) {
  const store = createGanttStore(eventBus);
  provide(GanttStoreKey, store);
  return store;
}

export function useGanttStore(): GanttStore {
  const store = inject(GanttStoreKey);
  if (!store) {
    throw new Error('useGanttStore must be used within a component that provides it.');
  }
  return store;
}
