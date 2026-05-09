<template>
  <div class="gantt-timeline" :style="{ width: totalWidth + 'px' }">
    <div class="gantt-timeline-header" :style="{ height: headerHeight + 'px', width: totalWidth + 'px' }">
      <div 
        class="gantt-timeline-dates"
        :style="{ transform: `translateX(${offsetX}px)` }"
      >
        <div 
          v-for="date in visibleDates" 
          :key="date.getTime()"
          class="gantt-timeline-date"
          :class="{ 'is-weekend': isWeekend(date) && scale === 'day', 'is-today': isToday(date) && scale === 'day' }"
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
        />
      </svg>

      <div
        class="gantt-timeline-content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div 
          v-for="task in visibleTasks" 
          :key="task.id"
          class="gantt-timeline-row"
          :style="{ height: rowHeight + 'px' }"
        >
          <!-- 列的网格线 -->
          <div
            class="gantt-timeline-grid"
            :style="{ transform: `translateX(${offsetX}px)` }"
          >
            <div 
              v-for="date in visibleDates" 
              :key="date.getTime()"
              class="gantt-timeline-cell"
              :class="{
                'is-weekend': isWeekend(date) && scale === 'day',
                'is-today': isToday(date) && scale === 'day'
              }"
              :style="{ width: columnWidth + 'px' }"
            ></div>
          </div>
          <!-- 任务条占位符 -->
          <GanttBar :task="task">
            <template #bar="slotProps">
              <slot name="bar" v-bind="slotProps"></slot>
            </template>
          </GanttBar>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useGanttStore } from '../composables/useGanttStore';
import { useGanttEventBus } from '../composables/useGanttPlugin';
import GanttBar from './GanttBar.vue';
import { parseLocalDate, diffDays } from '../utils/date';
import type { GanttTaskPreview } from '../types/gantt';

const store = useGanttStore();
const eventBus = useGanttEventBus();

const { 
  visibleTasks, 
  rowHeight, 
  totalHeight, 
  offsetY, 
  visibleDates, 
  offsetX, 
  columnWidth, 
  totalWidth,
  startDate,
  scale
} = store;

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
const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const isToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const getWeekNumber = (date: Date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

// 计算依赖连线的坐标
const dependencyLinks = computed(() => {
  const links: any[] = [];
  const taskMap = new Map();
  
  // 为所有可见任务创建一个坐标映射（在树中展开的，不仅限于当前视口）
  const allTasks = store.allVisibleTasks.value;
  allTasks.forEach((task, index) => {
    const startD = parseLocalDate(task.startDate);
    const endD = parseLocalDate(task.endDate);
    const baseD = startDate.value;
    const preview = taskPreviewMap.value.get(task.id);
    
    let dDays = diffDays(baseD, startD);
    const wDays = diffDays(startD, endD) + 1;

    let x = dDays * columnWidth.value;
    let width = wDays * columnWidth.value;

    if (scale.value === 'week') {
      x = (dDays / 7) * columnWidth.value;
      width = (wDays / 7) * columnWidth.value;
    } else if (scale.value === 'month') {
      x = (dDays / 30) * columnWidth.value;
      width = (wDays / 30) * columnWidth.value;
    }

    if (preview) {
      x = preview.draftLeftPx;
      width = preview.draftWidthPx;
    }
    
    // Y 轴的坐标计算必须和 DOM 实际位置保持一致。
    // 在这里我们加上了 8（任务条的上边距），并将高度视为 (rowHeight - 16)
    const y = index * rowHeight.value + 8;
    const h = rowHeight.value - 16;
    
    taskMap.set(task.id, { x, y, width, height: h });
  });

  allTasks.forEach(task => {
    if (task.dependencies && task.dependencies.length > 0) {
      task.dependencies.forEach((depId: string | number) => {
        const fromNode = taskMap.get(depId);
        const toNode = taskMap.get(task.id);
        
        if (fromNode && toNode) {
          // Finish-to-Start 连线 (从右侧边缘到左侧边缘)
          const startX = fromNode.x + fromNode.width;
          const startY = fromNode.y + fromNode.height / 2;
          
          const endX = toNode.x;
          const endY = toNode.y + toNode.height / 2;
          
          const diffX = endX - startX;
          
          // 绘制平滑的贝塞尔曲线
          let path = '';
          if (diffX > 20) {
            // 简单的平滑曲线
            path = `M ${startX},${startY} C ${startX + diffX / 2},${startY} ${endX - diffX / 2},${endY} ${endX},${endY}`;
          } else {
            // 如果目标节点在源节点之前或太近，绘制复杂的绕行曲线
            path = `M ${startX},${startY} L ${startX + 10},${startY} C ${startX + 20},${startY} ${startX + 20},${startY + 15} ${startX + 10},${startY + 15} L ${endX - 10},${startY + 15} C ${endX - 20},${startY + 15} ${endX - 20},${endY} ${endX - 10},${endY} L ${endX},${endY}`;
          }
          
          // 结尾的箭头多边形
          const arrow = `${endX},${endY} ${endX - 6},${endY - 4} ${endX - 6},${endY + 4}`;
          
          links.push({
            id: `${depId}-${task.id}`,
            path,
            arrow
          });
        }
      });
    }
  });
  
  return links;
});
</script>

<style scoped>
.gantt-timeline {
  min-width: 100%;
}
.gantt-timeline-header {
  border-bottom: 1px solid #e5e7eb;
  background-color: #f9fafb;
  position: sticky;
  top: 0;
  z-index: 10;
  overflow: hidden;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
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
  border-right: 1px solid #e5e7eb;
  box-sizing: border-box;
}
.gantt-timeline-date.is-weekend {
  background-color: #f3f4f6;
}
.gantt-timeline-date.is-today {
  color: #4f46e5;
  font-weight: 700;
}
.date-day {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.gantt-timeline-date.is-today .date-day {
  color: #4f46e5;
}
.date-month {
  font-size: 10px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.gantt-timeline-date.is-today .date-month {
  color: #818cf8;
}

.gantt-timeline-body {
  width: 100%;
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
  transition: stroke 0.2s ease, d 0.2s ease;
}
.gantt-timeline-svg.is-expanding .gantt-link-path {
  transition: none !important;
}
.gantt-timeline-row {
  border-bottom: 1px solid #f3f4f6;
  position: relative;
  box-sizing: border-box;
  display: flex;
  transition: background-color 0.15s ease;
}
.gantt-timeline-row:hover {
  background-color: #f8fafc;
}
.gantt-timeline-grid {
  display: flex;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  pointer-events: none; /* 让点击事件穿透到 GanttBar */
}
.gantt-timeline-cell {
  height: 100%;
  border-right: 1px solid #f3f4f6;
  box-sizing: border-box;
}
.gantt-timeline-cell.is-weekend {
  background-color: rgba(243, 244, 246, 0.5); /* 柔和的周末背景 */
}
.gantt-timeline-cell.is-today {
  background-color: rgba(224, 231, 255, 0.3); /* 今日的柔和靛蓝高亮 */
}
</style>
