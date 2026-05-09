<template>
  <div class="gantt-layout-wrapper">
    <div class="gantt-toolbar">
      <div class="gantt-scale-controls">
        <button 
          class="scale-btn" 
          :class="{ active: scale === 'day' }" 
          @click="scale = 'day'"
        >Day</button>
        <button 
          class="scale-btn" 
          :class="{ active: scale === 'week' }" 
          @click="scale = 'week'"
        >Week</button>
        <button 
          class="scale-btn" 
          :class="{ active: scale === 'month' }" 
          @click="scale = 'month'"
        >Month</button>
      </div>
    </div>
    <div class="gantt-layout">
      <div 
        class="gantt-left" 
        ref="leftRef" 
        @scroll="handleLeftScroll"
      >
        <GanttTable>
          <template v-for="(slot, name) in $slots" #[name]="slotProps" :key="name">
            <slot v-if="name.startsWith('cell-')" :name="name" v-bind="slotProps"></slot>
          </template>
        </GanttTable>
      </div>
      
      <div class="gantt-divider"></div>

      <div 
        class="gantt-right" 
        ref="rightRef" 
        @scroll="handleRightScroll"
      >
        <GanttTimeline>
          <template #bar="slotProps">
            <slot name="bar" v-bind="slotProps"></slot>
          </template>
        </GanttTimeline>
      </div>
    </div>
    <GanttTooltip>
      <template #tooltip="slotProps">
        <slot name="tooltip" v-bind="slotProps"></slot>
      </template>
    </GanttTooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, useSlots } from 'vue';
import GanttTable from './GanttTable.vue';
import GanttTimeline from './GanttTimeline.vue';
import GanttTooltip from './GanttTooltip.vue';
import { provideGanttStore } from '../composables/useGanttStore';
import { GanttEventBus, provideGanttEventBus } from '../composables/useGanttPlugin';
import { LoggerPlugin } from '../plugins/LoggerPlugin';
import type { GanttTask, GanttColumn } from '../types/gantt';

const props = defineProps<{
  tasks: GanttTask[];
  columns?: GanttColumn[];
}>();

const eventBus = provideGanttEventBus(new GanttEventBus());
LoggerPlugin.install(eventBus);
const store = provideGanttStore(eventBus);

// 将 props 同步到 store
watch(() => props.tasks, (newTasks) => {
  store.tasks.value = newTasks;
}, { immediate: true, deep: true });

watch(() => props.columns, (newCols) => {
  if (newCols) {
    store.columns.value = newCols;
  }
}, { immediate: true, deep: true });

const { scrollTop, scrollLeft, viewportHeight, viewportWidth, scale } = store;

const leftRef = ref<HTMLElement | null>(null);
const rightRef = ref<HTMLElement | null>(null);

let isSyncingLeft = false;
let isSyncingRight = false;

const handleLeftScroll = (e: Event) => {
  if (isSyncingLeft) {
    isSyncingLeft = false;
    return;
  }
  const target = e.target as HTMLElement;
  // Use absolute difference to prevent infinite loop of 1px float precision adjustments
  if (rightRef.value && Math.abs(rightRef.value.scrollTop - target.scrollTop) > 1) {
    isSyncingRight = true;
    rightRef.value.scrollTop = target.scrollTop;
  }
  // Delay self scrollTop update after syncing, avoid recursive trigger
  scrollTop.value = target.scrollTop;
};

const handleRightScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  scrollLeft.value = target.scrollLeft;
  
  if (isSyncingRight) {
    isSyncingRight = false;
    return;
  }
  if (leftRef.value && Math.abs(leftRef.value.scrollTop - target.scrollTop) > 1) {
    isSyncingLeft = true;
    leftRef.value.scrollTop = target.scrollTop;
  }
  scrollTop.value = target.scrollTop;
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (rightRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewportHeight.value = entry.contentRect.height;
        viewportWidth.value = entry.contentRect.width;
      }
    });
    resizeObserver.observe(rightRef.value);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>

<style scoped>
.gantt-layout-wrapper {
  /* 使用 100% 填充父容器 */
  height: 100%;
  box-sizing: border-box;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.gantt-toolbar {
  padding-bottom: 12px;
  display: flex;
  justify-content: flex-end;
}

.gantt-scale-controls {
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 6px;
  padding: 4px;
}

.scale-btn {
  background: transparent;
  border: none;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #4b5563;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.scale-btn:hover {
  color: #111827;
}

.scale-btn.active {
  background: #ffffff;
  color: #4f46e5;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.gantt-layout {
  display: flex;
  flex: 1;
  width: 100%;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
  overflow: hidden;
  min-height: 0;
}

.gantt-left {
  flex-shrink: 0;
  max-width: 50%;
  overflow-y: auto;
  overflow-x: auto;
  background: #ffffff;
}

/* 自定义左侧面板的滚动条 */
.gantt-left::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.gantt-left::-webkit-scrollbar-track {
  background: #f9fafb; 
}
.gantt-left::-webkit-scrollbar-thumb {
  background: #d1d5db; 
  border-radius: 5px;
  border: 2px solid #f9fafb;
}
.gantt-left::-webkit-scrollbar-thumb:hover {
  background: #9ca3af; 
}

.gantt-divider {
  width: 1px;
  background-color: #e5e7eb;
  z-index: 20;
  box-shadow: 1px 0 2px rgba(0,0,0,0.02);
}

.gantt-right {
  flex: 1;
  overflow: auto; /* X轴和Y轴滚动 */
  background: #ffffff;
  position: relative;
}

/* 自定义右侧面板的滚动条 */
.gantt-right::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.gantt-right::-webkit-scrollbar-track {
  background: #f9fafb; 
}
.gantt-right::-webkit-scrollbar-thumb {
  background: #d1d5db; 
  border-radius: 5px;
  border: 2px solid #f9fafb;
}
.gantt-right::-webkit-scrollbar-thumb:hover {
  background: #9ca3af; 
}
</style>
