<template>
  <Teleport to="body">
    <div
      v-if="activeTooltipTask"
      class="gantt-tooltip"
      :style="tooltipStyle"
    >
      <slot name="tooltip" :task="activeTooltipTask">
        <div class="gantt-tooltip-default">
          <div class="tooltip-title">{{ activeTooltipTask.name }}</div>
          <div class="tooltip-detail">
            <strong>Start:</strong> {{ String(activeTooltipTask.startDate) }}
          </div>
          <div class="tooltip-detail">
            <strong>End:</strong> {{ String(activeTooltipTask.endDate) }}
          </div>
          <div class="tooltip-detail" v-if="activeTooltipTask.progress !== undefined">
            <strong>Progress:</strong> {{ activeTooltipTask.progress }}%
          </div>
        </div>
      </slot>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGanttStore } from '../composables/useGanttStore';

const store = useGanttStore();
const { activeTooltipTask, tooltipPosition } = store;

const tooltipStyle = computed(() => {
  // Simple offset to avoid cursor blocking
  const offset = 15;
  return {
    left: `${tooltipPosition.value.x + offset}px`,
    top: `${tooltipPosition.value.y + offset}px`
  };
});
</script>

<style scoped>
.gantt-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background: white;
  border-radius: 6px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 12px;
  color: #374151;
  max-width: 300px;
}
.gantt-tooltip-default .tooltip-title {
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
  font-size: 14px;
}
.gantt-tooltip-default .tooltip-detail {
  margin-top: 2px;
}
</style>
