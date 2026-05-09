import { ref, computed, provide, inject } from 'vue';
import type { InjectionKey } from 'vue';
import type { GanttTask } from '../types/gantt';
import { flattenTasks } from '../utils/gantt';
import { parseLocalDate, addDays, diffDays } from '../utils/date';
import type { GanttEventBus } from './useGanttPlugin';

export function createGanttStore(eventBus: GanttEventBus) {
  const tasks = ref<GanttTask[]>([]);
  const columns = ref<import('../types/gantt').GanttColumn[]>([
    { field: 'name', label: 'Task Name', width: 250, tree: true }
  ]);
  const scale = ref<import('../types/gantt').GanttScale>('day');
  const scrollTop = ref(0);
  const scrollLeft = ref(0);
  const viewportHeight = ref(500);
  const viewportWidth = ref(800);
  const rowHeight = ref(40);
  
  const columnWidth = computed(() => {
    if (scale.value === 'month') return 200;
    if (scale.value === 'week') return 100;
    return 50; // day
  });

  const flatTasks = computed(() => flattenTasks(tasks.value));
  
  const allVisibleTasks = computed(() => flatTasks.value.filter(task => task._visible));
  
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
    if (manualStartDate.value) {
      minDate = manualStartDate.value;
    }
    if (manualEndDate.value) {
      maxDate = manualEndDate.value;
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
    manualStartDate.value = addDays(current, -days);
    
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
    manualEndDate.value = addDays(current, days);
    
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
  
  const totalCols = computed(() => {
    const days = Math.max(0, diffDays(startDate.value, endDate.value) + 1);
    if (scale.value === 'week') return Math.ceil(days / 7);
    if (scale.value === 'month') return Math.ceil(days / 30);
    return days;
  });

  const renderEndColIndex = computed(() => Math.min(totalCols.value, endColIndex.value + bufferSize));

  const visibleDates = computed(() => {
    const dates = [];
    for (let i = renderStartColIndex.value; i < renderEndColIndex.value; i++) {
      if (scale.value === 'week') {
        dates.push(addDays(startDate.value, i * 7));
      } else if (scale.value === 'month') {
        dates.push(addDays(startDate.value, i * 30)); // 这是一个近似值，并非严格的自然月
      } else {
        dates.push(addDays(startDate.value, i));
      }
    }
    return dates;
  });

  const offsetX = computed(() => renderStartColIndex.value * columnWidth.value);
  const totalWidth = computed(() => totalCols.value * columnWidth.value);

  // 展开/折叠任务
  const toggleTask = (taskId: string | number) => {
    const toggle = (nodes: GanttTask[]): boolean => {
      for (const node of nodes) {
        if (node.id === taskId) {
          // 默认未设置 expanded 时视为 true（展开）
          const currentExpanded = node.expanded !== false;
          node.expanded = !currentExpanded;
          eventBus.emit('onTaskToggle', { task: node, expanded: node.expanded });
          return true;
        }
        if (node.children && toggle(node.children)) {
          return true;
        }
      }
      return false;
    };
    toggle(tasks.value);
  };

  const updateTaskDates = (taskId: string | number, newStart: string | Date | number, newEnd: string | Date | number) => {
    manualStartDate.value = null;
    manualEndDate.value = null;
    const update = (nodes: GanttTask[]): boolean => {
      for (const node of nodes) {
        if (node.id === taskId) {
          node.startDate = newStart;
          node.endDate = newEnd;
          return true;
        }
        if (node.children && update(node.children)) {
          return true;
        }
      }
      return false;
    };
    update(tasks.value);
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
