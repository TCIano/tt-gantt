<template>
  <div
    ref="containerRef"
    class="gantt-bar-container"
    :class="[
      {
        'is-dragging': isDragging,
        'is-resizing': isResizing,
        'is-expanding': store.isTimelineExpanding.value,
        'is-readonly': isCurrentTaskReadOnly,
        'is-milestone-container': isMilestone,
        'is-selected': store.selectedTaskIds.value.includes(task.id)
      },
      props.customClass ? props.customClass(task) : ''
    ]"
    :style="[
      {
        left: `${renderLeftPx}px`,
        width: `${renderWidthPx}px`
      },
      props.customStyle ? props.customStyle(task) : {}
    ]"
    @pointerdown.stop.prevent="onPointerDown"
    @lostpointercapture="onPointerCaptureLost"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @click.stop="onBarClick"
  >
    <slot name="bar" :task="task" :isDragging="isDragging" :isResizing="isResizing">
      <div class="gantt-bar" :class="{ 'is-milestone': isMilestone }" :style="barInlineStyle">
        <div
          v-if="task.progress !== undefined"
          class="gantt-bar-progress"
          :style="{ width: `${task.progress}%` }"
        >
          <div class="progress-shine"></div>
        </div>
        <span class="gantt-bar-label">{{ task.name }}</span>
      </div>
    </slot>
    <div
      v-if="!isCurrentTaskReadOnly && !isMilestone"
      class="gantt-bar-handle left"
      @pointerdown.stop.prevent="onResizeStart($event, 'left')"
    >
      <div class="handle-inner"></div>
    </div>
    <div
      v-if="!isCurrentTaskReadOnly && !isMilestone"
      class="gantt-bar-handle right"
      @pointerdown.stop.prevent="onResizeStart($event, 'right')"
    >
      <div class="handle-inner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import type {
  FlatGanttTask,
  GanttPreviewMode,
  GanttBarClassFn,
  GanttBarStyleFn
} from '../types/gantt';
import { useGanttStore } from '../composables/useGanttStore';
import { useGanttEventBus } from '../composables/useGanttPlugin';
import { useGanttBarMetrics } from '../composables/useGanttBarMetrics';
import { useGanttBarDraft } from '../composables/useGanttBarDraft';
import { useGanttTimelineExpansion } from '../composables/useGanttTimelineExpansion';
import { getCanvasX } from '../composables/useGanttCanvasPointer';

const props = defineProps<{
  task: FlatGanttTask;
  customClass?: GanttBarClassFn;
  customStyle?: GanttBarStyleFn;
}>();

const store = useGanttStore();
const {
  startDate,
  columnWidth,
  updateTaskDates,
  showTooltip,
  hideTooltip,
  updateTooltipPosition,
  getVisibleDayIndex,
  getDateByVisibleIndex,
  getVisibleDaysCount
} = store;
const eventBus = useGanttEventBus();

const containerRef = ref<HTMLElement | null>(null);
const taskRef = computed(() => props.task);
const taskStartDate = computed(() => String(props.task.startDate));
const taskEndDate = computed(() => String(props.task.endDate));

const { baseLeftPx, baseWidthPx, minWidthPx, pxPerDay } = useGanttBarMetrics({
  task: taskRef,
  startDate,
  scale: store.scale,
  columnWidth,
  getVisibleDayIndex,
  getVisibleDaysCount
});

const draft = useGanttBarDraft({
  baseLeftPx,
  baseWidthPx,
  minWidthPx,
  pxPerDay,
  snapStepDays: computed(() => {
    if (store.snapMode.value === 'week') return 7;
    if (store.snapMode.value === 'month') return 30;
    return 1;
  }),
  taskStartDate,
  taskEndDate,
  getVisibleDayIndex,
  getDateByVisibleIndex
});

const { syncPointer, stopAutoScroll } = useGanttTimelineExpansion({
  columnWidth,
  scale: store.scale,
  prependTimeline: store.prependTimeline,
  appendTimeline: store.appendTimeline,
  setScrollLeft: (val) => {
    store.scrollLeft.value = val;
  }
});

const isDragging = computed(() => draft.isDragging.value);
const isResizing = computed(() => draft.isResizing.value);
const renderLeftPx = computed(() => draft.renderLeftPx.value);
const renderWidthPx = computed(() => draft.renderWidthPx.value);
const isMilestone = computed(() => props.task.type === 'milestone');
const isCurrentTaskReadOnly = computed(() => store.isTaskReadOnly(props.task));
const barInlineStyle = computed(() => {
  const style = store.statusStyleMap.value[String(props.task.status || '')] || {};
  return {
    background: style.barColor || undefined,
    color: style.textColor || undefined
  };
});
let isFinishingInteraction = false;
let previousBodyUserSelect = '';
let previousBodyWebkitUserSelect = '';

const lockDocumentSelection = () => {
  previousBodyUserSelect = document.body.style.userSelect;
  previousBodyWebkitUserSelect = document.body.style.webkitUserSelect;
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
};

const unlockDocumentSelection = () => {
  document.body.style.userSelect = previousBodyUserSelect;
  document.body.style.webkitUserSelect = previousBodyWebkitUserSelect;
};

const restoreTransition = (includeWidth: boolean) => {
  if (!containerRef.value) return;
  containerRef.value.style.transition = includeWidth
    ? 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    : 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
};

const removeDragListeners = () => {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerCancel);
};

const removeResizeListeners = () => {
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', onResizeEnd);
  window.removeEventListener('pointercancel', onPointerCancel);
};

const cancelActiveInteraction = () => {
  if (!draft.isActive.value) return;

  removeDragListeners();
  removeResizeListeners();
  stopAutoScroll();
  unlockDocumentSelection();
  draft.cancel();
  eventBus.emit('onTaskPreviewEnd', { taskId: props.task.id });
  restoreTransition(true);
};

const updateDraftPreview = (mode: GanttPreviewMode) => {
  eventBus.emit('onTaskPreviewChange', {
    taskId: props.task.id,
    mode,
    draftLeftPx: draft.draftLeftPx.value,
    draftWidthPx: draft.draftWidthPx.value,
    draftStartDate: draft.draftStartDate.value,
    draftEndDate: draft.draftEndDate.value
  });
};

const updatePreviewFromViewport = (clientX: number, timelineShiftPx = 0) => {
  if (!containerRef.value) return;
  const ganttRightEl = containerRef.value.closest('.gantt-right');
  if (!(ganttRightEl instanceof HTMLElement) || !draft.mode.value || draft.mode.value === 'idle')
    return;

  draft.applyTimelineShift(timelineShiftPx);
  const canvasX = getCanvasX(clientX, ganttRightEl);
  draft.updateFromCanvas(clientX, canvasX);
  updateDraftPreview(draft.mode.value);
};

const onResizeStart = (e: PointerEvent, side: 'left' | 'right') => {
  if (isCurrentTaskReadOnly.value || isMilestone.value) return;
  if (e.button !== 0) return;
  if (!containerRef.value) return;

  e.preventDefault();
  hideTooltip();
  lockDocumentSelection();

  const ganttRightEl = containerRef.value.closest('.gantt-right');
  if (!(ganttRightEl instanceof HTMLElement)) return;

  draft.startResize(side, e.clientX, getCanvasX(e.clientX, ganttRightEl));

  if (containerRef.value) {
    containerRef.value.setPointerCapture(e.pointerId);
    containerRef.value.style.transition = 'none';
  }

  window.addEventListener('pointermove', onResizeMove, { passive: true });
  window.addEventListener('pointerup', onResizeEnd);
  window.addEventListener('pointercancel', onPointerCancel);
};

const onResizeMove = (e: PointerEvent) => {
  if (!draft.isResizing.value || !containerRef.value) return;
  updatePreviewFromViewport(e.clientX);

  const ganttRightEl = containerRef.value.closest('.gantt-right');
  if (ganttRightEl instanceof HTMLElement) {
    syncPointer({
      container: ganttRightEl,
      clientX: e.clientX,
      onViewportChange: updatePreviewFromViewport
    });
  }
};

const onResizeEnd = (e: PointerEvent) => {
  if (!draft.isResizing.value) return;
  isFinishingInteraction = true;

  removeResizeListeners();
  stopAutoScroll();
  unlockDocumentSelection();

  if (containerRef.value) {
    containerRef.value.releasePointerCapture(e.pointerId);
  }

  const result = draft.finish();
  eventBus.emit('onTaskPreviewEnd', { taskId: props.task.id });
  restoreTransition(true);

  if (result.maxPointerDeltaPx < 3) {
    isFinishingInteraction = false;
    return;
  }

  const changed =
    result.draftStartDate !== taskStartDate.value || result.draftEndDate !== taskEndDate.value;

  if (changed) {
    updateTaskDates(props.task.id, result.draftStartDate, result.draftEndDate);
    eventBus.emit('onTaskDrop', {
      task: props.task,
      newStartDate: result.draftStartDate,
      newEndDate: result.draftEndDate
    });
  } else {
    restoreTransition(true);
  }
  isFinishingInteraction = false;
};

const onPointerDown = (e: PointerEvent) => {
  if (isCurrentTaskReadOnly.value || isMilestone.value) return;
  if (e.button !== 0) return; // 仅允许左键拖拽
  if (!containerRef.value) return;

  e.preventDefault();
  hideTooltip();
  lockDocumentSelection();

  const ganttRightEl = containerRef.value.closest('.gantt-right');
  if (!(ganttRightEl instanceof HTMLElement)) return;

  draft.startDrag(e.clientX, getCanvasX(e.clientX, ganttRightEl));

  if (containerRef.value) {
    containerRef.value.setPointerCapture(e.pointerId);
    containerRef.value.style.transition = 'none';
  }

  eventBus.emit('onTaskDragStart', { task: props.task, event: e });

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
};

const onPointerMove = (e: PointerEvent) => {
  if (!draft.isDragging.value || !containerRef.value) return;

  updatePreviewFromViewport(e.clientX);

  const ganttRightEl = containerRef.value.closest('.gantt-right');
  if (ganttRightEl instanceof HTMLElement) {
    syncPointer({
      container: ganttRightEl,
      clientX: e.clientX,
      onViewportChange: updatePreviewFromViewport
    });
  }
};

const onPointerUp = (e: PointerEvent) => {
  if (!draft.isDragging.value) return;
  isFinishingInteraction = true;

  removeDragListeners();
  stopAutoScroll();
  unlockDocumentSelection();

  if (containerRef.value) {
    containerRef.value.releasePointerCapture(e.pointerId);
  }

  const result = draft.finish();
  eventBus.emit('onTaskPreviewEnd', { taskId: props.task.id });
  restoreTransition(false);

  const isClick = result.maxPointerDeltaPx < 3;
  if (isClick) {
    eventBus.emit('onTaskClick', { task: props.task, event: e as unknown as MouseEvent });
    isFinishingInteraction = false;
    return;
  }

  const changed =
    result.draftStartDate !== taskStartDate.value || result.draftEndDate !== taskEndDate.value;

  if (changed) {
    updateTaskDates(props.task.id, result.draftStartDate, result.draftEndDate);
    eventBus.emit('onTaskDrop', {
      task: props.task,
      newStartDate: result.draftStartDate,
      newEndDate: result.draftEndDate
    });
  } else {
    restoreTransition(false);
  }
  isFinishingInteraction = false;
};

const onPointerCancel = () => {
  cancelActiveInteraction();
};

const onPointerCaptureLost = () => {
  if (isFinishingInteraction) return;
  cancelActiveInteraction();
};

const onMouseEnter = (e: MouseEvent) => {
  if (isDragging.value || isResizing.value) return;
  showTooltip(props.task, e);
};

const onMouseMove = (e: MouseEvent) => {
  if (isDragging.value || isResizing.value) {
    hideTooltip();
    return;
  }
  updateTooltipPosition(e);
};

const onMouseLeave = () => {
  hideTooltip();
};

const onBarClick = (e: MouseEvent) => {
  if (e.shiftKey) {
    if (store.linkingSourceTaskId.value === null) {
      store.beginDependencyLink(props.task.id);
      return;
    }
    store.completeDependencyLink(props.task.id);
    return;
  }

  store.selectTask(props.task.id, {
    append: e.ctrlKey || e.metaKey,
    toggle: e.ctrlKey || e.metaKey
  });
};

onUnmounted(() => {
  cancelActiveInteraction();
  unlockDocumentSelection();
  hideTooltip();
});
</script>

<style scoped>
.gantt-bar-container {
  position: absolute;
  top: 6px;
  bottom: 6px;
  cursor: grab;
  z-index: 10;
  will-change: left, width;
  transition:
    left 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
}

.gantt-bar-container.is-selected {
  z-index: 15;
}

.gantt-bar-container.is-selected .gantt-bar {
  border: 1.5px solid white;
  box-shadow:
    0 0 0 2px #4f46e5,
    0 4px 10px rgba(79, 70, 229, 0.4);
  transform: translateY(-1px);
}

.gantt-bar-container.is-dragging {
  cursor: grabbing;
  z-index: 100;
  transition: opacity 0.2s ease !important;
}

.gantt-bar {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border-radius: 8px;
  color: white;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.gantt-bar.is-milestone {
  border-radius: 4px;
  transform: rotate(45deg);
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  margin-top: 4px;
  justify-content: center;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);
}

.gantt-bar-progress {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 7px 0 0 7px;
  pointer-events: none;
  overflow: hidden;
}

.progress-shine {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  animation: shine 3s infinite linear;
}

@keyframes shine {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

.gantt-bar-label {
  padding: 0 10px;
  z-index: 1;
  text-overflow: ellipsis;
  overflow: hidden;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.gantt-bar-container:hover .gantt-bar {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(79, 70, 229, 0.3);
}

.gantt-bar-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: col-resize;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.gantt-bar-container:hover .gantt-bar-handle {
  opacity: 1;
}

.handle-inner {
  width: 4px;
  height: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 2px;
}

.gantt-bar-handle.left {
  left: -6px;
}
.gantt-bar-handle.right {
  right: -6px;
}

.gantt-bar-container.is-dragging .gantt-bar {
  opacity: 0.85;
  transform: scale(1.02) translateY(-2px);
  box-shadow: 0 8px 16px rgba(79, 70, 229, 0.4);
}
</style>
