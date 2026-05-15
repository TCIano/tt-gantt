<template>
  <div class="gantt-layout-wrapper" tabindex="0" @keydown="handleKeydown">
    <div class="gantt-toolbar">
      <div class="toolbar-left">
        <div class="gantt-scale-controls">
          <button
            :class="{ active: scale === 'day' }"
            class="scale-btn"
            title="日视图 (D)"
            @click="scale = 'day'"
          >
            日
          </button>
          <button
            :class="{ active: scale === 'week' }"
            class="scale-btn"
            title="周视图 (W)"
            @click="scale = 'week'"
          >
            周
          </button>
          <button
            :class="{ active: scale === 'month' }"
            class="scale-btn"
            title="月视图 (M)"
            @click="scale = 'month'"
          >
            月
          </button>
        </div>
        <div class="divider" />
        <button
          class="tool-btn action-btn"
          title="保存当前方案"
          @click="handleSaveScenario"
        >
          <span class="icon">💾</span>
          保存方案
        </button>
        <select
          v-if="store.scenarios.value.length > 0"
          class="scenario-select"
          :value="store.activeScenarioId.value"
          @change="handleSwitchScenario(($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="s in store.scenarios.value"
            :key="s.id"
            :value="s.id"
          >
            {{ s.name }}<template v-if="s.isBaseline"> (基准)</template>
          </option>
        </select>
        <div class="divider" />
        <button
          :class="{ 'is-active': compareView }"
          class="tool-btn action-btn"
          title="分屏对比 (C)"
          @click="toggleCompareView"
        >
          <span class="icon">🌓</span>
          {{ compareView ? '常规视图' : '对比视图' }}
        </button>
        <button
          :class="{ 'is-active': store.hideHolidays.value }"
          class="tool-btn action-btn"
          title="隐藏节假日 (H)"
          @click="store.hideHolidays.value = !store.hideHolidays.value"
        >
          <span class="icon">{{ store.hideHolidays.value ? '👁️' : '🙈' }}</span>
          {{ store.hideHolidays.value ? '显示节假日' : '隐藏节假日' }}
        </button>
      </div>

      <div class="toolbar-right">
        <div class="history-controls">
          <button class="icon-btn" title="撤销上次操作 (Ctrl+Z)" @click="store.undo()">↩️</button>
          <button class="icon-btn" title="重做上次操作 (Ctrl+Y)" @click="store.redo()">↪️</button>
        </div>
        <div class="divider" />
        <div class="dropdown-container">
          <button
            :class="{ 'is-active': showExportMenu }"
            class="tool-btn"
            @click="toggleExportMenu"
          >
            <span class="icon">📤</span>
            导出
            <span :class="{ 'is-open': showExportMenu }" class="arrow">▾</span>
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
        <div class="divider" />
        <button class="icon-btn help-btn" title="快捷键帮助" @click="showHelp = !showHelp">
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
            <div class="help-item"><kbd>Shift</kbd>+<kbd>Click</kbd><span>建立/循环依赖类型</span></div>
            <div class="help-item"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Click</kbd><span>删除依赖</span></div>
            <div class="help-item"><kbd>Esc</kbd><span>取消选择</span></div>
          </div>
        </div>
      </div>
    </transition>

    <div class="gantt-layout-container">
      <div :class="{ 'has-compare': compareView }" class="gantt-layout">
        <div ref="leftRef" class="gantt-left" @scroll="handleLeftScroll">
          <GanttTable :row-class="props.rowClass" :row-style="props.rowStyle">
            <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
              <slot
                v-if="
                  name.startsWith('cell-') ||
                  ['header', 'expand-icon', 'empty', 'row'].includes(name)
                "
                :name="name"
                v-bind="slotProps"
              />
            </template>
          </GanttTable>
        </div>

        <div ref="rightRef" class="gantt-right" @scroll="handleRightScroll">
          <GanttTimeline
            :bar-class="props.barClass"
            :bar-style="props.barStyle"
            :row-class="props.rowClass"
            :row-style="props.rowStyle"
          >
            <template #timeline-header="slotProps">
              <slot name="timeline-header" v-bind="slotProps" />
            </template>
            <template #bar="slotProps">
              <slot name="bar" v-bind="slotProps" />
            </template>
          </GanttTimeline>
          <transition name="slide-up">
            <div v-if="compareView" class="compare-view">
              <div class="compare-title">
                <span class="dot" />
                对比视图
                <select
                  class="scenario-select compare-select"
                  :value="store.compareScenarioId.value"
                  @change="store.setCompareScenario(($event.target as HTMLSelectElement).value || null)"
                >
                  <option :value="null">-- 选择对比方案 --</option>
                  <option
                    v-for="s in store.scenarios.value"
                    :key="s.id"
                    :value="s.id"
                    :disabled="s.id === store.activeScenarioId.value"
                  >
                    {{ s.name }}
                  </option>
                </select>
              </div>
              <GanttTimeline
                :bar-class="props.barClass"
                :bar-style="props.barStyle"
                :row-class="props.rowClass"
                :row-style="props.rowStyle"
              >
                <template #timeline-header="slotProps">
                  <slot name="timeline-header" v-bind="slotProps" />
                </template>
                <template #bar="slotProps">
                  <slot name="bar" v-bind="slotProps" />
                </template>
              </GanttTimeline>
            </div>
          </transition>
        </div>
      </div>
    </div>
    <GanttTooltip>
      <template #tooltip="slotProps">
        <slot name="tooltip" v-bind="slotProps" />
      </template>
    </GanttTooltip>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import GanttTable from './GanttTable.vue';
import GanttTimeline from './GanttTimeline.vue';
import GanttTooltip from './GanttTooltip.vue';
import { provideGanttStore } from '../composables/useGanttStore';
import { GanttEventBus, provideGanttEventBus } from '../composables/useGanttPlugin';
import { useDefaultEventHandlers } from '../composables/useDefaultEventHandlers';
import { LoggerPlugin } from '../plugins/LoggerPlugin';
import type {
  FlatGanttTask,
  GanttBarClassFn,
  GanttBarStyleFn,
  GanttColumn,
  GanttRowClassFn,
  GanttRowStyleFn,
  GanttSnapMode,
  GanttStatusStyle,
  GanttTask,
  GanttLayoutMode
} from '../types/gantt'
import type { ResourceNode } from '../core/types'

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
    hideHolidays?: boolean
    layoutMode?: GanttLayoutMode
    resources?: ResourceNode[]
    rowClass?: GanttRowClassFn
    rowStyle?: GanttRowStyleFn
    barClass?: GanttBarClassFn
    barStyle?: GanttBarStyleFn
  }>(),
  {
    readOnly: false,
    editable: true,
    multiSelect: true,
    weekStartsOn: 1,
    showBaseline: false,
    showTodayLine: true,
    hideHolidays: false,
    layoutMode: 'task'
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

// Resource mode sync
watch(
  () => props.layoutMode,
  (mode) => {
    store.layoutMode.value = mode ?? 'task'
  },
  { immediate: true }
)

watch(
  () => props.resources,
  (newResources) => {
    store.resources.value = newResources ?? []
  },
  { immediate: true, deep: true }
)

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

const handleSaveScenario = () => {
  const name = `方案 ${store.scenarios.value.length + 1}`
  store.saveScenario(name)
}

const handleSwitchScenario = (scenarioId: string) => {
  store.switchScenario(scenarioId)
  compareView.value = false
  store.setCompareScenario(null)
}

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

});

onUnmounted(() => {
  window.removeEventListener('mousedown', closeMenus);
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

useDefaultEventHandlers(eventBus, {
  onTaskDrop: handleTaskDrop,
  onTaskClick: handleTaskClick,
  onTaskToggle: handleTaskToggle,
  onSelectionChange: handleSelectionChange,
  onValidationError: handleValidationError,
  onDependencyClick: handleDependencyClick,
  onDependencyCreate: handleDependencyCreate
});
</script>

<style scoped>
.gantt-layout-wrapper {
  /* 暴露 CSS 变量供外部覆盖 */
  font-family:
    inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    sans-serif;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  margin: 0;
  padding: 16px;
  outline: none;
  background-color: var(--gantt-bg-color);
  --gantt-bg-color: #f9fafb;
  --gantt-border-color: #f3f4f6;
  --gantt-header-bg: #f9fafb;

  --gantt-header-border: #e5e7eb;
  --gantt-row-hover-bg: #f9fafb;
  --gantt-row-selected-bg: #f5f7ff;
  --gantt-text-color: #374151;
  --gantt-header-text-color: #4b5563;
  --gantt-primary-color: #4f46e5;
  --gantt-grid-line-color: #f3f4f6;
  --gantt-weekend-bg: #f9fafb;
  --gantt-today-line-color: #ef4444;
}

.gantt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 8px 16px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
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
  margin: 0 4px;
  background: #e5e7eb;
}

.gantt-scale-controls {
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: #f3f4f6;
}

.scale-btn {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: #6b7280;
  border: none;
  border-radius: 6px;
  background: transparent;
}

.scale-btn:hover {
  color: #374151;
}

.scale-btn.active {
  color: #4f46e5;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.tool-btn {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 14px;
  cursor: pointer;
  transition: all 0.2s;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  gap: 6px;
}

.tool-btn:hover {
  color: #4338ca;
  border-color: #c7d2fe;
  background: #f5f7ff;
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
  color: white;
  border-color: #4f46e5;
  background: #4f46e5;
}

.tool-btn.primary:hover {
  border-color: #4338ca;
  background: #4338ca;
}

.tool-btn.is-active {
  color: #4f46e5;
  border-color: #c7d2fe;
  background: #eef2ff;
}

.icon-btn {
  font-size: 18px;
  line-height: 1;
  padding: 4px;
  cursor: pointer;
  transition: background 0.2s;
  border: none;
  border-radius: 6px;
  background: transparent;
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
  z-index: 100;
  top: calc(100% + 8px);
  right: 0;
  min-width: 160px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.1);
}

.menu-item {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: #374151;
  border: none;
  border-radius: 8px;
  background: transparent;
  gap: 10px;
}

.menu-item:hover {
  color: #111827;
  background: #f3f4f6;
}

.menu-item.primary {
  color: #4f46e5;
}

.menu-item.primary:hover {
  background: #eef2ff;
}

.arrow {
  font-size: 10px;
  display: inline-block;
  transition: transform 0.2s;
}

.arrow.is-open {
  transform: rotate(180deg);
}

/* 帮助弹窗 */
.help-modal-overlay {
  position: fixed;
  z-index: 1000;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
}

.help-modal {
  width: 400px;
  max-width: 90vw;
  padding: 24px;
  border-radius: 16px;
  background: white;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.help-header h3 {
  font-size: 18px;
  margin: 0;
  color: #111827;
}

.close-btn {
  font-size: 24px;
  cursor: pointer;
  color: #9ca3af;
  border: none;
  background: transparent;
}

.help-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.help-item {
  font-size: 14px;
  display: flex;
  align-items: center;
  color: #4b5563;
  gap: 12px;
}

kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  color: #111827;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #f3f4f6;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);
}

.gantt-layout-container {
  position: relative;
  flex: 1;
  min-height: 0;
}

.gantt-layout {
  display: flex;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.gantt-left {
  overflow-x: auto;
  overflow-y: auto;
  flex-shrink: 0;
  width: 320px; /* 默认宽度 */
  max-width: 50%;
  border-right: 1px solid #f3f4f6;
  background: #ffffff;
}

.gantt-right {
  position: relative;
  display: flex;
  overflow: auto;
  flex: 1;
  flex-direction: column;
  background: #ffffff;
}

.compare-view {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  border-top: 2px solid #f3f4f6;
  background: #fafafa;
}

.compare-title {
  font-size: 11px;
  font-weight: 700;
  position: sticky;
  z-index: 30;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  padding: 6px 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9ca3af;
  background: rgba(250, 250, 250, 0.9);
  backdrop-filter: blur(4px);
  gap: 6px;
}

.compare-title .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
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
  border-radius: 10px;
  background: #e5e7eb;
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

.scenario-select {
  font-size: 12px;
  font-weight: 500;
  height: 30px;
  padding: 0 8px;
  cursor: pointer;
  color: #374151;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.scenario-select:hover {
  border-color: #c7d2fe;
}

.compare-select {
  margin-left: 8px;
  min-width: 140px;
}
</style>
