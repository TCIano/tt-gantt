<template>
  <Teleport to="body">
    <transition name="fade-in">
      <div v-if="activeTooltipTask" class="gantt-tooltip" :style="tooltipStyle">
        <slot name="tooltip" :task="activeTooltipTask">
          <div class="gantt-tooltip-default">
            <div class="tooltip-header">
              <div class="tooltip-title">{{ activeTooltipTask.name }}</div>
              <div v-if="activeTooltipTask.status" class="status-badge" :style="statusStyle">
                {{ activeTooltipTask.status }}
              </div>
            </div>

            <div class="tooltip-body">
              <div class="tooltip-row">
                <span class="label">📅 开始日期</span>
                <span class="value">{{ formatDate(activeTooltipTask.startDate) }}</span>
              </div>
              <div class="tooltip-row">
                <span class="label">🏁 结束日期</span>
                <span class="value">{{ formatDate(activeTooltipTask.endDate) }}</span>
              </div>
              <div class="tooltip-row duration" v-if="duration">
                <span class="label">🕒 计划工期</span>
                <span class="value">{{ duration }} 天</span>
              </div>

              <div class="progress-section" v-if="activeTooltipTask.progress !== undefined">
                <div class="progress-info">
                  <span class="label">当前进度</span>
                  <span class="value">{{ activeTooltipTask.progress }}%</span>
                </div>
                <div class="progress-bar-bg">
                  <div
                    class="progress-bar-fill"
                    :style="{ width: `${activeTooltipTask.progress}%` }"
                  ></div>
                </div>
              </div>
            </div>

            <div class="tooltip-footer">
              <div class="shortcut-hint">按住 Shift 点击建立依赖</div>
            </div>
          </div>
        </slot>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGanttStore } from '../composables/useGanttStore';

const store = useGanttStore();
const { activeTooltipTask, tooltipPosition } = store;

const tooltipStyle = computed(() => {
  const offset = 15;
  return {
    left: `${tooltipPosition.value.x + offset}px`,
    top: `${tooltipPosition.value.y + offset}px`
  };
});

const statusStyle = computed(() => {
  if (!activeTooltipTask.value) return {};
  const style = store.statusStyleMap.value[String(activeTooltipTask.value.status || '')];
  return style ? { backgroundColor: style.barColor, color: style.textColor } : {};
});

const duration = computed(() => {
  if (!activeTooltipTask.value) return 0;
  const start = new Date(activeTooltipTask.value.startDate);
  const end = new Date(activeTooltipTask.value.endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
});

const formatDate = (date: string | number | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};
</script>

<style scoped>
.gantt-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 12px;
  font-family: inter, sans-serif;
  color: #1f2937;
  min-width: 220px;
}

.tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  gap: 12px;
}

.tooltip-title {
  font-weight: 700;
  font-size: 15px;
  color: #111827;
  line-height: 1.2;
}

.status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  white-space: nowrap;
}

.tooltip-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.tooltip-row .label {
  color: #6b7280;
}

.tooltip-row .value {
  font-weight: 600;
  color: #374151;
}

.tooltip-row.duration {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed #e5e7eb;
}

.progress-section {
  margin-top: 10px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 4px;
}

.progress-bar-bg {
  height: 6px;
  background: #f3f4f6;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #4f46e5;
  border-radius: 3px;
}

.tooltip-footer {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.shortcut-hint {
  font-size: 10px;
  color: #9ca3af;
  text-align: center;
}

/* 动画 */
.fade-in-enter-active,
.fade-in-leave-active {
  transition: all 0.2s ease;
}
.fade-in-enter-from,
.fade-in-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(5px);
}
</style>
