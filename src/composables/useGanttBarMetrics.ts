import { computed, type ComputedRef, type Ref } from 'vue';
import type { FlatGanttTask, GanttScale } from '../types/gantt';
import { parseLocalDate } from '../utils/date';

interface UseGanttBarMetricsOptions {
  task: Ref<FlatGanttTask>;
  startDate: ComputedRef<Date>;
  scale: Ref<GanttScale>;
  columnWidth: ComputedRef<number>;
  getVisibleDayIndex: (date: Date) => number;
  getVisibleDaysCount: (start: Date, end: Date) => number;
}

export function useGanttBarMetrics(options: UseGanttBarMetricsOptions) {
  const pxPerDay = computed(() => {
    if (options.scale.value === 'week') return options.columnWidth.value / 7;
    if (options.scale.value === 'month') return options.columnWidth.value / 30;
    return options.columnWidth.value;
  });

  const baseLeftPx = computed(() => {
    const startD = parseLocalDate(options.task.value.startDate);
    return options.getVisibleDayIndex(startD) * options.columnWidth.value;
  });

  const baseWidthPx = computed(() => {
    const startD = parseLocalDate(options.task.value.startDate);
    const endD = parseLocalDate(options.task.value.endDate);
    if (options.task.value.type === 'milestone') {
      return Math.max(14, options.columnWidth.value * 0.35);
    }

    if (options.scale.value === 'week') {
      const weekSpan = options.getVisibleDayIndex(endD) - options.getVisibleDayIndex(startD) + 1;
      return Math.max(options.columnWidth.value * 0.25, weekSpan * options.columnWidth.value);
    }

    if (options.scale.value === 'month') {
      const monthSpan = options.getVisibleDayIndex(endD) - options.getVisibleDayIndex(startD) + 1;
      return Math.max(options.columnWidth.value * 0.3, monthSpan * options.columnWidth.value);
    }

    const durationDays = options.getVisibleDaysCount(startD, endD);
    return Math.max(options.columnWidth.value * 0.35, durationDays * options.columnWidth.value);
  });

  const minWidthPx = computed(() => Math.max(10, options.columnWidth.value * 0.2));
  const baseRightPx = computed(() => baseLeftPx.value + baseWidthPx.value);

  return {
    baseLeftPx,
    baseWidthPx,
    baseRightPx,
    minWidthPx,
    pxPerDay
  };
}
