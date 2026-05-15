<template>
  <div class="app-container">
    <h1>Basic Gantt Chart (Custom Render Demo)</h1>
    <div class="gantt-container">
      <GanttLayout :tasks="tasks" :columns="columns">
        <!-- 自定义左侧表格单元格渲染 -->
        <template #cell-status="{ task }">
          <span
            class="status-tag"
            :class="{
              'status-done': task.progress === 100,
              'status-doing': task.progress > 0 && task.progress < 100,
              'status-todo': task.progress === 0
            }"
          >
            {{ task.progress === 100 ? '已完成' : task.progress > 0 ? '进行中' : '未开始' }}
          </span>
        </template>

        <!-- 自定义右侧任务条渲染 -->
        <template #bar="{ task, isDragging }">
          <div
            class="custom-gantt-bar"
            :class="{ 'is-dragging': isDragging, 'is-done': task.progress === 100 }"
          >
            <div class="custom-progress" :style="{ width: `${task.progress || 0}%` }" />
            <span class="custom-label">
              <span v-if="task.progress === 100">✅</span>
              {{ task.name }}
            </span>
          </div>
        </template>

        <!-- 自定义悬浮提示（Tooltip）渲染 -->
        <template #tooltip="{ task }">
          <div class="custom-tooltip">
            <div class="custom-tooltip-header">
              <span
                class="dot"
                :style="{ backgroundColor: task.progress === 100 ? '#10b981' : '#3b82f6' }"
              />
              {{ task.name }}
            </div>
            <div class="custom-tooltip-body">
              <p><strong>开始：</strong>{{ task.startDate }}</p>
              <p><strong>结束：</strong>{{ task.endDate }}</p>
              <p><strong>进度：</strong>{{ task.progress || 0 }}%</p>
              <p v-if="task.dependencies?.length">
                <strong>前置依赖：</strong>{{ task.dependencies.join(', ') }}
              </p>
            </div>
          </div>
        </template>
      </GanttLayout>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import GanttLayout from './components/GanttLayout.vue';
import type { GanttTask, GanttColumn } from './types/gantt';

const tasks = ref<GanttTask[]>([]);
const columns = ref<GanttColumn[]>([
  { field: 'name', label: '任务名称', width: 250, tree: true },
  { field: 'status', label: '状态', width: 90, align: 'center' },
  { field: 'startDate', label: '开始时间', width: 110, align: 'center' },
  { field: 'endDate', label: '结束时间', width: 110, align: 'center' },
  {
    field: 'progress',
    label: '进度',
    width: 80,
    align: 'center',
    format: (val) => (val !== undefined ? `${val}%` : '0%')
  }
]);

onMounted(() => {
  // Add some dummy data
  tasks.value = [
    {
      id: 1,
      name: 'Project Alpha',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      expanded: true,
      progress: 45,
      children: [
        {
          id: 11,
          name: 'Task 1.1',
          startDate: '2026-04-01',
          endDate: '2026-04-10',
          progress: 100
        },
        {
          id: 12,
          name: 'Task 1.2',
          startDate: '2026-04-11',
          endDate: '2026-04-20',
          progress: 20,
          dependencies: [11, 1] // Depends on Task 1.1
        }
      ]
    },
    {
      id: 2,
      name: 'Project Beta',
      startDate: '2026-04-15',
      endDate: '2026-05-15',
      progress: 0,
      dependencies: [1] // Depends on Project Alpha
    }
  ];
});
</script>

<style scoped>
.app-container {
  padding: 24px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #f3f4f6;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    sans-serif;
}

h1 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #111827;
  font-size: 24px;
  font-weight: 600;
}

.gantt-container {
  flex: 1;
  min-height: 0; /* Important for nested flex scroll */
}

/* Custom Cell Render */
.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}
.status-done {
  background-color: #d1fae5;
  color: #065f46;
}
.status-doing {
  background-color: #dbeafe;
  color: #1e40af;
}
.status-todo {
  background-color: #f3f4f6;
  color: #4b5563;
}

/* Custom Bar Render */
.custom-gantt-bar {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 6px;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  color: white;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}
.custom-gantt-bar.is-done {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}
.custom-gantt-bar.is-dragging {
  transform: scale(1.02);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}
.custom-progress {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.2);
  z-index: 1;
}
.custom-label {
  position: relative;
  z-index: 2;
  padding: 0 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Custom Tooltip Render */
.custom-tooltip {
  min-width: 200px;
}
.custom-tooltip-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}
.custom-tooltip-header .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}
.custom-tooltip-body p {
  margin: 4px 0;
  font-size: 12px;
  color: #4b5563;
}
</style>
