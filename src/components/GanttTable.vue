<template>
  <div class="gantt-table">
    <div class="gantt-table-header" :style="{ height: headerHeight + 'px' }">
      <slot name="header" :columns="columns">
        <div
          v-for="col in columns"
          :key="col.field"
          class="header-cell"
          :style="{
            width: col.width ? col.width + 'px' : '150px',
            minWidth: col.minWidth ? col.minWidth + 'px' : 'auto',
            textAlign: col.align || 'left'
          }"
        >
          {{ col.label }}
        </div>
      </slot>
    </div>
    <div class="gantt-table-body" :style="{ height: totalHeight + 'px', position: 'relative' }">
      <div v-if="visibleTasks.length === 0" class="gantt-table-empty">
        <slot name="empty">
          <div class="empty-text">暂无数据</div>
        </slot>
      </div>
      <div v-else class="gantt-table-content" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="task in visibleTasks"
          :key="task.id"
          class="gantt-table-row"
          :class="[
            {
              'is-expanded': task.expanded !== false,
              'is-selected': selectedTaskSet.has(task.id)
            },
            props.rowClass ? props.rowClass(task) : ''
          ]"
          :style="[{ height: rowHeight + 'px' }, props.rowStyle ? props.rowStyle(task) : {}]"
          @click="onRowClick($event, task.id)"
        >
          <slot
            name="row"
            :task="task"
            :columns="columns"
            :is-selected="selectedTaskSet.has(task.id)"
          >
            <div
              v-for="col in columns"
              :key="col.field"
              class="task-cell"
              :style="{
                width: col.width ? col.width + 'px' : '150px',
                minWidth: col.minWidth ? col.minWidth + 'px' : 'auto',
                paddingLeft: col.tree ? task._level * 24 + 16 + 'px' : '16px',
                textAlign: col.align || 'left'
              }"
            >
              <template v-if="col.tree">
                <slot
                  name="expand-icon"
                  :task="task"
                  :expanded="task.expanded !== false"
                  :on-toggle="() => toggleTask(task.id)"
                >
                  <button
                    v-if="task._hasChildren"
                    class="toggle-btn"
                    :class="{ 'is-open': task.expanded !== false }"
                    @click.stop="toggleTask(task.id)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      stroke="currentColor"
                      stroke-width="2"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                  <span v-else class="toggle-spacer"></span>
                </slot>
              </template>
              <slot :name="`cell-${col.field}`" :task="task" :column="col">
                <span
                  class="task-text"
                  :title="String(col.format ? col.format(task[col.field], task) : task[col.field])"
                >
                  {{ col.format ? col.format(task[col.field], task) : task[col.field] }}
                </span>
              </slot>
            </div>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGanttStore } from '../composables/useGanttStore';
import { computed } from 'vue';
import type { GanttRowClassFn, GanttRowStyleFn } from '../types/gantt';

const props = defineProps<{
  rowClass?: GanttRowClassFn;
  rowStyle?: GanttRowStyleFn;
}>();

const {
  visibleTasks,
  rowHeight,
  toggleTask,
  totalHeight,
  offsetY,
  columns,
  selectedTaskIds,
  selectTask
} = useGanttStore();
const headerHeight = 48; // 更新表头高度以改善设计

const selectedTaskSet = computed(() => new Set(selectedTaskIds.value));

const onRowClick = (e: MouseEvent, taskId: string | number) => {
  selectTask(taskId, {
    append: e.ctrlKey || e.metaKey,
    toggle: e.ctrlKey || e.metaKey
  });
};
</script>

<style scoped>
.gantt-table {
  position: relative;
  min-width: max-content;
  background: var(--gantt-bg-color, white);
}
.gantt-table-header {
  position: sticky;
  top: 0;
  background-color: var(--gantt-header-bg, #f9fafb);
  border-bottom: 1px solid var(--gantt-header-border, #e5e7eb);
  z-index: 10;
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--gantt-header-text-color, #4b5563);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
}
.header-cell {
  padding: 0 16px;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-right: 1px solid var(--gantt-border-color, #f3f4f6);
  height: 100%;
  display: flex;
  align-items: center;
}
.header-cell:last-child {
  border-right: none;
}
.gantt-table-body {
  position: relative;
}
.gantt-table-content {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 100%;
  will-change: transform;
}
.gantt-table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--gantt-border-color, #f3f4f6);
  box-sizing: border-box;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.gantt-table-row:hover {
  background-color: var(--gantt-row-hover-bg, #f9fafb);
  transform: translateX(4px);
}
.gantt-table-row.is-selected {
  background-color: var(--gantt-row-selected-bg, #f5f7ff);
  position: relative;
}
.gantt-table-row.is-selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--gantt-primary-color, #4f46e5);
}
.task-cell {
  display: flex;
  align-items: center;
  padding-right: 16px;
  box-sizing: border-box;
  overflow: hidden;
  border-right: 1px solid var(--gantt-border-color, #f9fafb);
  height: 100%;
}
.task-cell:last-child {
  border-right: none;
}
.toggle-btn {
  background: var(--gantt-border-color, #f3f4f6);
  border: none;
  cursor: pointer;
  width: 18px;
  height: 18px;
  padding: 0;
  margin-right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gantt-header-text-color, #6b7280);
  border-radius: 4px;
  transition: all 0.2s ease;
}
.toggle-btn:hover {
  background-color: var(--gantt-header-border, #e5e7eb);
  color: var(--gantt-text-color, #111827);
}
.toggle-btn svg {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle-btn.is-open {
  background-color: var(--gantt-row-selected-bg, #eef2ff);
  color: var(--gantt-primary-color, #4f46e5);
}
.toggle-btn.is-open svg {
  transform: rotate(90deg);
}
.toggle-spacer {
  width: 18px;
  margin-right: 8px;
  display: inline-block;
  flex-shrink: 0;
}
.task-text {
  font-size: 13px;
  color: var(--gantt-text-color, #374151);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.gantt-table-row.is-selected .task-text {
  color: var(--gantt-primary-color, #4f46e5);
  font-weight: 600;
}
.gantt-table-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
  width: 100%;
}
.empty-text {
  color: #9ca3af;
  font-size: 13px;
}
</style>
