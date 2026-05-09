<template>
  <div
    ref="containerRef"
    class="gantt-bar-container"
    :class="{ 'is-dragging': isDragging, 'is-resizing': isResizing, 'is-expanding': store.isTimelineExpanding.value }"
    :style="{
      left: `${renderLeftPx}px`,
      width: `${renderWidthPx}px`
    }"
    @pointerdown.stop="onPointerDown"
    @lostpointercapture="onPointerCaptureLost"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <slot name="bar" :task="task" :isDragging="isDragging" :isResizing="isResizing">
      <div class="gantt-bar">
        <div v-if="task.progress !== undefined" class="gantt-bar-progress" :style="{ width: `${task.progress}%` }"></div>
        <span class="gantt-bar-label">{{ task.name }}</span>
      </div>
    </slot>
    <div class="gantt-bar-handle left" @pointerdown.stop="onResizeStart($event, 'left')"></div>
    <div class="gantt-bar-handle right" @pointerdown.stop="onResizeStart($event, 'right')"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import type { FlatGanttTask, GanttPreviewMode } from '../types/gantt';
import { useGanttStore } from '../composables/useGanttStore';
import { useGanttEventBus } from '../composables/useGanttPlugin';
import { useGanttBarMetrics } from '../composables/useGanttBarMetrics';
import { useGanttBarDraft } from '../composables/useGanttBarDraft';
import { useGanttTimelineExpansion } from '../composables/useGanttTimelineExpansion';
import { getCanvasX } from '../composables/useGanttCanvasPointer';

const props = defineProps<{
  task: FlatGanttTask
}>();

const store = useGanttStore();
const { startDate, columnWidth, updateTaskDates, showTooltip, hideTooltip, updateTooltipPosition } = store;
const eventBus = useGanttEventBus();

const containerRef = ref<HTMLElement | null>(null);
const taskRef = computed(() => props.task);
const taskStartDate = computed(() => String(props.task.startDate));
const taskEndDate = computed(() => String(props.task.endDate));

const { baseLeftPx, baseWidthPx, minWidthPx, pxPerDay } = useGanttBarMetrics({
  task: taskRef,
  startDate,
  scale: store.scale,
  columnWidth
});

const draft = useGanttBarDraft({
  baseLeftPx,
  baseWidthPx,
  minWidthPx,
  pxPerDay,
  taskStartDate,
  taskEndDate
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
let isFinishingInteraction = false;

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
  if (!(ganttRightEl instanceof HTMLElement) || !draft.mode.value || draft.mode.value === 'idle') return;

  draft.applyTimelineShift(timelineShiftPx);
  const canvasX = getCanvasX(clientX, ganttRightEl);
  draft.updateFromCanvas(clientX, canvasX);
  updateDraftPreview(draft.mode.value);
};

const onResizeStart = (e: PointerEvent, side: 'left' | 'right') => {
  if (e.button !== 0) return;
  if (!containerRef.value) return;

  hideTooltip();

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
    result.draftStartDate !== taskStartDate.value ||
    result.draftEndDate !== taskEndDate.value;

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
  if (e.button !== 0) return; // 仅允许左键拖拽
  if (!containerRef.value) return;

  hideTooltip();

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
    result.draftStartDate !== taskStartDate.value ||
    result.draftEndDate !== taskEndDate.value;

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

onUnmounted(() => {
  cancelActiveInteraction();
  hideTooltip();
});
</script>

<style scoped>
.gantt-bar-container {
  position: absolute;
  top: 8px;
  bottom: 8px;
  cursor: grab;
  z-index: 10;
  will-change: left, width;
  transition: left 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.gantt-bar-container.is-dragging {
  cursor: grabbing;
  z-index: 20;
  transition: none !important;
}
.gantt-bar-container.is-resizing {
  z-index: 20;
  transition: none !important;
}
.gantt-bar-container.is-expanding {
  transition: none !important;
}
.gantt-bar {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border-radius: 6px;
  color: white;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  box-shadow: 0 2px 4px -1px rgba(79, 70, 229, 0.3), 0 1px 2px -1px rgba(79, 70, 229, 0.2);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
}
.gantt-bar-progress {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px 0 0 6px;
  pointer-events: none;
}
.gantt-bar-label {
  padding: 0 12px;
  z-index: 1;
  text-overflow: ellipsis;
  overflow: hidden;
}
.gantt-bar-container:hover .gantt-bar {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4), 0 2px 4px -1px rgba(79, 70, 229, 0.3);
  filter: brightness(1.05);
}
.gantt-bar-container.is-dragging .gantt-bar {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.5), 0 4px 6px -2px rgba(79, 70, 229, 0.3);
  transform: scale(1.02);
  opacity: 0.9;
}
.gantt-bar-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  cursor: col-resize;
  z-index: 30;
}
.gantt-bar-handle.left {
  left: -5px;
}
.gantt-bar-handle.right {
  right: -5px;
}
</style>
