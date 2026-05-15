import { ref, computed, provide, inject } from 'vue'
import type { InjectionKey } from 'vue'
import { nanoid } from 'nanoid'
import cloneDeep from 'lodash.clonedeep'
import type {
  GanttTask,
  FlatGanttTask,
  GanttColumn,
  GanttScale,
  GanttSnapMode,
  GanttStatusStyle,
  GanttLayoutMode
} from '../types/gantt'
import {
  GanttEngine,
  MoveTaskCommand,
  BatchCommand,
  CreateDependencyCommand,
  RemoveDependencyCommand,
  ChangeDependencyTypeCommand,
  SetDependencyLagCommand,
  ReadOnlyConstraint,
  DateOrderConstraint,
  DependencyConstraint,
  OverlapConstraint
} from '../core'
import type { EngineState, GanttTaskSnapshot, ResourceNode, ValidationItem, Scenario } from '../core/types'
import { flattenTasks, flattenResources } from '../utils/gantt'
import {
  parseLocalDate,
  addDays,
  addMonths,
  diffDays,
  diffWeeks,
  diffMonths,
  startOfMonth,
  formatLocalDate
} from '../utils/date'
import { computeDateRange, computeActiveDates } from '../core/layout'
import type { GanttEventBus } from './useGanttPlugin'

function toGanttTask(snapshot: GanttTaskSnapshot): GanttTask {
  return {
    id: snapshot.id,
    name: snapshot.name,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    resourceId: snapshot.resourceId,
    status: snapshot.status,
    progress: snapshot.progress,
    type: snapshot.type,
    readOnly: snapshot.readOnly,
    disabled: snapshot.disabled,
    dependencies: snapshot.dependencies ? [...snapshot.dependencies] : undefined,
    dependencyTypes: snapshot.dependencyTypes ? { ...snapshot.dependencyTypes } : undefined,
    dependencyLags: snapshot.dependencyLags ? { ...snapshot.dependencyLags } : undefined,
    children: snapshot.children ? snapshot.children.map(toGanttTask) : undefined
  }
}

function toSnapshot(task: GanttTask): GanttTaskSnapshot {
  return {
    id: task.id,
    name: task.name,
    startDate: formatLocalDate(parseLocalDate(task.startDate)),
    endDate: formatLocalDate(parseLocalDate(task.endDate)),
    resourceId: task.resourceId != null ? String(task.resourceId) : undefined,
    status: task.status,
    progress: task.progress,
    type: task.type,
    readOnly: task.readOnly,
    disabled: task.disabled,
    dependencies: task.dependencies ? [...task.dependencies] : undefined,
    dependencyTypes: task.dependencyTypes ? { ...task.dependencyTypes } : undefined,
    dependencyLags: task.dependencyLags ? { ...task.dependencyLags } : undefined,
    children: task.children ? task.children.map(toSnapshot) : undefined
  }
}

export function createGanttStore(eventBus: GanttEventBus) {
  const engine = new GanttEngine()

  // Register default constraints
  engine.constraintEngine.register(ReadOnlyConstraint)
  engine.constraintEngine.register(DateOrderConstraint)
  engine.constraintEngine.register(DependencyConstraint)
  engine.constraintEngine.register(OverlapConstraint)

  // ========== Vue reactive state ==========
  const tasks = ref<GanttTask[]>([])
  const columns = ref<GanttColumn[]>([
    { field: 'name', label: 'Task Name', width: 250, tree: true }
  ])
  const scale = ref<GanttScale>('day')
  const scrollTop = ref(0)
  const scrollLeft = ref(0)
  const viewportHeight = ref(500)
  const viewportWidth = ref(800)
  const rowHeight = ref(40)
  const readOnly = ref(false)
  const editable = ref(true)
  const multiSelect = ref(true)
  const snapMode = ref<GanttSnapMode>('day')
  const weekStartsOn = ref(1)
  const selectedTaskIds = ref<(string | number)[]>([])
  const linkingSourceTaskId = ref<string | number | null>(null)
  const statusStyleMap = ref<Record<string, GanttStatusStyle>>({})
  const nonWorkingWeekdays = ref<number[]>([0, 6])
  const holidays = ref<string[]>([])
  const hideHolidays = ref(false)
  const showBaseline = ref(false)
  const showTodayLine = ref(true)
  const isTimelineExpanding = ref(false)
  const activeTooltipTask = ref<FlatGanttTask | null>(null)
  const tooltipPosition = ref({ x: 0, y: 0 })
  const manualStartDate = ref<Date | null>(null)
  const manualEndDate = ref<Date | null>(null)

  // ========== Resource mode state ==========
  const layoutMode = ref<GanttLayoutMode>('task')
  const resources = ref<ResourceNode[]>([])
  const expandedResourceIds = ref<Set<string>>(new Set())

  // ========== Scenario state ==========
  const scenarios = ref<Scenario[]>([])
  const scenarioSnapshots = ref<Map<string, GanttTaskSnapshot[]>>(new Map())
  const activeScenarioId = ref<string | null>(null)
  const compareScenarioId = ref<string | null>(null)

  const saveScenario = (name: string) => {
    const state = engine.getState()
    const scenario: Scenario = {
      id: nanoid(),
      name,
      createdAt: Date.now(),
      isBaseline: scenarios.value.length === 0,
      patches: []
    }
    scenarios.value = [...scenarios.value, scenario]
    const next = new Map(scenarioSnapshots.value)
    next.set(scenario.id, cloneDeep(state.tasks))
    scenarioSnapshots.value = next
    if (scenario.isBaseline) activeScenarioId.value = scenario.id
    return scenario
  }

  const duplicateScenario = (sourceId: string, name: string) => {
    const sourceSnapshots = scenarioSnapshots.value.get(sourceId)
    if (!sourceSnapshots) return null
    const scenario: Scenario = {
      id: nanoid(),
      name,
      createdAt: Date.now(),
      isBaseline: false,
      patches: []
    }
    scenarios.value = [...scenarios.value, scenario]
    const next = new Map(scenarioSnapshots.value)
    next.set(scenario.id, cloneDeep(sourceSnapshots))
    scenarioSnapshots.value = next
    return scenario
  }

  const switchScenario = (scenarioId: string) => {
    const snapshots = scenarioSnapshots.value.get(scenarioId)
    if (!snapshots) return false
    const state = engine.getState()
    engine.setState({ ...state, tasks: cloneDeep(snapshots) })
    tasks.value = engine.getState().tasks.map(toGanttTask)
    activeScenarioId.value = scenarioId
    runPostValidation()
    return true
  }

  const deleteScenario = (scenarioId: string) => {
    if (scenarios.value.length <= 1) return false
    scenarios.value = scenarios.value.filter(s => s.id !== scenarioId)
    const next = new Map(scenarioSnapshots.value)
    next.delete(scenarioId)
    scenarioSnapshots.value = next
    if (activeScenarioId.value === scenarioId) {
      const nextScenario = scenarios.value[scenarios.value.length - 1]
      activeScenarioId.value = nextScenario.id
      switchScenario(nextScenario.id)
    }
    if (compareScenarioId.value === scenarioId) {
      compareScenarioId.value = null
    }
    return true
  }

  const setCompareScenario = (scenarioId: string | null) => {
    compareScenarioId.value = scenarioId
  }

  const compareTasks = computed(() => {
    if (!compareScenarioId.value) return []
    const snapshots = scenarioSnapshots.value.get(compareScenarioId.value)
    if (!snapshots) return []
    return snapshots.map(toGanttTask)
  })

  const scenarioDiff = computed(() => {
    if (!compareScenarioId.value) return new Map<string | number, string[]>()
    const snapshots = scenarioSnapshots.value.get(compareScenarioId.value)
    if (!snapshots) return new Map()
    const active = engine.getState().tasks
    const diff = new Map<string | number, string[]>()
    const activeMap = new Map(active.map(t => [t.id, t]))
    for (const ct of snapshots) {
      const at = activeMap.get(ct.id)
      if (!at) continue
      const changes: string[] = []
      if (at.startDate !== ct.startDate) changes.push('startDate')
      if (at.endDate !== ct.endDate) changes.push('endDate')
      if (changes.length > 0) diff.set(ct.id, changes)
    }
    return diff
  })

  // ========== Conflict visualization state ==========
  const conflicts = ref<Map<string | number, ValidationItem[]>>(new Map())

  function runPostValidation() {
    syncTasksToEngine(tasks.value)
    const state = engine.getState()
    const result = engine.constraintEngine.postValidate(state.tasks, {
      tasks: new Map(state.tasks.map(t => [t.id, t])),
      resources: new Map(state.resources.map(r => [r.id, r])),
      flatTasks: state.tasks.map(t => ({ ...t, _level: 0, _hasChildren: false, _visible: true }))
    })
    const next = new Map<string | number, ValidationItem[]>()
    for (const item of result.items) {
      for (const tid of item.taskIds ?? []) {
        if (!next.has(tid)) next.set(tid, [])
        next.get(tid)!.push(item)
      }
    }
    conflicts.value = next
  }

  // Engine state sync -> Vue refs
  engine.subscribe((state: Readonly<EngineState>) => {
    tasks.value = state.tasks.map(toGanttTask)
    // resources and scenarios accessible via engine.getState() when needed
  })

  // Sync raw tasks to engine (called from GanttLayout watcher)
  function syncTasksToEngine(rawTasks: GanttTask[]) {
    const state = engine.getState()
    const newState: EngineState = {
      ...state,
      tasks: rawTasks.map(toSnapshot)
    }
    engine.setState(newState)
  }

  // ========== Computed (unchanged) ==========
  const columnWidth = computed(() => {
    if (scale.value === 'month') return 180
    if (scale.value === 'week') return 120
    return 44
  })

  const flatTasks = computed(() => {
    const result = flattenTasks(tasks.value)
    if (layoutMode.value === 'resource') {
      const resourceMap = new Map<string, number>()
      const rows = resourceRows.value
      for (let i = 0; i < rows.length; i++) {
        resourceMap.set(rows[i].id, i)
      }
      return result.map(t => ({
        ...t,
        _resourceIndex: t.resourceId != null ? resourceMap.get(String(t.resourceId)) : undefined,
        _rowType: 'task' as const
      })) as FlatGanttTask[]
    }
    return result
  })
  const allVisibleTasks = computed(() => flatTasks.value.filter((task) => task._visible))

  // Resource hierarchy
  const resourceRows = computed(() => {
    const expanded = new Set(expandedResourceIds.value)
    const enriched = resources.value.map(r => ({
      ...r,
      expanded: expanded.has(r.id) || expanded.size === 0
    }))
    return flattenResources(enriched).rows
  })

  const toggleResource = (resourceId: string) => {
    const next = new Set(expandedResourceIds.value)
    if (next.has(resourceId)) {
      next.delete(resourceId)
    } else {
      next.add(resourceId)
    }
    expandedResourceIds.value = next
  }

  // Resource load computation
  const resourceLoadMap = computed(() => {
    const map = new Map<string, { taskCount: number; totalDays: number; utilization: number; utilPercent: number }>()
    const resMap = new Map<string, ResourceNode>()
    const collect = (nodes: ResourceNode[]) => {
      for (const r of nodes) {
        resMap.set(r.id, r)
        if (r.children) collect(r.children)
      }
    }
    collect(resources.value)

    // Calculate visible window days
    const windowDays = Math.max(1, diffDays(computedDateRange.value.startDate, computedDateRange.value.endDate))

    const resTasks = new Map<string, { count: number; days: number }>()
    for (const t of allVisibleTasks.value) {
      if (t.resourceId != null) {
        const rid = String(t.resourceId)
        if (!resTasks.has(rid)) resTasks.set(rid, { count: 0, days: 0 })
        const entry = resTasks.get(rid)!
        entry.count++
        const s = parseLocalDate(t.startDate)
        const e = parseLocalDate(t.endDate)
        entry.days += Math.max(1, diffDays(s, e) + 1)
      }
    }

    for (const [rid, entry] of resTasks) {
      const resource = resMap.get(rid)
      const capacityPerDay = resource?.capacity?.default ?? 1
      const totalCapacityDays = capacityPerDay * windowDays
      const utilization = totalCapacityDays > 0 ? entry.days / totalCapacityDays : 0
      map.set(rid, {
        taskCount: entry.count,
        totalDays: entry.days,
        utilization,
        utilPercent: Math.round(utilization * 100)
      })
    }
    return map
  })

  const taskNodeMap = computed(() => {
    const map = new Map<string | number, GanttTask>()
    const walk = (nodes: GanttTask[]) => {
      for (const node of nodes) {
        map.set(node.id, node)
        if (Array.isArray(node.children) && node.children.length > 0) {
          walk(node.children)
        }
      }
    }
    walk(tasks.value)
    return map
  })

  const computedDateRange = computed(() =>
    computeDateRange(
      flatTasks.value.map(t => ({
        startDate: String(t.startDate),
        endDate: String(t.endDate)
      })),
      scale.value,
      {
        weekStartsOn: weekStartsOn.value,
        manualStartDate: manualStartDate.value,
        manualEndDate: manualEndDate.value,
        paddingDays: 7
      }
    )
  )

  const startDate = computed(() => computedDateRange.value.startDate)
  const endDate = computed(() => computedDateRange.value.endDate)
  const today = computed(() => parseLocalDate(new Date()))
  const isResourceMode = computed(() => layoutMode.value === 'resource')

  const totalHeight = computed(() => {
    if (isResourceMode.value) return resourceRows.value.length * rowHeight.value
    return allVisibleTasks.value.length * rowHeight.value
  })

  const rowCount = computed(() => {
    if (isResourceMode.value) return resourceRows.value.length
    return allVisibleTasks.value.length
  })

  const startIndex = computed(() => Math.floor(scrollTop.value / rowHeight.value))
  const endIndex = computed(() =>
    Math.min(rowCount.value, Math.ceil((scrollTop.value + viewportHeight.value) / rowHeight.value))
  )
  const bufferSize = 2
  const renderStartIndex = computed(() => Math.max(0, startIndex.value - bufferSize))
  const renderEndIndex = computed(() => Math.min(rowCount.value, endIndex.value + bufferSize))

  const visibleTasks = computed(() => {
    if (isResourceMode.value) {
      // In resource mode, show resource rows and their tasks
      const slice = resourceRows.value.slice(renderStartIndex.value, renderEndIndex.value)
      const taskMap = new Map<string, FlatGanttTask[]>()
      for (const t of allVisibleTasks.value) {
        if (t.resourceId != null) {
          const key = String(t.resourceId)
          if (!taskMap.has(key)) taskMap.set(key, [])
          taskMap.get(key)!.push(t)
        }
      }
      return allVisibleTasks.value.filter(t => {
        if (t.resourceId == null) return false
        const key = String(t.resourceId)
        return slice.some(r => r.id === key)
      })
    }
    return allVisibleTasks.value.slice(renderStartIndex.value, renderEndIndex.value)
  })

  const visibleResourceRows = computed(() => {
    if (!isResourceMode.value) return []
    return resourceRows.value.slice(renderStartIndex.value, renderEndIndex.value)
  })
  const offsetY = computed(() => renderStartIndex.value * rowHeight.value)

  const startColIndex = computed(() => Math.floor(scrollLeft.value / columnWidth.value))
  const endColIndex = computed(() => Math.ceil((scrollLeft.value + viewportWidth.value) / columnWidth.value))
  const renderStartColIndex = computed(() => Math.max(0, startColIndex.value - bufferSize))

  const isHoliday = (date: Date) => holidays.value.includes(formatLocalDate(parseLocalDate(date)))
  const isNonWorkingDay = (date: Date) => {
    if (scale.value !== 'day') return false
    return nonWorkingWeekdays.value.includes(date.getDay()) || isHoliday(date)
  }

  const activeDates = computed(() =>
    computeActiveDates(startDate.value, endDate.value, scale.value, {
      hideHolidays: hideHolidays.value,
      isNonWorkingDay
    })
  )

  const totalCols = computed(() => activeDates.value.length)
  const renderEndColIndex = computed(() => Math.min(totalCols.value, endColIndex.value + bufferSize))
  const visibleDates = computed(() => activeDates.value.slice(renderStartColIndex.value, renderEndColIndex.value))
  const offsetX = computed(() => renderStartColIndex.value * columnWidth.value)
  const totalWidth = computed(() => totalCols.value * columnWidth.value)

  const getVisibleDayIndex = (date: Date) => {
    const d = parseLocalDate(date)
    if (scale.value !== 'day' || !hideHolidays.value) {
      if (scale.value === 'week') return diffWeeks(startDate.value, d, weekStartsOn.value)
      if (scale.value === 'month') return diffMonths(startDate.value, d)
      return diffDays(startDate.value, d)
    }
    const dateStr = formatLocalDate(d)
    const index = activeDates.value.findIndex((ad) => formatLocalDate(ad) >= dateStr)
    return index === -1 ? activeDates.value.length : index
  }

  const getDateByVisibleIndex = (index: number) => {
    if (scale.value !== 'day' || !hideHolidays.value) {
      if (scale.value === 'week') return addDays(startDate.value, index * 7)
      if (scale.value === 'month') return addMonths(startDate.value, index)
      return addDays(startDate.value, index)
    }
    if (index < 0) return activeDates.value[0] || startDate.value
    if (index >= activeDates.value.length) return activeDates.value[activeDates.value.length - 1] || endDate.value
    return activeDates.value[index]
  }

  const getVisibleDaysCount = (start: Date, end: Date) => {
    const s = parseLocalDate(start)
    const e = parseLocalDate(end)
    if (scale.value !== 'day' || !hideHolidays.value) {
      return diffDays(s, e) + 1
    }
    const sStr = formatLocalDate(s)
    const eStr = formatLocalDate(e)
    return activeDates.value.filter((ad) => {
      const adStr = formatLocalDate(ad)
      return adStr >= sStr && adStr <= eStr
    }).length
  }

  const isTaskReadOnly = (task: GanttTask | FlatGanttTask) => {
    return readOnly.value || !editable.value || task.readOnly === true || task.disabled === true
  }

  // ========== Core methods delegated to Engine ==========

  const updateTaskDates = (
    taskId: string | number,
    newStart: string | Date | number,
    newEnd: string | Date | number
  ) => {
    const task = taskNodeMap.value.get(taskId)
    if (!task || isTaskReadOnly(task)) return false

    // Sync current Vue state to Engine before executing command
    syncTasksToEngine(tasks.value)

    const ns = formatLocalDate(parseLocalDate(newStart))
    const ne = formatLocalDate(parseLocalDate(newEnd))

    const cmd = new MoveTaskCommand({ taskId, newStartDate: ns, newEndDate: ne })
    const result = engine.execute(cmd)

    if (!result.ok) {
      const errors = result.items.filter(i => i.severity === 'error')
      for (const item of errors) {
        eventBus.emit('onValidationError', { task, reason: item.message })
      }
      return false
    }

    // Engine successfully updated -> sync back to Vue reactive state
    manualStartDate.value = null
    manualEndDate.value = null
    tasks.value = engine.getState().tasks.map(toGanttTask)
    runPostValidation()
    return true
  }

  const moveTasksByDays = (taskIds: (string | number)[], days: number) => {
    if (taskIds.length === 0) return

    syncTasksToEngine(tasks.value)

    const commands: MoveTaskCommand[] = []
    for (const taskId of taskIds) {
      const task = taskNodeMap.value.get(taskId)
      if (!task || isTaskReadOnly(task)) continue
      const start = parseLocalDate(task.startDate)
      const end = parseLocalDate(task.endDate)
      commands.push(new MoveTaskCommand({
        taskId,
        newStartDate: formatLocalDate(addDays(start, days)),
        newEndDate: formatLocalDate(addDays(end, days))
      }))
    }

    if (commands.length === 0) return

    const batch = new BatchCommand(commands)
    const result = engine.execute(batch)

    if (result.ok) {
      tasks.value = engine.getState().tasks.map(toGanttTask)
      runPostValidation()
    }
  }

  const moveSelectedTasks = (direction: 1 | -1) => {
    const unit = snapMode.value === 'week' ? 7 : snapMode.value === 'month' ? 30 : 1
    moveTasksByDays([...selectedTaskIds.value], direction * unit)
  }

  const beginDependencyLink = (taskId: string | number) => {
    const task = taskNodeMap.value.get(taskId)
    if (!task) return
    linkingSourceTaskId.value = taskId
  }

  const completeDependencyLink = (targetTaskId: string | number) => {
    const sourceId = linkingSourceTaskId.value
    linkingSourceTaskId.value = null
    if (sourceId === null) return false
    if (sourceId === targetTaskId) return false

    const targetTask = taskNodeMap.value.get(targetTaskId)
    if (!targetTask) return false

    // Sync current Vue state to Engine
    syncTasksToEngine(tasks.value)

    const cmd = new CreateDependencyCommand({ sourceId, targetId: targetTaskId })
    const result = engine.execute(cmd)

    if (result.ok) {
      tasks.value = engine.getState().tasks.map(toGanttTask)
      eventBus.emit('onDependencyCreate', { sourceId, targetId: targetTaskId })
      runPostValidation()
      return true
    }

    const errors = result.items.filter(i => i.severity === 'error')
    for (const item of errors) {
      eventBus.emit('onValidationError', { task: targetTask, reason: item.message })
    }
    return false
  }

  const removeDependency = (sourceId: string | number, targetId: string | number) => {
    syncTasksToEngine(tasks.value)
    const cmd = new RemoveDependencyCommand({ sourceId, targetId })
    const result = engine.execute(cmd)
    if (result.ok) {
      tasks.value = engine.getState().tasks.map(toGanttTask)
      runPostValidation()
      return true
    }
    return false
  }

  const changeDependencyType = (sourceId: string | number, targetId: string | number, newType: 'FS' | 'SS' | 'FF' | 'SF') => {
    syncTasksToEngine(tasks.value)
    const cmd = new ChangeDependencyTypeCommand({ sourceId, targetId, newType })
    const result = engine.execute(cmd)
    if (result.ok) {
      tasks.value = engine.getState().tasks.map(toGanttTask)
      return true
    }
    return false
  }

  const setDependencyLag = (sourceId: string | number, targetId: string | number, lag: number) => {
    syncTasksToEngine(tasks.value)
    const cmd = new SetDependencyLagCommand({ sourceId, targetId, lag })
    const result = engine.execute(cmd)
    if (result.ok) {
      tasks.value = engine.getState().tasks.map(toGanttTask)
      runPostValidation()
      return true
    }
    return false
  }

  const undo = () => {
    syncTasksToEngine(tasks.value)
    const result = engine.undo()
    if (result) {
      tasks.value = engine.getState().tasks.map(toGanttTask)
      runPostValidation()
    }
  }

  const redo = () => {
    syncTasksToEngine(tasks.value)
    const result = engine.redo()
    if (result) {
      tasks.value = engine.getState().tasks.map(toGanttTask)
      runPostValidation()
    }
  }

  // ========== Unchanged methods ==========

  const selectTask = (taskId: string | number, options?: { append?: boolean; toggle?: boolean }) => {
    const task = taskNodeMap.value.get(taskId)
    if (!task || task.selectable === false) return

    if (!multiSelect.value || !options?.append) {
      selectedTaskIds.value = [taskId]
      eventBus.emit('onSelectionChange', { selectedTaskIds: selectedTaskIds.value })
      return
    }
    if (options.toggle) {
      const exists = selectedTaskIds.value.includes(taskId)
      selectedTaskIds.value = exists ? selectedTaskIds.value.filter(id => id !== taskId) : [...selectedTaskIds.value, taskId]
      eventBus.emit('onSelectionChange', { selectedTaskIds: selectedTaskIds.value })
      return
    }
    if (!selectedTaskIds.value.includes(taskId)) {
      selectedTaskIds.value = [...selectedTaskIds.value, taskId]
      eventBus.emit('onSelectionChange', { selectedTaskIds: selectedTaskIds.value })
    }
  }

  const clearSelection = () => {
    selectedTaskIds.value = []
    eventBus.emit('onSelectionChange', { selectedTaskIds: selectedTaskIds.value })
  }

  const toggleTask = (taskId: string | number) => {
    const node = taskNodeMap.value.get(taskId)
    if (!node) return
    node.expanded = node.expanded !== false ? false : true
    eventBus.emit('onTaskToggle', { task: node, expanded: node.expanded })
  }

  const showTooltip = (task: FlatGanttTask, event: MouseEvent) => {
    activeTooltipTask.value = task
    tooltipPosition.value = { x: event.clientX, y: event.clientY }
  }
  const hideTooltip = () => { activeTooltipTask.value = null }
  const updateTooltipPosition = (event: MouseEvent) => {
    if (activeTooltipTask.value) tooltipPosition.value = { x: event.clientX, y: event.clientY }
  }

  const expandStartDate = (days: number) => {
    isTimelineExpanding.value = true
    const current = computedDateRange.value.startDate
    manualStartDate.value = scale.value === 'month'
      ? addMonths(startOfMonth(current), -Math.max(1, Math.round(days / 30)))
      : addDays(current, -days)
    if (!manualEndDate.value) manualEndDate.value = computedDateRange.value.endDate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { isTimelineExpanding.value = false })
    })
  }
  const expandEndDate = (days: number) => {
    isTimelineExpanding.value = true
    const current = computedDateRange.value.endDate
    const monthStep = Math.max(1, Math.round(days / 30))
    const nextMonth = addMonths(startOfMonth(current), monthStep)
    manualEndDate.value = scale.value === 'month'
      ? new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)
      : addDays(current, days)
    if (!manualStartDate.value) manualStartDate.value = computedDateRange.value.startDate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { isTimelineExpanding.value = false })
    })
  }
  const prependTimeline = (days: number) => expandStartDate(days)
  const appendTimeline = (days: number) => expandEndDate(days)

  const setConfig = (config: {
    readOnly?: boolean; editable?: boolean; multiSelect?: boolean
    snapMode?: GanttSnapMode; weekStartsOn?: number
    statusStyleMap?: Record<string, GanttStatusStyle>
    nonWorkingWeekdays?: number[]; holidays?: string[]
    hideHolidays?: boolean; showBaseline?: boolean; showTodayLine?: boolean
  }) => {
    if (typeof config.readOnly === 'boolean') readOnly.value = config.readOnly
    if (typeof config.editable === 'boolean') editable.value = config.editable
    if (typeof config.multiSelect === 'boolean') multiSelect.value = config.multiSelect
    if (config.snapMode) snapMode.value = config.snapMode
    if (typeof config.weekStartsOn === 'number') weekStartsOn.value = config.weekStartsOn
    if (config.statusStyleMap) statusStyleMap.value = config.statusStyleMap
    if (config.nonWorkingWeekdays) nonWorkingWeekdays.value = config.nonWorkingWeekdays
    if (config.holidays) holidays.value = config.holidays
    if (typeof config.hideHolidays === 'boolean') hideHolidays.value = config.hideHolidays
    if (typeof config.showBaseline === 'boolean') showBaseline.value = config.showBaseline
    if (typeof config.showTodayLine === 'boolean') showTodayLine.value = config.showTodayLine
  }

  return {
    tasks, columns, scale, flatTasks, allVisibleTasks, visibleTasks, totalHeight, offsetY,
    scrollTop, scrollLeft, viewportHeight, viewportWidth, rowHeight,
    startDate, endDate, columnWidth, totalWidth, visibleDates, offsetX, today,
    isTimelineExpanding, activeTooltipTask, tooltipPosition,
    showTooltip, hideTooltip, updateTooltipPosition,
    expandStartDate, expandEndDate, prependTimeline, appendTimeline,
    readOnly, editable, multiSelect, snapMode, weekStartsOn,
    selectedTaskIds, linkingSourceTaskId, statusStyleMap,
    nonWorkingWeekdays, holidays, hideHolidays, showBaseline, showTodayLine,
    isTaskReadOnly, isNonWorkingDay, isHoliday,
    getVisibleDayIndex, getDateByVisibleIndex, getVisibleDaysCount,
    selectTask, clearSelection, beginDependencyLink, completeDependencyLink,
    removeDependency, changeDependencyType, setDependencyLag,
    moveSelectedTasks, moveTasksByDays, undo, redo, setConfig, toggleTask, updateTaskDates,
    // Resource mode
    layoutMode, resources, resourceRows, visibleResourceRows, isResourceMode,
    toggleResource, resourceLoadMap,
    // Conflict visualization
    conflicts,
    getTaskConflicts: (taskId: string | number) => conflicts.value.get(taskId) ?? [],
    // Scenario management
    scenarios, activeScenarioId, compareScenarioId, compareTasks, scenarioDiff,
    saveScenario, duplicateScenario, switchScenario, deleteScenario, setCompareScenario
  }
}

export type GanttStore = ReturnType<typeof createGanttStore>
const GanttStoreKey: InjectionKey<GanttStore> = Symbol('GanttStore')

export function provideGanttStore(eventBus: GanttEventBus) {
  const store = createGanttStore(eventBus)
  provide(GanttStoreKey, store)
  return store
}

export function useGanttStore(): GanttStore {
  const store = inject(GanttStoreKey)
  if (!store) {
    throw new Error('useGanttStore must be used within a component that provides it.')
  }
  return store
}
