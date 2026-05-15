<template>
  <div
    ref="containerRef"
    :class="[
      {
        'is-dragging': isDragging,
        'is-resizing': isResizing,
        'is-expanding': store.isTimelineExpanding.value,
        'is-readonly': isCurrentTaskReadOnly,
        'is-milestone-container': isMilestone,
        'is-selected': store.selectedTaskIds.value.includes(task.id),
        'has-conflict-error': conflictSeverity === 'error',
        'has-conflict-warning': conflictSeverity === 'warning',
        'has-diff': isScenarioDiff,
        'has-validation-error': draft.hasValidationError.value,
        'has-validation-warning': draft.hasValidationWarning.value
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
    class="gantt-bar-container"
    @pointerdown.stop.prevent="onPointerDown"
    @lostpointercapture="onPointerCaptureLost"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @click.stop="onBarClick"
    @contextmenu.prevent.stop="onContextMenu"
  >
    <slot :is-dragging="isDragging" :is-resizing="isResizing" :task="task" name="bar">
      <div :class="{ 'is-milestone': isMilestone }" :style="barInlineStyle" class="gantt-bar">
        <div
          v-if="task.progress !== undefined"
          :style="{ width: `${task.progress}%` }"
          class="gantt-bar-progress"
        >
          <div class="progress-shine" />
        </div>
        <span class="gantt-bar-label">{{ task.name }}</span>
      </div>
    </slot>
    <div
      v-if="!isCurrentTaskReadOnly && !isMilestone"
      class="gantt-bar-handle left"
      @pointerdown.stop.prevent="onResizeStart($event, 'left')"
    >
      <div class="handle-inner" />
    </div>
    <div
      v-if="!isCurrentTaskReadOnly && !isMilestone"
      class="gantt-bar-handle right"
      @pointerdown.stop.prevent="onResizeStart($event, 'right')"
    >
      <div class="handle-inner" />
    </div>
    <TaskContextMenu
      :visible="contextMenu.visible"
      :menu-x="contextMenu.x"
      :menu-y="contextMenu.y"
      :task="props.task"
      :dependency-menu-items="depMenuItems"
      @lock="handleLock"
      @dep-action="handleDepAction"
      @switch-scenario="handleSwitchScenario"
      @copy="handleCopy"
      @close="contextMenu.visible = false"
    />
    <div v-if="draft.hasValidationError.value && isDragging" class="gantt-bar-validation">
      <div v-for="(err, i) in draft.validationErrors.value.filter(e => e.severity === 'error')" :key="i" class="validation-item">
        ⚠ {{ err.message }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, reactive } from 'vue'
import type {
  FlatGanttTask,
  GanttBarClassFn,
  GanttBarStyleFn,
  GanttPreviewMode
} from '../types/gantt'
import TaskContextMenu from './TaskContextMenu.vue'
import { useGanttStore } from '../composables/useGanttStore'
import { useGanttEventBus } from '../composables/useGanttPlugin'
import { useGanttBarMetrics } from '../composables/useGanttBarMetrics'
import { useGanttBarDraft } from '../composables/useGanttBarDraft'
import { useGanttTimelineExpansion } from '../composables/useGanttTimelineExpansion'
import { getCanvasX } from '../composables/useGanttCanvasPointer'
import { parseLocalDate } from '../utils/date';

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
  onValidate: (startDate: string, endDate: string) => {
    const items: { severity: 'error' | 'warning'; message: string }[] = [];
    const sDate = parseLocalDate(startDate);
    const eDate = parseLocalDate(endDate);
    if (store.isNonWorkingDay(sDate)) {
      items.push({
        severity: 'error',
        message: '开始日期为非工作日'
      });
    }
    if (store.isNonWorkingDay(eDate)) {
      items.push({
        severity: 'error',
        message: '结束日期为非工作日'
      });
    }
    return items;
  }
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
const isCurrentTaskReadOnly = computed(() => store.isTaskReadOnly(props.task))

// ========== Bar style & interaction state ==========
const barInlineStyle = computed(() => {
  const style = store.statusStyleMap.value[String(props.task.status || '')] || {}
  return {
    background: style.barColor || undefined,
    color: style.textColor || undefined
  }
})

let isFinishingInteraction = false
let previousBodyUserSelect = ''
let previousBodyWebkitUserSelect = ''

const lockDocumentSelection = () => {
  previousBodyUserSelect = document.body.style.userSelect
  previousBodyWebkitUserSelect = document.body.style.webkitUserSelect
  document.body.style.userSelect = 'none'
  document.body.style.webkitUserSelect = 'none'
}

const unlockDocumentSelection = () => {
  document.body.style.userSelect = previousBodyUserSelect
  document.body.style.webkitUserSelect = previousBodyWebkitUserSelect
}

const restoreTransition = (includeWidth: boolean) => {
  if (!containerRef.value) return
  containerRef.value.style.transition = includeWidth
    ? 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    : 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
}

const removeDragListeners = () => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

const removeResizeListeners = () => {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeEnd)
  window.removeEventListener('pointercancel', onPointerCancel)
}

const cancelActiveInteraction = () => {
  if (!draft.isActive.value) return
  removeDragListeners()
  removeResizeListeners()
  stopAutoScroll()
  unlockDocumentSelection()
  draft.cancel()
  eventBus.emit('onTaskPreviewEnd', { taskId: props.task.id })
  restoreTransition(true)
}

const updateDraftPreview = (mode: GanttPreviewMode) => {
  eventBus.emit('onTaskPreviewChange', {
    taskId: props.task.id,
    mode,
    draftLeftPx: draft.draftLeftPx.value,
    draftWidthPx: draft.draftWidthPx.value,
    draftStartDate: draft.draftStartDate.value,
    draftEndDate: draft.draftEndDate.value
  })
}

const updatePreviewFromViewport = (clientX: number, timelineShiftPx = 0) => {
  if (!containerRef.value) return
  const ganttRightEl = containerRef.value.closest('.gantt-right')
  if (!(ganttRightEl instanceof HTMLElement) || !draft.mode.value || draft.mode.value === 'idle') return
  draft.applyTimelineShift(timelineShiftPx)
  const canvasX = getCanvasX(clientX, ganttRightEl)
  draft.updateFromCanvas(clientX, canvasX)
  updateDraftPreview(draft.mode.value)
}

// ========== Resize handlers ==========
const onResizeStart = (e: PointerEvent, side: 'left' | 'right') => {
  if (isCurrentTaskReadOnly.value || isMilestone.value) return
  if (e.button !== 0) return
  if (!containerRef.value) return
  e.preventDefault()
  hideTooltip()
  lockDocumentSelection()
  const ganttRightEl = containerRef.value.closest('.gantt-right')
  if (!(ganttRightEl instanceof HTMLElement)) return
  draft.startResize(side, e.clientX, getCanvasX(e.clientX, ganttRightEl))
  if (containerRef.value) {
    containerRef.value.setPointerCapture(e.pointerId)
    containerRef.value.style.transition = 'none'
  }
  window.addEventListener('pointermove', onResizeMove, { passive: true })
  window.addEventListener('pointerup', onResizeEnd)
  window.addEventListener('pointercancel', onPointerCancel)
}

const onResizeMove = (e: PointerEvent) => {
  if (!draft.isResizing.value || !containerRef.value) return
  updatePreviewFromViewport(e.clientX)
  const ganttRightEl = containerRef.value.closest('.gantt-right')
  if (ganttRightEl instanceof HTMLElement) {
    syncPointer({ container: ganttRightEl, clientX: e.clientX, onViewportChange: updatePreviewFromViewport })
  }
}

const onResizeEnd = (e: PointerEvent) => {
  if (!draft.isResizing.value) return
  isFinishingInteraction = true
  removeResizeListeners()
  stopAutoScroll()
  unlockDocumentSelection()
  if (containerRef.value) containerRef.value.releasePointerCapture(e.pointerId)
  const result = draft.finish()
  eventBus.emit('onTaskPreviewEnd', { taskId: props.task.id })
  restoreTransition(true)
  if (result.maxPointerDeltaPx < 3) { isFinishingInteraction = false; return }
  const changed = result.draftStartDate !== taskStartDate.value || result.draftEndDate !== taskEndDate.value
  if (changed) {
    updateTaskDates(props.task.id, result.draftStartDate, result.draftEndDate)
    eventBus.emit('onTaskDrop', { task: props.task, newStartDate: result.draftStartDate, newEndDate: result.draftEndDate })
  } else { restoreTransition(true) }
  isFinishingInteraction = false
}

// ========== Drag handlers ==========
const onPointerDown = (e: PointerEvent) => {
  if (isCurrentTaskReadOnly.value || isMilestone.value) return
  if (e.button !== 0) return
  if (!containerRef.value) return
  e.preventDefault()
  hideTooltip()
  lockDocumentSelection()
  const ganttRightEl = containerRef.value.closest('.gantt-right')
  if (!(ganttRightEl instanceof HTMLElement)) return
  draft.startDrag(e.clientX, getCanvasX(e.clientX, ganttRightEl))
  if (containerRef.value) {
    containerRef.value.setPointerCapture(e.pointerId)
    containerRef.value.style.transition = 'none'
  }
  eventBus.emit('onTaskDragStart', { task: props.task, event: e })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

const onPointerMove = (e: PointerEvent) => {
  if (!draft.isDragging.value || !containerRef.value) return
  updatePreviewFromViewport(e.clientX)
  const ganttRightEl = containerRef.value.closest('.gantt-right')
  if (ganttRightEl instanceof HTMLElement) {
    syncPointer({ container: ganttRightEl, clientX: e.clientX, onViewportChange: updatePreviewFromViewport })
  }
}

const onPointerUp = (e: PointerEvent) => {
  if (!draft.isDragging.value) return
  isFinishingInteraction = true
  removeDragListeners()
  stopAutoScroll()
  unlockDocumentSelection()
  if (containerRef.value) containerRef.value.releasePointerCapture(e.pointerId)
  const result = draft.finish()
  eventBus.emit('onTaskPreviewEnd', { taskId: props.task.id })
  restoreTransition(false)
  const isClick = result.maxPointerDeltaPx < 3
  if (isClick) {
    eventBus.emit('onTaskClick', { task: props.task, event: e as unknown as MouseEvent })
    isFinishingInteraction = false
    return
  }
  const changed = result.draftStartDate !== taskStartDate.value || result.draftEndDate !== taskEndDate.value
  if (changed) {
    updateTaskDates(props.task.id, result.draftStartDate, result.draftEndDate)
    eventBus.emit('onTaskDrop', { task: props.task, newStartDate: result.draftStartDate, newEndDate: result.draftEndDate })
  } else { restoreTransition(false) }
  isFinishingInteraction = false
}

const onPointerCancel = () => { cancelActiveInteraction() }

const onPointerCaptureLost = () => {
  if (isFinishingInteraction) return
  cancelActiveInteraction()
}

const onMouseEnter = (e: MouseEvent) => {
  if (isDragging.value || isResizing.value) return
  showTooltip(props.task, e)
}

const onMouseMove = (e: MouseEvent) => {
  if (isDragging.value || isResizing.value) { hideTooltip(); return }
  updateTooltipPosition(e)
}

const onMouseLeave = () => { hideTooltip() }

const onBarClick = (e: MouseEvent) => {
  if (e.shiftKey) {
    if (store.linkingSourceTaskId.value === null) {
      store.beginDependencyLink(props.task.id)
      return
    }
    const sourceId = store.linkingSourceTaskId.value
    if (e.ctrlKey || e.metaKey) {
      store.removeDependency(sourceId, props.task.id)
      store.linkingSourceTaskId.value = null
      return
    }
    const deps = props.task.dependencies ?? []
    if (deps.includes(sourceId)) {
      const types: Array<'FS' | 'SS' | 'FF' | 'SF'> = ['FS', 'SS', 'FF', 'SF']
      const current = props.task.dependencyTypes?.[sourceId] ?? 'FS'
      const nextIndex = (types.indexOf(current) + 1) % types.length
      store.changeDependencyType(sourceId, props.task.id, types[nextIndex])
      store.linkingSourceTaskId.value = null
      return
    }
    store.completeDependencyLink(props.task.id)
    return
  }
  store.selectTask(props.task.id, { append: e.ctrlKey || e.metaKey, toggle: e.ctrlKey || e.metaKey })
}

// ========== Conflict & diff ==========
const conflictSeverity = computed(() => {
  const items = store.getTaskConflicts(props.task.id)
  if (items.length === 0) return null
  return items.some(i => i.severity === 'error') ? 'error' : 'warning'
})
const isScenarioDiff = computed(() => store.scenarioDiff.value?.has(props.task.id) ?? false)

// Context menu state
const contextMenu = reactive({ visible: false, x: 0, y: 0 })

const depMenuItems = computed(() => {
  const items: Array<{ id: string; label: string; icon: string; sourceId: string | number; action: string }> = []
  const task = props.task
  if (!task.dependencies?.length) return items
  for (const depId of task.dependencies) {
    const depType = task.dependencyTypes?.[depId] ?? 'FS'
    const lag = task.dependencyLags?.[depId] ?? 0
    const nextTypes: Record<string, string> = { FS: 'SS', SS: 'FF', FF: 'SF', SF: 'FS' }
    items.push({
      id: `type-${depId}`,
      label: `依赖 ${depId}: ${depType}${lag !== 0 ? ` (lag:${lag > 0 ? '+' : ''}${lag}d)` : ''} → ${nextTypes[depType]}`,
      icon: '🔄',
      sourceId: depId,
      action: 'cycleType'
    })
    items.push({
      id: `lag-${depId}`,
      label: `Lag ${depId}: 设为${lag === 1 ? 0 : 1}d`,
      icon: '⏱️',
      sourceId: depId,
      action: 'toggleLag'
    })
    items.push({
      id: `remove-${depId}`,
      label: `删除依赖 ${depId}`,
      icon: '🗑️',
      sourceId: depId,
      action: 'remove'
    })
  }
  return items
})

const onContextMenu = (e: MouseEvent) => {
  contextMenu.x = e.clientX
  contextMenu.y = e.clientY
  contextMenu.visible = true
}

const handleLock = () => {
  props.task.readOnly = !props.task.readOnly
  contextMenu.visible = false
}

const handleDepAction = (item: { id: string; label: string; icon: string; sourceId: string | number; action: string }) => {
  switch (item.action) {
    case 'cycleType': {
      const types: Array<'FS' | 'SS' | 'FF' | 'SF'> = ['FS', 'SS', 'FF', 'SF']
      const current = props.task.dependencyTypes?.[item.sourceId] ?? 'FS'
      const nextIndex = (types.indexOf(current) + 1) % types.length
      store.changeDependencyType(item.sourceId, props.task.id, types[nextIndex])
      break
    }
    case 'toggleLag': {
      const currentLag = props.task.dependencyLags?.[item.sourceId] ?? 0
      store.setDependencyLag(item.sourceId, props.task.id, currentLag === 1 ? 0 : 1)
      break
    }
    case 'remove':
      store.removeDependency(item.sourceId, props.task.id)
      break
  }
  contextMenu.visible = false
}

const handleSwitchScenario = (scenarioId: string) => {
  store.switchScenario(scenarioId)
  contextMenu.visible = false
}

const handleCopy = () => {
  const info = `${props.task.name} | ${props.task.startDate} → ${props.task.endDate} | 进度: ${props.task.progress ?? 0}%`
  navigator.clipboard.writeText(info).catch(() => {})
  contextMenu.visible = false
}

function closeContextMenu() {
  contextMenu.visible = false
}

onMounted(() => {
  window.addEventListener('mousedown', closeContextMenu)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', closeContextMenu)
  hideTooltip()
})
</script>

<style scoped>
.gantt-bar-container {
  position: absolute;
  z-index: 10;
  top: 6px;
  bottom: 6px;
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s ease;
  will-change: left, width;
}

.gantt-bar-container.is-selected {
  z-index: 15;
}

.gantt-bar-container.is-selected .gantt-bar {
  transform: translateY(-1px);
  border: 1.5px solid white;
  box-shadow: 0 0 0 2px #4f46e5, 0 4px 10px rgba(79, 70, 229, 0.4);
}

.gantt-bar-container.is-dragging {
  z-index: 100;
  cursor: grabbing;
  transition: opacity 0.2s ease !important;
}

.gantt-bar {
  font-size: 12px;
  font-weight: 600;
  position: relative;
  display: flex;
  overflow: hidden;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  letter-spacing: 0.01em;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
}

.gantt-bar.is-milestone {
  justify-content: center;
  width: 16px !important;
  min-width: 16px !important;
  height: 16px !important;
  margin-top: 4px;
  transform: rotate(45deg);
  border-radius: 4px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);
}

.gantt-bar-progress {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: 7px 0 0 7px;
  background: rgba(0, 0, 0, 0.15);
}

.progress-shine {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  animation: shine 3s infinite linear;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
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
  z-index: 1;
  overflow: hidden;
  padding: 0 10px;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.gantt-bar-container:hover .gantt-bar {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(79, 70, 229, 0.3);
  filter: brightness(1.1);
}

.gantt-bar-handle {
  position: absolute;
  z-index: 30;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  cursor: col-resize;
  transition: opacity 0.2s;
  opacity: 0;
}

.gantt-bar-container:hover .gantt-bar-handle {
  opacity: 1;
}

.handle-inner {
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.5);
}

.gantt-bar-handle.left {
  left: -6px;
}
.gantt-bar-handle.right {
  right: -6px;
}

.gantt-bar-container.is-dragging .gantt-bar {
  transform: scale(1.02) translateY(-2px);
  opacity: 0.85;
  box-shadow: 0 8px 16px rgba(79, 70, 229, 0.4);
}

/* Conflict styling */
.gantt-bar-container.has-conflict-error .gantt-bar {
  animation: conflict-pulse 2s ease-in-out infinite;
  border-color: #fca5a5 !important;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
  box-shadow: 0 0 0 2px #ef4444, 0 4px 10px rgba(239, 68, 68, 0.4) !important;
}

.gantt-bar-container.has-conflict-warning .gantt-bar {
  border-color: #fcd34d !important;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
  box-shadow: 0 0 0 2px #f59e0b, 0 4px 10px rgba(245, 158, 11, 0.3) !important;
}

@keyframes conflict-pulse {
  0%, 100% { box-shadow: 0 0 0 2px #ef4444, 0 4px 10px rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 4px #fca5a5, 0 6px 16px rgba(239, 68, 68, 0.6); }
}

.gantt-bar-container.has-diff .gantt-bar {
  border-style: dashed !important;
  border-width: 2px !important;
  border-color: #6366f1 !important;
}

.gantt-bar-container.has-diff .gantt-bar::after {
  content: 'Δ';
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  color: #6366f1;
  font-weight: 700;
  opacity: 0.8;
}

/* Drag validation feedback */
.gantt-bar-container.has-validation-error .gantt-bar {
  box-shadow: 0 0 0 2px #ef4444, 0 4px 12px rgba(239, 68, 68, 0.5) !important;
  animation: validation-shake 0.4s ease-in-out;
}

.gantt-bar-container.has-validation-warning .gantt-bar {
  box-shadow: 0 0 0 2px #f59e0b, 0 4px 12px rgba(245, 158, 11, 0.4) !important;
}

.gantt-bar-validation {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: #dc2626;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.gantt-bar-validation::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #dc2626;
}

@keyframes validation-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  50% { transform: translateX(3px); }
  75% { transform: translateX(-2px); }
}
</style>
