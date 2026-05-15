<template>
  <Teleport to="body">
    <transition name="context-fade">
      <div
        v-if="visible"
        ref="menuRef"
        class="gantt-context-menu"
        :style="{ left: menuX + 'px', top: menuY + 'px' }"
        @click.stop
        @contextmenu.stop.prevent
      >
        <div class="menu-section-label">任务: {{ task?.name }}</div>
        <div class="menu-divider" />

        <button class="menu-item" @click="emit('lock')">
          <span class="menu-icon">🔒</span>
          {{ task?.readOnly ? '解锁任务' : '锁定任务' }}
        </button>

        <template v-if="dependencyMenuItems.length > 0">
          <div class="menu-divider" />
          <div class="menu-section-label">依赖管理</div>
          <button
            v-for="item in dependencyMenuItems"
            :key="item.id"
            class="menu-item"
            @click="emit('depAction', item)"
          >
            <span class="menu-icon">{{ item.icon }}</span>
            {{ item.label }}
          </button>
        </template>

        <template v-if="store.scenarios.value.length > 1">
          <div class="menu-divider" />
          <div class="menu-section-label">切换方案</div>
          <button
            v-for="s in store.scenarios.value"
            :key="s.id"
            :class="['menu-item', { 'is-active': s.id === store.activeScenarioId.value }]"
            @click="emit('switchScenario', s.id)"
          >
            <span class="menu-icon">{{ s.isBaseline ? '📌' : '📄' }}</span>
            {{ s.name }}
          </button>
        </template>

        <div class="menu-divider" />
        <button class="menu-item" @click="emit('copy')">
          <span class="menu-icon">📋</span>
          复制任务信息
        </button>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { FlatGanttTask } from '../types/gantt'
import { useGanttStore } from '../composables/useGanttStore'

defineProps<{
  visible: boolean
  menuX: number
  menuY: number
  task: FlatGanttTask | null
  dependencyMenuItems: Array<{
    id: string; label: string; icon: string; sourceId: string | number; action: string
  }>
}>()

const emit = defineEmits<{
  lock: []
  depAction: [item: { id: string; label: string; icon: string; sourceId: string | number; action: string }]
  switchScenario: [id: string]
  copy: []
  close: []
}>()

const store = useGanttStore()
</script>

<style scoped>
.gantt-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  max-width: 280px;
  padding: 6px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: white;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  font-size: 13px;
}

.menu-section-label {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px 2px;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: #f3f4f6;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 10px;
  cursor: pointer;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  font-size: 13px;
  text-align: left;
  gap: 8px;
  transition: all 0.15s;
}

.menu-item:hover {
  background: #f3f4f6;
  color: #111827;
}

.menu-item.is-active {
  color: #4f46e5;
  background: #eef2ff;
}

.menu-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.context-fade-enter-active,
.context-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.context-fade-enter-from,
.context-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
