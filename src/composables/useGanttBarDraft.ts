import { computed, ref, type ComputedRef } from 'vue';
import type { GanttPreviewMode } from '../types/gantt';
import { formatLocalDate, parseLocalDate } from '../utils/date';

type DraftMode = 'idle' | GanttPreviewMode;

interface UseGanttBarDraftOptions {
  baseLeftPx: ComputedRef<number>;
  baseWidthPx: ComputedRef<number>;
  minWidthPx: ComputedRef<number>;
  pxPerDay: ComputedRef<number>;
  snapStepDays: ComputedRef<number>;
  taskStartDate: ComputedRef<string>;
  taskEndDate: ComputedRef<string>;
  getVisibleDayIndex: (date: Date) => number;
  getDateByVisibleIndex: (index: number) => Date;
}

export function useGanttBarDraft(options: UseGanttBarDraftOptions) {
  const mode = ref<DraftMode>('idle');
  const pointerStartClientX = ref(0);
  const activeClientX = ref(0);
  const maxPointerDeltaPx = ref(0);

  const originLeftPx = ref(0);
  const originWidthPx = ref(0);
  const originStartDate = ref('');
  const originEndDate = ref('');
  const dragAnchorOffsetPx = ref(0);

  const draftLeftPx = ref(0);
  const draftWidthPx = ref(0);

  const isDragging = computed(() => mode.value === 'drag');
  const isResizing = computed(() => mode.value === 'resize-left' || mode.value === 'resize-right');
  const isActive = computed(() => mode.value !== 'idle');

  const quantizeBySnapStep = (rawDays: number) => {
    const step = Math.max(1, options.snapStepDays.value);
    return Math.round(rawDays / step) * step;
  };

  const dragDeltaDays = computed(() =>
    quantizeBySnapStep((draftLeftPx.value - originLeftPx.value) / options.pxPerDay.value)
  );

  const resizeLeftDays = computed(() =>
    quantizeBySnapStep((draftLeftPx.value - originLeftPx.value) / options.pxPerDay.value)
  );

  const resizeRightDays = computed(() =>
    quantizeBySnapStep((draftWidthPx.value - originWidthPx.value) / options.pxPerDay.value)
  );

  const draftStartDate = computed(() => {
    const origin = parseLocalDate(originStartDate.value || options.taskStartDate.value);
    const originEnd = parseLocalDate(originEndDate.value || options.taskEndDate.value);

    if (mode.value === 'drag') {
      const nextIndex = options.getVisibleDayIndex(origin) + dragDeltaDays.value;
      return formatLocalDate(options.getDateByVisibleIndex(nextIndex));
    }

    if (mode.value === 'resize-left') {
      const originIndex = options.getVisibleDayIndex(origin);
      const endIndex = options.getVisibleDayIndex(originEnd);
      const nextIndex = Math.min(originIndex + resizeLeftDays.value, endIndex);
      return formatLocalDate(options.getDateByVisibleIndex(nextIndex));
    }

    return formatLocalDate(origin);
  });

  const draftEndDate = computed(() => {
    const originStart = parseLocalDate(originStartDate.value || options.taskStartDate.value);
    const origin = parseLocalDate(originEndDate.value || options.taskEndDate.value);

    if (mode.value === 'drag') {
      const nextIndex = options.getVisibleDayIndex(origin) + dragDeltaDays.value;
      return formatLocalDate(options.getDateByVisibleIndex(nextIndex));
    }

    if (mode.value === 'resize-right') {
      const startIndex = options.getVisibleDayIndex(originStart);
      const originIndex = options.getVisibleDayIndex(origin);
      const nextIndex = Math.max(originIndex + resizeRightDays.value, startIndex);
      return formatLocalDate(options.getDateByVisibleIndex(nextIndex));
    }

    return formatLocalDate(origin);
  });

  const renderLeftPx = computed(() => (isActive.value ? draftLeftPx.value : options.baseLeftPx.value));
  const renderWidthPx = computed(() => (isActive.value ? draftWidthPx.value : options.baseWidthPx.value));

  const startInteraction = (nextMode: GanttPreviewMode, clientX: number, canvasX: number) => {
    mode.value = nextMode;
    pointerStartClientX.value = clientX;
    activeClientX.value = clientX;
    maxPointerDeltaPx.value = 0;
    originLeftPx.value = options.baseLeftPx.value;
    originWidthPx.value = options.baseWidthPx.value;
    originStartDate.value = options.taskStartDate.value;
    originEndDate.value = options.taskEndDate.value;
    draftLeftPx.value = originLeftPx.value;
    draftWidthPx.value = originWidthPx.value;
    dragAnchorOffsetPx.value = canvasX - originLeftPx.value;
  };

  const startDrag = (clientX: number, canvasX: number) => {
    startInteraction('drag', clientX, canvasX);
  };

  const startResize = (side: 'left' | 'right', clientX: number, canvasX: number) => {
    startInteraction(side === 'left' ? 'resize-left' : 'resize-right', clientX, canvasX);
  };

  const updateFromCanvas = (clientX: number, canvasX: number) => {
    if (mode.value === 'idle') return;

    activeClientX.value = clientX;
    maxPointerDeltaPx.value = Math.max(maxPointerDeltaPx.value, Math.abs(clientX - pointerStartClientX.value));

    if (mode.value === 'drag') {
      draftLeftPx.value = canvasX - dragAnchorOffsetPx.value;
      draftWidthPx.value = originWidthPx.value;
    } else if (mode.value === 'resize-left') {
      const maxLeftPx = originLeftPx.value + originWidthPx.value - options.minWidthPx.value;
      const nextLeftPx = Math.min(canvasX, maxLeftPx);
      draftLeftPx.value = nextLeftPx;
      draftWidthPx.value = originLeftPx.value + originWidthPx.value - nextLeftPx;
    } else {
      const nextWidthPx = Math.max(options.minWidthPx.value, canvasX - originLeftPx.value);
      draftLeftPx.value = originLeftPx.value;
      draftWidthPx.value = nextWidthPx;
    }

    const previewDeltaPx =
      mode.value === 'drag'
        ? Math.abs(draftLeftPx.value - originLeftPx.value)
        : Math.max(
            Math.abs(draftLeftPx.value - originLeftPx.value),
            Math.abs(draftWidthPx.value - originWidthPx.value)
          );

    maxPointerDeltaPx.value = Math.max(
      maxPointerDeltaPx.value,
      Math.abs(clientX - pointerStartClientX.value),
      previewDeltaPx
    );
  };

  const applyTimelineShift = (shiftPx: number) => {
    if (!isActive.value || shiftPx === 0) return;

    originLeftPx.value += shiftPx;
    draftLeftPx.value += shiftPx;
  };

  const cancel = () => {
    mode.value = 'idle';
    draftLeftPx.value = options.baseLeftPx.value;
    draftWidthPx.value = options.baseWidthPx.value;
  };

  const finish = () => {
    const result = {
      mode: mode.value,
      maxPointerDeltaPx: maxPointerDeltaPx.value,
      draftLeftPx: draftLeftPx.value,
      draftWidthPx: draftWidthPx.value,
      draftStartDate: draftStartDate.value,
      draftEndDate: draftEndDate.value
    };

    cancel();
    return result;
  };

  return {
    mode,
    isActive,
    isDragging,
    isResizing,
    renderLeftPx,
    renderWidthPx,
    draftLeftPx,
    draftWidthPx,
    draftStartDate,
    draftEndDate,
    activeClientX,
    startDrag,
    startResize,
    updateFromCanvas,
    applyTimelineShift,
    cancel,
    finish
  };
}
