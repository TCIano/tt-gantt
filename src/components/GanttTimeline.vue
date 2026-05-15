<template>
  <div class="gantt-timeline" :style="{ width: totalWidth + 'px' }">
    <div
      class="gantt-timeline-header"
      :style="{ height: headerHeight + 'px', width: totalWidth + 'px' }"
    >
      <slot
        name="timeline-header"
        :visible-dates="visibleDates"
        :column-width="columnWidth"
        :scale="scale"
      >
        <div class="gantt-timeline-dates" :style="{ transform: `translateX(${offsetX}px)` }">
          <div
            v-for="date in visibleDates"
            :key="date.getTime()"
            class="gantt-timeline-date"
            :class="{
              'is-weekend': isNonWorkingDay(date) && !isHoliday(date),
              'is-holiday': isHoliday(date),
              'is-today': isToday(date) && scale === 'day'
            }"
            :style="{ width: columnWidth + 'px' }"
          >
            <template v-if="scale === 'day'">
              <span class="date-day">{{ date.getDate() }}</span>
              <span class="date-month">{{ monthNames[date.getMonth()] }}</span>
            </template>
            <template v-else-if="scale === 'week'">
              <span class="date-day">W{{ getWeekNumber(date) }}</span>
              <span class="date-month">{{ monthNames[date.getMonth()] }}</span>
            </template>
            <template v-else-if="scale === 'month'">
              <span class="date-day">{{ monthNames[date.getMonth()] }}</span>
              <span class="date-month">{{ date.getFullYear() }}</span>
            </template>
          </div>
        </div>
      </slot>
    </div>
    <div class="gantt-timeline-body" :style="{ height: totalHeight + 'px', position: 'relative' }">
      <!-- SVG 依赖连线图层 -->
      <svg
        class="gantt-timeline-svg"
        :class="{ 'is-expanding': store.isTimelineExpanding.value }"
        :style="{ width: totalWidth + 'px', height: totalHeight + 'px' }"
      >
        <path
          v-for="link in dependencyLinks"
          :key="link.id"
          :d="link.path"
          class="gantt-link-path"
          fill="none"
          stroke="#9ca3af"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <polygon
          v-for="link in dependencyLinks"
          :key="'arrow-' + link.id"
          :points="link.arrow"
          fill="#9ca3af"
          @click.stop="handleDependencyClick(link)"
        />
      </svg>

      <div v-if="showTodayLine" class="today-line" :style="{ left: `${todayLineX}px` }" />

      <div class="gantt-timeline-content" :style="{ transform: `translateY(${offsetY}px)` }">
        <!-- Resource mode: resource rows with floating task bars -->
        <template v-if="isResourceMode">
          <div
            v-for="res in visibleResourceRows"
            :key="res.id"
            class="gantt-timeline-row"
            :class="{ 'has-resource-conflict': getResourceConflictCount(res.id) > 0 }"
            :style="{ height: rowHeight + 'px' }"
          >
            <div class="gantt-timeline-grid" :style="{ transform: `translateX(${offsetX}px)` }">
              <div
                v-for="date in visibleDates"
                :key="date.getTime()"
                class="gantt-timeline-cell"
                :class="{
                  'is-weekend': isNonWorkingDay(date) && !isHoliday(date),
                  'is-holiday': isHoliday(date),
                  'is-today': isToday(date) && scale === 'day'
                }"
                :style="{ width: columnWidth + 'px' }"
              />
            </div>
            <div v-if="getResourceConflictCount(res.id) > 0" class="resource-conflict-badge">
              ⚠ {{ getResourceConflictCount(res.id) }}
            </div>
            <template v-for="task in getTasksForResource(res.id)" :key="task.id">
              <div
                v-if="showBaseline && task.baselineStartDate && task.baselineEndDate"
                class="gantt-baseline"
                :style="getBaselineStyle(task)"
              />
              <GanttBar :task="task" :custom-class="props.barClass" :custom-style="props.barStyle">
                <template #bar="slotProps">
                  <slot name="bar" v-bind="slotProps" />
                </template>
              </GanttBar>
            </template>
            <div class="resource-name-label">{{ res.name }}</div>
            <div
              v-if="getResourceLoad(res.id)"
              class="resource-load-bar"
              :class="getLoadClass(res.id)"
              :style="{ width: getLoadWidth(res.id) }"
              :title="getLoadTitle(res.id)"
            />
          </div>
        </template>

        <!-- Task mode (original) -->
        <template v-else>
        <div
          v-for="task in visibleTasks"
          :key="task.id"
          class="gantt-timeline-row"
          :class="props.rowClass ? props.rowClass(task) : ''"
          :style="[{ height: rowHeight + 'px' }, props.rowStyle ? props.rowStyle(task) : {}]"
        >
          <div class="gantt-timeline-grid" :style="{ transform: `translateX(${offsetX}px)` }">
              <div
                v-for="date in visibleDates"
                :key="date.getTime()"
                class="gantt-timeline-cell"
                :class="{
                  'is-weekend': isNonWorkingDay(date) && !isHoliday(date),
                  'is-holiday': isHoliday(date),
                  'is-today': isToday(date) && scale === 'day'
                }"
                :style="{ width: columnWidth + 'px' }"
              />
            </div>
            <div
              v-if="showBaseline && task.baselineStartDate && task.baselineEndDate"
              class="gantt-baseline"
              :style="getBaselineStyle(task)"
            />
            <GanttBar :task="task" :custom-class="props.barClass" :custom-style="props.barStyle">
            <template #bar="slotProps">
              <slot name="bar" v-bind="slotProps" />
            </template>
          </GanttBar>
        </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useGanttStore } from '../composables/useGanttStore';
import { useGanttEventBus } from '../composables/useGanttPlugin';
import GanttBar from './GanttBar.vue';
import { parseLocalDate } from '../utils/date';
import { buildDependencyPaths } from '../core/buildDependencyPaths';
import type {
  GanttTaskPreview,
  FlatGanttTask,
  GanttBarClassFn,
  GanttBarStyleFn,
  GanttRowClassFn,
  GanttRowStyleFn
} from '../types/gantt';

const props = defineProps<{
  barClass?: GanttBarClassFn;
  barStyle?: GanttBarStyleFn;
  rowClass?: GanttRowClassFn;
  rowStyle?: GanttRowStyleFn;
}>();

const store = useGanttStore()
const eventBus = useGanttEventBus()

const {
  visibleTasks,
  visibleResourceRows,
  isResourceMode,
  allVisibleTasks,
  rowHeight,
  totalHeight,
  offsetY,
  visibleDates,
  offsetX,
  columnWidth,
  totalWidth,
  startDate,
  scale,
  today,
  showTodayLine,
  showBaseline,
  getVisibleDayIndex,
  getVisibleDaysCount,
  getTaskConflicts,
  resourceLoadMap,
  holidays
} = store

const getResourceLoad = (resourceId: string) => {
  return resourceLoadMap.value.get(resourceId) ?? null
}

const getLoadWidth = (resourceId: string) => {
  const load = resourceLoadMap.value.get(resourceId)
  if (!load) return '0%'
  return `${Math.min(100, load.utilPercent)}%`
}

const getLoadClass = (resourceId: string) => {
  const load = resourceLoadMap.value.get(resourceId)
  if (!load) return ''
  if (load.utilization > 0.9) return 'is-overloaded'
  if (load.utilization > 0.7) return 'is-warning'
  return 'is-normal'
}

const getLoadTitle = (resourceId: string) => {
  const load = resourceLoadMap.value.get(resourceId)
  if (!load) return ''
  return `负载: ${load.utilPercent}% | 任务数: ${load.taskCount} | 总工时: ${load.totalDays}天`
}

const getResourceConflictCount = (resourceId: string) => {
  let count = 0
  for (const task of allVisibleTasks.value) {
    if (task.resourceId != null && String(task.resourceId) === resourceId) {
      const items = getTaskConflicts(task.id)
      if (items.length > 0) count++
    }
  }
  return count
}

const getTasksForResource = (resourceId: string) => {
  return allVisibleTasks.value.filter(
    t => t.resourceId != null && String(t.resourceId) === resourceId
  )
}

const taskPreviewMap = ref(new Map<string | number, GanttTaskPreview>());

const handleTaskPreviewChange = (payload: GanttTaskPreview) => {
  const next = new Map(taskPreviewMap.value);
  next.set(payload.taskId, payload);
  taskPreviewMap.value = next;
};

const handleTaskPreviewEnd = (payload: { taskId: string | number }) => {
  const next = new Map(taskPreviewMap.value);
  next.delete(payload.taskId);
  taskPreviewMap.value = next;
};

onMounted(() => {
  eventBus.on('onTaskPreviewChange', handleTaskPreviewChange);
  eventBus.on('onTaskPreviewEnd', handleTaskPreviewEnd);
});

onUnmounted(() => {
  eventBus.off('onTaskPreviewChange', handleTaskPreviewChange);
  eventBus.off('onTaskPreviewEnd', handleTaskPreviewEnd);
});

const headerHeight = 48; // 更新表头高度以改善设计
const monthNames = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月'
];

const isNonWorkingDay = (date: Date) => store.isNonWorkingDay(date);
const isHoliday = (date: Date) => holidays.value.includes(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);

const isToday = (date: Date) => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

const getWeekNumber = (date: Date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const toTimelineX = (_baseD: Date, targetD: Date) => {
  return getVisibleDayIndex(targetD) * columnWidth.value;
};

const getSpanWidth = (start: Date, end: Date) => {
  if (scale.value === 'week' || scale.value === 'month') {
    return (getVisibleDayIndex(end) - getVisibleDayIndex(start) + 1) * columnWidth.value;
  }
  return getVisibleDaysCount(start, end) * columnWidth.value;
};

const getBaselineStyle = (task: FlatGanttTask) => {
  const s = parseLocalDate(task.baselineStartDate);
  const e = parseLocalDate(task.baselineEndDate);
  return {
    left: `${toTimelineX(startDate.value, s)}px`,
    width: `${getSpanWidth(s, e)}px`
  };
};

const todayLineX = computed(() => toTimelineX(startDate.value, today.value));

const handleDependencyClick = (link: {
  sourceId: string | number;
  targetId: string | number;
  id: string;
}) => {
  eventBus.emit('onDependencyClick', link);
};

// 计算依赖连线的坐标
const dependencyLinks = computed(() => {
  const taskPositions = new Map<string | number, { x: number; y: number; width: number; height: number }>();
  const allTasks = store.allVisibleTasks.value;

  allTasks.forEach((task, index) => {
    const startD = parseLocalDate(task.startDate);
    const endD = parseLocalDate(task.endDate);
    const preview = taskPreviewMap.value.get(task.id);

    let x = toTimelineX(startDate.value, startD);
    let width = getSpanWidth(startD, endD);

    if (preview) {
      x = preview.draftLeftPx;
      width = preview.draftWidthPx;
    }

    const y = index * rowHeight.value + 8;
    const h = rowHeight.value - 16;

    taskPositions.set(task.id, { x, y, width, height: h });
  });

  const deps: { sourceId: string | number; targetId: string | number; type: 'FS' | 'SS' | 'FF' | 'SF'; lag: number }[] = [];

  allTasks.forEach((task) => {
    if (!task.dependencies) return;
    task.dependencies.forEach((depId: string | number) => {
      if (!taskPositions.has(depId)) return;
      deps.push({
        sourceId: depId,
        targetId: task.id,
        type: task.dependencyTypes?.[depId] ?? 'FS',
        lag: task.dependencyLags?.[depId] ?? 0
      });
    });
  });

  return buildDependencyPaths(taskPositions, deps, columnWidth.value);
});
</script>

<style scoped>
.gantt-timeline {
  min-width: 100%;
  background: var(--gantt-bg-color, white);
}
.gantt-timeline-header {
  border-bottom: 1px solid var(--gantt-header-border, #e5e7eb);
  background-color: var(--gantt-header-bg, #f9fafb);
  position: sticky;
  top: 0;
  z-index: 10;
  overflow: hidden;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
}
.gantt-timeline-dates {
  display: flex;
  height: 100%;
}
.gantt-timeline-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--gantt-border-color, #f3f4f6);
  box-sizing: border-box;
}
.gantt-timeline-date.is-weekend {
  background-color: var(--gantt-weekend-bg, #f9fafb);
}
.gantt-timeline-date.is-today {
  color: var(--gantt-primary-color, #4f46e5);
  background: var(--gantt-row-selected-bg, #f5f7ff);
}
.date-day {
  font-size: 13px;
  font-weight: 700;
  color: var(--gantt-text-color, #374151);
}
.gantt-timeline-date.is-today .date-day {
  color: var(--gantt-primary-color, #4f46e5);
}
.date-month {
  font-size: 9px;
  font-weight: 700;
  color: var(--gantt-header-text-color, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 1px;
}
.gantt-timeline-date.is-today .date-month {
  color: var(--gantt-primary-color, #818cf8);
}

.gantt-timeline-body {
  width: 100%;
  background-image: linear-gradient(
    90deg,
    var(--gantt-grid-line-color, #f3f4f6) 1px,
    transparent 1px
  );
  background-size: v-bind('columnWidth + "px"') 100%;
}
.today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, var(--gantt-today-line-color, #ef4444), #f87171);
  z-index: 8;
  pointer-events: none;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}
.today-line::after {
  content: '今天';
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 800;
  color: white;
  background: var(--gantt-today-line-color, #ef4444);
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  white-space: nowrap;
}
.gantt-timeline-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
.gantt-timeline-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 5;
}
.gantt-link-path {
  stroke: #c7d2fe;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
}
.gantt-link-path:hover {
  stroke: var(--gantt-primary-color, #4f46e5);
  stroke-width: 2.5;
}
.gantt-timeline-svg polygon {
  fill: #c7d2fe;
  pointer-events: auto;
  cursor: pointer;
  transition: fill 0.2s;
}
.gantt-timeline-svg polygon:hover {
  fill: var(--gantt-primary-color, #4f46e5);
}
.gantt-timeline-svg.is-expanding .gantt-link-path {
  transition: none !important;
}
.gantt-timeline-row {
  border-bottom: 1px solid var(--gantt-border-color, #f3f4f6);
  position: relative;
  box-sizing: border-box;
  display: flex;
  transition: background-color 0.2s;
}
.gantt-baseline {
  position: absolute;
  height: 4px;
  top: 2px;
  border-radius: 2px;
  background-color: var(--gantt-header-border, #e5e7eb);
  pointer-events: none;
  z-index: 6;
}
.gantt-timeline-row:hover {
  background-color: var(--gantt-row-hover-bg, #f9fafb);
}
.gantt-timeline-grid {
  display: flex;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  pointer-events: none;
}
.gantt-timeline-cell {
  height: 100%;
  border-right: 1px solid var(--gantt-grid-line-color, #f3f4f6);
  box-sizing: border-box;
}
.gantt-timeline-cell.is-weekend {
  background-color: var(--gantt-weekend-bg, rgba(249, 250, 251, 0.8));
}
.gantt-timeline-cell.is-today {
  background-color: var(--gantt-row-selected-bg, rgba(245, 247, 255, 0.5));
}
.gantt-timeline-cell.is-holiday {
  background-color: rgba(254, 226, 226, 0.5);
}
.gantt-timeline-date.is-holiday {
  background-color: rgba(254, 202, 202, 0.4);
}

.resource-name-label {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #d1d5db;
  pointer-events: none;
  z-index: 1;
}

.resource-conflict-badge {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: 700;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  padding: 1px 6px;
  z-index: 20;
  pointer-events: none;
}

.gantt-timeline-row.has-resource-conflict {
  background-color: #fef2f2 !important;
}

.resource-load-bar {
  position: absolute;
  bottom: 2px;
  left: 2px;
  height: 4px;
  border-radius: 2px;
  opacity: 0.8;
  transition: width 0.3s ease;
  z-index: 22;
  pointer-events: none;
}

.resource-load-bar.is-normal {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.resource-load-bar.is-warning {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.resource-load-bar.is-overloaded {
  background: linear-gradient(90deg, #ef4444, #f87171);
  opacity: 1;
  animation: load-pulse 1.5s ease-in-out infinite;
}

@keyframes load-pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}
</style>
