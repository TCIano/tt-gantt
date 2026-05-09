<template>
  <div class="gantt-table">
    <div class="gantt-table-header" :style="{ height: headerHeight + 'px' }">
      <div 
        v-for="col in columns" 
        :key="col.field"
        class="header-cell"
        :style="{ width: col.width ? col.width + 'px' : '150px', minWidth: col.minWidth ? col.minWidth + 'px' : 'auto', textAlign: col.align || 'left' }"
      >
        {{ col.label }}
      </div>
    </div>
    <div class="gantt-table-body" :style="{ height: totalHeight + 'px', position: 'relative' }">
      <div
        class="gantt-table-content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div 
          v-for="task in visibleTasks" 
          :key="task.id"
          class="gantt-table-row"
          :class="{ 'is-expanded': task.expanded !== false }"
          :style="{ height: rowHeight + 'px' }"
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
              <button 
                v-if="task._hasChildren" 
                class="toggle-btn"
                :class="{ 'is-open': task.expanded !== false }"
                @click="toggleTask(task.id)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
              <span v-else class="toggle-spacer"></span>
            </template>
            <slot :name="`cell-${col.field}`" :task="task" :column="col">
              <span class="task-text" :title="String(col.format ? col.format(task[col.field], task) : task[col.field])">
                {{ col.format ? col.format(task[col.field], task) : task[col.field] }}
              </span>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGanttStore } from '../composables/useGanttStore';

const { visibleTasks, rowHeight, toggleTask, totalHeight, offsetY, columns } = useGanttStore();
const headerHeight = 48; // 更新表头高度以改善设计
</script>

<style scoped>
.gantt-table {
  position: relative;
  min-width: max-content;
}
.gantt-table-header {
  position: sticky;
  top: 0;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  z-index: 10;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}
.header-cell {
  padding: 0 16px;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-right: 1px solid #e5e7eb;
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
  border-bottom: 1px solid #f3f4f6;
  box-sizing: border-box;
  transition: background-color 0.15s ease;
}
.gantt-table-row:hover {
  background-color: #f8fafc;
}
.task-cell {
  display: flex;
  align-items: center;
  padding-right: 16px;
  box-sizing: border-box;
  overflow: hidden;
  border-right: 1px solid #f3f4f6;
  height: 100%;
}
.task-cell:last-child {
  border-right: none;
}
.toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.toggle-btn:hover {
  background-color: #e5e7eb;
  color: #4b5563;
}
.toggle-btn svg {
  transition: transform 0.2s ease;
}
.toggle-btn.is-open svg {
  transform: rotate(90deg);
}
.toggle-spacer {
  width: 22px;
  margin-right: 6px;
  display: inline-block;
  flex-shrink: 0;
}
.task-text {
  font-size: 14px;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
</style>