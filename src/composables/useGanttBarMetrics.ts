import { computed, type ComputedRef, type Ref } from 'vue';
import type { FlatGanttTask, GanttScale } from '../types/gantt';
import { diffDays, parseLocalDate } from '../utils/date';

interface UseGanttBarMetricsOptions {
  task: Ref<FlatGanttTask>;
  startDate: ComputedRef<Date>;
  scale: Ref<GanttScale>;
  columnWidth: ComputedRef<number>;
}

export function useGanttBarMetrics(options: UseGanttBarMetricsOptions) {
  const getDaysPerColumn = () => {
    if (options.scale.value === 'week') return 7;
    if (options.scale.value === 'month') return 30;
    return 1;
  };

  const pxPerDay = computed(() => options.columnWidth.value / getDaysPerColumn());

  const baseLeftPx = computed(() => {
    const startD = parseLocalDate(options.task.value.startDate);
    return diffDays(options.startDate.value, startD) * pxPerDay.value;
  });

  const baseWidthPx = computed(() => {
    const startD = parseLocalDate(options.task.value.startDate);
    const endD = parseLocalDate(options.task.value.endDate);
    const durationDays = diffDays(startD, endD) + 1;
    return durationDays * pxPerDay.value;
  });

  const minWidthPx = computed(() => pxPerDay.value);
  const baseRightPx = computed(() => baseLeftPx.value + baseWidthPx.value);

  return {
    baseLeftPx,
    baseWidthPx,
    baseRightPx,
    minWidthPx,
    pxPerDay
  };
}
