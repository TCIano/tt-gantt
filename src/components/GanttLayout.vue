<template>
  <div class="gantt-layout-wrapper" tabindex="0" @keydown="handleKeydown">
    <div class="gantt-toolbar">
      <div class="toolbar-left">
        <div class="gantt-scale-controls">
          <button
            class="scale-btn"
            :class="{ active: scale === 'day' }"
            @click="scale = 'day'"
            title="日视图 (D)"
          >
            日
          </button>
          <button
            class="scale-btn"
            :class="{ active: scale === 'week' }"
            @click="scale = 'week'"
            title="周视图 (W)"
          >
            周
          </button>
          <button
            class="scale-btn"
            :class="{ active: scale === 'month' }"
            @click="scale = 'month'"
            title="月视图 (M)"
          >
            月
          </button>
        </div>
        <div class="divider"></div>
        <button
          class="tool-btn action-btn"
          :class="{ 'is-active': compareView }"
          @click="toggleCompareView"
          title="分屏对比 (C)"
        >
          <span class="icon">🌓</span>
          {{ compareView ? '常规视图' : '对比视图' }}
        </button>
        <button
          class="tool-btn action-btn"
          :class="{ 'is-active': store.hideHolidays.value }"
          @click="store.hideHolidays.value = !store.hideHolidays.value"
          title="隐藏节假日 (H)"
        >
          <span class="icon">{{ store.hideHolidays.value ? '👁️' : '🙈' }}</span>
          {{ store.hideHolidays.value ? '显示节假日' : '隐藏节假日' }}
        </button>
      </div>

      <div class="toolbar-right">
        <div class="history-controls">
          <button class="icon-btn" @click="store.undo()" title="撤销上次操作 (Ctrl+Z)">↩️</button>
          <button class="icon-btn" @click="store.redo()" title="重做上次操作 (Ctrl+Y)">↪️</button>
        </div>
        <div class="divider"></div>
        <div class="dropdown-container">
          <button
            class="tool-btn"
            @click="toggleExportMenu"
            :class="{ 'is-active': showExportMenu }"
          >
            <span class="icon">📤</span>
            导出
            <span class="arrow" :class="{ 'is-open': showExportMenu }">▾</span>
          </button>
          <transition name="fade-in">
            <div v-if="showExportMenu" class="dropdown-menu">
              <button class="menu-item" @click="exportSvg">
                <span class="icon">🖼️</span> SVG 图片
              </button>
              <button class="menu-item" @click="exportJson">
                <span class="icon">📄</span> JSON 数据
              </button>
              <button class="menu-item primary" @click="exportPdf">
                <span class="icon">🖨️</span> 打印为 PDF
              </button>
            </div>
          </transition>
        </div>
        <div class="divider"></div>
        <button class="icon-btn help-btn" @click="showHelp = !showHelp" title="快捷键帮助">
          ❓
        </button>
      </div>
    </div>

    <!-- 快捷键帮助弹窗 -->
    <transition name="fade-in">
      <div v-if="showHelp" class="help-modal-overlay" @click="showHelp = false">
        <div class="help-modal" @click.stop>
          <div class="help-header">
            <h3>快捷键帮助</h3>
            <button class="close-btn" @click="showHelp = false">×</button>
          </div>
          <div class="help-grid">
            <div class="help-item"><kbd>D</kbd><span>日视图</span></div>
            <div class="help-item"><kbd>W</kbd><span>周视图</span></div>
            <div class="help-item"><kbd>M</kbd><span>月视图</span></div>
            <div class="help-item"><kbd>C</kbd><span>对比视图</span></div>
            <div class="help-item"><kbd>H</kbd><span>隐藏/显示节假日</span></div>
            <div class="help-item"><kbd>Ctrl</kbd>+<kbd>Z</kbd><span>撤销</span></div>
            <div class="help-item"><kbd>Ctrl</kbd>+<kbd>Y</kbd><span>重做</span></div>
            <div class="help-item"><kbd>←</kbd><kbd>→</kbd><span>移动选中任务</span></div>
            <div class="help-item"><kbd>Shift</kbd>+<kbd>Click</kbd><span>建立依赖连线</span></div>
            <div class="help-item"><kbd>Esc</kbd><span>取消选择</span></div>
          </div>
        </div>
      </div>
    </transition>

    <div class="gantt-layout-container">
      <div class="gantt-layout" :class="{ 'has-compare': compareView }">
        <div class="gantt-left" ref="leftRef" @scroll="handleLeftScroll">
          <GanttTable>
            <template v-for="(_, name) in $slots" #[name]="slotProps" :key="name">
              <slot v-if="name.startsWith('cell-')" :name="name" v-bind="slotProps"></slot>
            </template>
          </GanttTable>
        </div>

        <div class="gantt-right" ref="rightRef" @scroll="handleRightScroll">
          <GanttTimeline>
            <template #bar="slotProps">
              <slot name="bar" v-bind="slotProps"></slot>
            </template>
          </GanttTimeline>
          <transition name="slide-up">
            <div v-if="compareView" class="compare-view">
              <div class="compare-title">
                <span class="dot"></span>
                对比视图
              </div>
              <GanttTimeline>
                <template #bar="slotProps">
                  <slot name="bar" v-bind="slotProps"></slot>
                </template>
              </GanttTimeline>
            </div>
          </transition>
        </div>
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
import { ref, onMounted, onUnmounted, watch } from 'vue';
import GanttTable from './GanttTable.vue';
import GanttTimeline from './GanttTimeline.vue';
import GanttTooltip from './GanttTooltip.vue';
import { provideGanttStore } from '../composables/useGanttStore';
import { GanttEventBus, provideGanttEventBus } from '../composables/useGanttPlugin';
import { LoggerPlugin } from '../plugins/LoggerPlugin';
import type {
  GanttTask,
  FlatGanttTask,
  GanttColumn,
  GanttSnapMode,
  GanttStatusStyle
} from '../types/gantt';

const props = withDefaults(
  defineProps<{
    tasks: GanttTask[];
    columns?: GanttColumn[];
    readOnly?: boolean;
    editable?: boolean;
    multiSelect?: boolean;
    snapMode?: GanttSnapMode;
    weekStartsOn?: number;
    statusStyleMap?: Record<string, GanttStatusStyle>;
    nonWorkingWeekdays?: number[];
    holidays?: string[];
    showBaseline?: boolean;
    showTodayLine?: boolean;
    hideHolidays?: boolean;
  }>(),
  {
    readOnly: false,
    editable: true,
    multiSelect: true,
    weekStartsOn: 1,
    showBaseline: false,
    showTodayLine: true,
    hideHolidays: false
  }
);

const emit = defineEmits<{
  taskDrop: [
    payload: {
      task: GanttTask | FlatGanttTask;
      newStartDate: string | Date | number;
      newEndDate: string | Date | number;
    }
  ];
  taskClick: [payload: { task: GanttTask | FlatGanttTask; event: MouseEvent }];
  taskToggle: [payload: { task: GanttTask | FlatGanttTask; expanded: boolean }];
  selectionChange: [payload: { selectedTaskIds: (string | number)[] }];
  validationError: [payload: { task: GanttTask | FlatGanttTask; reason: string }];
  dependencyClick: [payload: { sourceId: string | number; targetId: string | number; id: string }];
  dependencyCreate: [payload: { sourceId: string | number; targetId: string | number }];
  export: [payload: { type: 'svg' | 'json' | 'pdf' }];
}>();

const eventBus = provideGanttEventBus(new GanttEventBus());
LoggerPlugin.install(eventBus);
const store = provideGanttStore(eventBus);
const compareView = ref(false);
const showExportMenu = ref(false);
const showHelp = ref(false);

const toggleExportMenu = () => {
  showExportMenu.value = !showExportMenu.value;
};

// 点击外部关闭菜单
const closeMenus = (e: MouseEvent) => {
  if (!(e.target as HTMLElement).closest('.dropdown-container')) {
    showExportMenu.value = false;
  }
};

// 将 props 同步到 store
watch(
  () => props.tasks,
  (newTasks) => {
    store.tasks.value = newTasks;
  },
  { immediate: true, deep: true }
);

watch(
  () => props.columns,
  (newCols) => {
    if (newCols) {
      store.columns.value = newCols;
    }
  },
  { immediate: true, deep: true }
);

watch(
  () => [
    props.readOnly,
    props.editable,
    props.multiSelect,
    props.snapMode,
    props.weekStartsOn,
    props.statusStyleMap,
    props.nonWorkingWeekdays,
    props.holidays,
    props.showBaseline,
    props.showTodayLine,
    props.hideHolidays
  ],
  () => {
    store.setConfig({
      readOnly: props.readOnly,
      editable: props.editable,
      multiSelect: props.multiSelect,
      snapMode: props.snapMode,
      weekStartsOn: props.weekStartsOn,
      statusStyleMap: props.statusStyleMap,
      nonWorkingWeekdays: props.nonWorkingWeekdays,
      holidays: props.holidays,
      showBaseline: props.showBaseline,
      showTodayLine: props.showTodayLine,
      hideHolidays: props.hideHolidays
    });
  },
  { immediate: true, deep: true }
);

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

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key.toLowerCase() === 'd') {
    scale.value = 'day';
  } else if (e.key.toLowerCase() === 'w') {
    scale.value = 'week';
  } else if (e.key.toLowerCase() === 'm') {
    scale.value = 'month';
  } else if (e.key.toLowerCase() === 'c') {
    toggleCompareView();
  } else if (e.key.toLowerCase() === 'h') {
    store.hideHolidays.value = !store.hideHolidays.value;
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    store.moveSelectedTasks(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    store.moveSelectedTasks(1);
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      store.redo();
    } else {
      store.undo();
    }
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    store.redo();
  } else if (e.key === 'Escape') {
    store.clearSelection();
    showHelp.value = false;
    showExportMenu.value = false;
  }
};

const handleTaskDrop = (payload: {
  task: GanttTask | FlatGanttTask;
  newStartDate: string | Date | number;
  newEndDate: string | Date | number;
}) => {
  emit('taskDrop', payload);
};
const handleTaskClick = (payload: { task: GanttTask | FlatGanttTask; event: MouseEvent }) => {
  emit('taskClick', payload);
};
const handleTaskToggle = (payload: { task: GanttTask | FlatGanttTask; expanded: boolean }) => {
  emit('taskToggle', payload);
};
const handleSelectionChange = (payload: { selectedTaskIds: (string | number)[] }) => {
  emit('selectionChange', payload);
};
const handleValidationError = (payload: { task: GanttTask | FlatGanttTask; reason: string }) => {
  emit('validationError', payload);
};
const handleDependencyClick = (payload: {
  sourceId: string | number;
  targetId: string | number;
  id: string;
}) => {
  emit('dependencyClick', payload);
};
const handleDependencyCreate = (payload: {
  sourceId: string | number;
  targetId: string | number;
}) => {
  emit('dependencyCreate', payload);
};

const triggerDownload = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  showExportMenu.value = false;
};

const exportSvg = () => {
  const svg = rightRef.value?.querySelector('svg');
  if (svg) {
    triggerDownload('gantt-chart.svg', svg.outerHTML, 'image/svg+xml;charset=utf-8');
    emit('export', { type: 'svg' });
  }
};

const exportJson = () => {
  triggerDownload(
    'gantt-data.json',
    JSON.stringify(store.tasks.value, null, 2),
    'application/json;charset=utf-8'
  );
  emit('export', { type: 'json' });
};

const exportPdf = () => {
  emit('export', { type: 'pdf' });
  showExportMenu.value = false;
  window.print();
};

const toggleCompareView = () => {
  compareView.value = !compareView.value;
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  window.addEventListener('mousedown', closeMenus);
  if (rightRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        viewportHeight.value = entry.contentRect.height;
        viewportWidth.value = entry.contentRect.width;
      }
    });
    resizeObserver.observe(rightRef.value);
  }

  eventBus.on('onTaskDrop', handleTaskDrop);
  eventBus.on('onTaskClick', handleTaskClick);
  eventBus.on('onTaskToggle', handleTaskToggle);
  eventBus.on('onSelectionChange', handleSelectionChange);
  eventBus.on('onValidationError', handleValidationError);
  eventBus.on('onDependencyClick', handleDependencyClick);
  eventBus.on('onDependencyCreate', handleDependencyCreate);
});

onUnmounted(() => {
  window.removeEventListener('mousedown', closeMenus);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  eventBus.off('onTaskDrop', handleTaskDrop);
  eventBus.off('onTaskClick', handleTaskClick);
  eventBus.off('onTaskToggle', handleTaskToggle);
  eventBus.off('onSelectionChange', handleSelectionChange);
  eventBus.off('onValidationError', handleValidationError);
  eventBus.off('onDependencyClick', handleDependencyClick);
  eventBus.off('onDependencyCreate', handleDependencyCreate);
});
</script>

<style scoped>
.gantt-layout-wrapper {
  height: 100%;
  box-sizing: border-box;
  font-family:
    inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
  margin: 0;
  display: flex;
  flex-direction: column;
  outline: none;
  background-color: #f9fafb;
  padding: 16px;
}

.gantt-toolbar {
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 8px 16px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #f3f4f6;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.divider {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  margin: 0 4px;
}

.gantt-scale-controls {
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 2px;
}

.scale-btn {
  background: transparent;
  border: none;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.scale-btn:hover {
  color: #374151;
}

.scale-btn.active {
  background: #ffffff;
  color: #4f46e5;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.tool-btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  border-radius: 8px;
  height: 34px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.tool-btn:hover {
  border-color: #c7d2fe;
  background: #f5f7ff;
  color: #4338ca;
}

.tool-btn:active {
  transform: scale(0.96);
}

.icon-btn:active {
  transform: scale(0.92);
}

.menu-item:active {
  background: #e5e7eb;
}

.tool-btn.primary {
  background: #4f46e5;
  border-color: #4f46e5;
  color: white;
}

.tool-btn.primary:hover {
  background: #4338ca;
  border-color: #4338ca;
}

.tool-btn.is-active {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #4f46e5;
}

.icon-btn {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: background 0.2s;
  line-height: 1;
}

.icon-btn:hover {
  background: #f3f4f6;
}

.export-group {
  display: flex;
  gap: 6px;
}

/* 下拉菜单 */
.dropdown-container {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.1);
  padding: 6px;
  min-width: 160px;
  z-index: 100;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.menu-item:hover {
  background: #f3f4f6;
  color: #111827;
}

.menu-item.primary {
  color: #4f46e5;
}

.menu-item.primary:hover {
  background: #eef2ff;
}

.arrow {
  font-size: 10px;
  transition: transform 0.2s;
  display: inline-block;
}

.arrow.is-open {
  transform: rotate(180deg);
}

/* 帮助弹窗 */
.help-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.help-modal {
  background: white;
  border-radius: 16px;
  width: 400px;
  max-width: 90vw;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  padding: 24px;
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.help-header h3 {
  margin: 0;
  font-size: 18px;
  color: #111827;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
}

.help-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.help-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #4b5563;
}

kbd {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}

.gantt-layout-container {
  flex: 1;
  min-height: 0;
  position: relative;
}

.gantt-layout {
  display: flex;
  height: 100%;
  width: 100%;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -1px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.gantt-left {
  flex-shrink: 0;
  width: 320px; /* 默认宽度 */
  max-width: 50%;
  overflow-y: auto;
  overflow-x: auto;
  background: #ffffff;
  border-right: 1px solid #f3f4f6;
}

.gantt-right {
  flex: 1;
  overflow: auto;
  background: #ffffff;
  position: relative;
  display: flex;
  flex-direction: column;
}

.compare-view {
  border-top: 2px solid #f3f4f6;
  background: #fafafa;
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.compare-title {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 30;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  padding: 6px 12px;
  background: rgba(250, 250, 250, 0.9);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  gap: 6px;
}

.compare-title .dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

/* 动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>
