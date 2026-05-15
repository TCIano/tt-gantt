# APS Gantt Architecture Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract headless core (zero Vue dependency) with Command pattern, ConstraintEngine, Resource model, and PluginSystem; adapt useGanttStore as thin Vue wrapper.

**Architecture:** New `src/core/` directory with pure TypeScript classes/functions. Existing `useGanttStore` becomes a ~60-line Vue reactive adapter that delegates to `GanttEngine`. All existing components unchanged.

**Tech Stack:** TypeScript, nanoid, lodash.clonedeep, lodash.merge, Vitest

**Spec:** `docs/superpowers/specs/2026-05-14-aps-gantt-architecture-phase1-design.md`

---

### Task 1: Install dependencies

**Files:**
- Modify: `packages/tt-gantt/package.json`

- [ ] **Step 1: Add nanoid and lodash dependencies**

```bash
Set-Location -LiteralPath "packages\tt-gantt"; pnpm add nanoid lodash.clonedeep lodash.merge
```

- [ ] **Step 2: Verify install**

```bash
Get-Content -LiteralPath "packages\tt-gantt\package.json" | Select-String "nanoid|lodash"
```

---

### Task 2: Create core/types.ts

**Files:**
- Create: `packages/tt-gantt/src/core/types.ts`

- [ ] **Step 1: Write types file**

Write the complete core types file with Resource, Command, Constraint, Scenario, and supporting types.

```ts
// ========== Core Domain Types (zero Vue dependency) ==========

// --- ID helpers ---
export type ResourceId = string
export type TaskId = string | number
export type ConstraintId = string
export type CommandId = string
export type ScenarioId = string

// ========== Resource Model ==========

export interface ResourceNode {
  id: ResourceId
  name: string
  type: ResourceType
  children?: ResourceNode[]
  capacity?: ResourceCapacity
  calendar?: ResourceCalendar
}

export type ResourceType = 'factory' | 'workshop' | 'line' | 'workcenter' | 'machine'

export interface ResourceCapacity {
  default: number
  unit: string
  shifts?: ResourceShift[]
}

export interface ResourceShift {
  name: string
  startHour: number
  endHour: number
  capacityRatio: number
}

export interface ResourceCalendar {
  unavailablePeriods: UnavailablePeriod[]
  maintenanceWindows: MaintenanceWindow[]
}

export interface UnavailablePeriod {
  id: string
  type: 'holiday' | 'shutdown' | 'break'
  start: string
  end: string
  recurring?: 'weekly' | 'monthly'
}

export interface MaintenanceWindow extends UnavailablePeriod {
  type: 'maintenance'
}

// ========== Command Pattern ==========

export interface CommandContext {
  tasks: Map<TaskId, GanttTaskSnapshot>
  resources: Map<ResourceId, ResourceNode>
  flatTasks: FlatTaskSnapshot[]
}

export interface GanttTaskSnapshot {
  id: TaskId
  name: string
  startDate: string
  endDate: string
  status?: string
  progress?: number
  type?: 'task' | 'group' | 'milestone'
  readOnly?: boolean
  disabled?: boolean
  resourceId?: ResourceId
  dependencies?: TaskId[]
  dependencyTypes?: Partial<Record<TaskId, DependencyType>>
}

export interface FlatTaskSnapshot extends GanttTaskSnapshot {
  _level: number
  _hasChildren: boolean
  _parent?: TaskId
  _visible: boolean
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

export interface Command {
  readonly id: CommandId
  readonly type: string
  readonly timestamp: number
  execute(ctx: CommandContext): ValidationResult
  undo(ctx: CommandContext): void
  canUndo(): boolean
  toPatch(): PatchRecord
}

export interface PatchRecord {
  commandId: CommandId
  commandType: string
  timestamp: number
  before: Record<string, unknown>
  after: Record<string, unknown>
}

// ========== Constraint Engine ==========

export type Severity = 'error' | 'warning' | 'info'

export interface ValidationResult {
  ok: boolean
  items: ValidationItem[]
}

export interface ValidationItem {
  severity: Severity
  code: string
  message: string
  taskIds?: TaskId[]
  resourceIds?: ResourceId[]
  autoFix?: Command
}

export interface Constraint {
  readonly id: ConstraintId
  readonly name: string
  readonly priority: number
  preValidate(task: GanttTaskSnapshot, ctx: CommandContext): ValidationItem[]
  postValidate(tasks: GanttTaskSnapshot[], ctx: CommandContext): ValidationItem[]
}

// ========== Scenario ==========

export interface Scenario {
  id: ScenarioId
  name: string
  description?: string
  createdAt: number
  isBaseline: boolean
  patches: PatchRecord[]
}

// ========== Engine State ==========

export interface EngineState {
  tasks: GanttTaskSnapshot[]
  resources: ResourceNode[]
  scenarios: Scenario[]
  activeScenarioId: ScenarioId | null
  historyDepth: number
  futureDepth: number
}

// ========== Engine Events ==========

export type EngineListener = (state: Readonly<EngineState>) => void

// ========== Plugin ==========

export interface GanttPlugin {
  name: string
  install(engine: GanttEngineLike): void
  uninstall?(): void
}

export interface GanttEngineLike {
  getState(): Readonly<EngineState>
  execute(cmd: Command): ValidationResult
  undo(): ValidationResult | null
  redo(): ValidationResult | null
  subscribe(fn: EngineListener): () => void
  readonly constraintEngine: ConstraintEngineLike
  readonly pluginSystem: PluginSystemLike
}

export interface ConstraintEngineLike {
  register(rule: Constraint): void
  unregister(ruleId: string): boolean
  preValidate(task: GanttTaskSnapshot, ctx: CommandContext): ValidationResult
  postValidate(tasks: GanttTaskSnapshot[], ctx: CommandContext): ValidationResult
}

export interface PluginSystemLike {
  register(plugin: GanttPlugin): void
  uninstall(pluginId: string): boolean
}

// ========== Adapter types ==========

export interface GanttDTO {
  tasks: GanttTaskDTO[]
  resources?: ResourceDTO[]
  scenarios?: ScenarioDTO[]
}

export interface GanttTaskDTO {
  id: TaskId
  name: string
  startDate: string
  endDate: string
  resourceId?: ResourceId
  dependencies?: TaskId[]
  dependencyTypes?: Record<TaskId, DependencyType>
  status?: string
  progress?: number
  type?: 'task' | 'group' | 'milestone'
  readOnly?: boolean
  disabled?: boolean
  children?: GanttTaskDTO[]
}

export interface ResourceDTO {
  id: ResourceId
  name: string
  type: ResourceType
  children?: ResourceDTO[]
  capacity?: ResourceCapacity
  calendar?: ResourceCalendar
}

export interface ScenarioDTO {
  id: ScenarioId
  name: string
  description?: string
  isBaseline: boolean
  createdAt: number
  patches: PatchRecord[]
}
```

- [ ] **Step 2: Verify file compiles**

```bash
Set-Location -LiteralPath "packages\tt-gantt"; npx tsc --noEmit --strict src/core/types.ts
```

---

### Task 3: Create core/Command.ts

**Files:**
- Create: `packages/tt-gantt/src/core/Command.ts`

- [ ] **Step 1: Write Command abstract class and built-in commands**

```ts
import { nanoid } from 'nanoid'
import type {
  Command,
  CommandContext,
  CommandId,
  GanttTaskSnapshot,
  PatchRecord,
  TaskId,
  ValidationResult,
  ValidationItem,
  DependencyType
} from './types'

// ========== Abstract Base ==========

export abstract class BaseCommand implements Command {
  readonly id: CommandId
  readonly type: string
  readonly timestamp: number

  constructor(type: string) {
    this.id = nanoid()
    this.type = type
    this.timestamp = Date.now()
  }

  abstract execute(ctx: CommandContext): ValidationResult
  abstract undo(ctx: CommandContext): void
  abstract toPatch(): PatchRecord

  canUndo(): boolean {
    return true
  }
}

// ========== MoveTaskCommand ==========

export interface MoveTaskPayload {
  taskId: TaskId
  newStartDate: string
  newEndDate: string
}

export class MoveTaskCommand extends BaseCommand {
  private taskId: TaskId
  private newStartDate: string
  private newEndDate: string
  private prevStartDate: string | null = null
  private prevEndDate: string | null = null

  constructor(payload: MoveTaskPayload) {
    super('MoveTask')
    this.taskId = payload.taskId
    this.newStartDate = payload.newStartDate
    this.newEndDate = payload.newEndDate
  }

  execute(ctx: CommandContext): ValidationResult {
    const task = ctx.tasks.get(this.taskId)
    if (!task) {
      return {
        ok: false,
        items: [{ severity: 'error', code: 'TASK_NOT_FOUND', message: `Task ${this.taskId} not found`, taskIds: [this.taskId] }]
      }
    }

    this.prevStartDate = task.startDate
    this.prevEndDate = task.endDate

    task.startDate = this.newStartDate
    task.endDate = this.newEndDate

    return { ok: true, items: [] }
  }

  undo(ctx: CommandContext): void {
    const task = ctx.tasks.get(this.taskId)
    if (task && this.prevStartDate !== null && this.prevEndDate !== null) {
      task.startDate = this.prevStartDate
      task.endDate = this.prevEndDate
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { taskId: this.taskId, startDate: this.prevStartDate, endDate: this.prevEndDate },
      after: { taskId: this.taskId, startDate: this.newStartDate, endDate: this.newEndDate }
    }
  }
}

// ========== ResizeTaskCommand ==========

export interface ResizeTaskPayload {
  taskId: TaskId
  newStartDate: string
  newEndDate: string
}

export class ResizeTaskCommand extends BaseCommand {
  private taskId: TaskId
  private newStartDate: string
  private newEndDate: string
  private prevStartDate: string | null = null
  private prevEndDate: string | null = null

  constructor(payload: ResizeTaskPayload) {
    super('ResizeTask')
    this.taskId = payload.taskId
    this.newStartDate = payload.newStartDate
    this.newEndDate = payload.newEndDate
  }

  execute(ctx: CommandContext): ValidationResult {
    const task = ctx.tasks.get(this.taskId)
    if (!task) {
      return { ok: false, items: [{ severity: 'error', code: 'TASK_NOT_FOUND', message: `Task ${this.taskId} not found`, taskIds: [this.taskId] }] }
    }

    this.prevStartDate = task.startDate
    this.prevEndDate = task.endDate
    task.startDate = this.newStartDate
    task.endDate = this.newEndDate
    return { ok: true, items: [] }
  }

  undo(ctx: CommandContext): void {
    const task = ctx.tasks.get(this.taskId)
    if (task && this.prevStartDate !== null && this.prevEndDate !== null) {
      task.startDate = this.prevStartDate
      task.endDate = this.prevEndDate
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { taskId: this.taskId, startDate: this.prevStartDate, endDate: this.prevEndDate },
      after: { taskId: this.taskId, startDate: this.newStartDate, endDate: this.newEndDate }
    }
  }
}

// ========== CreateDependencyCommand ==========

export interface CreateDependencyPayload {
  sourceId: TaskId
  targetId: TaskId
  dependencyType?: DependencyType
}

export class CreateDependencyCommand extends BaseCommand {
  private sourceId: TaskId
  private targetId: TaskId
  private dependencyType: DependencyType

  constructor(payload: CreateDependencyPayload) {
    super('CreateDependency')
    this.sourceId = payload.sourceId
    this.targetId = payload.targetId
    this.dependencyType = payload.dependencyType ?? 'FS'
  }

  execute(ctx: CommandContext): ValidationResult {
    const target = ctx.tasks.get(this.targetId)
    if (!target) {
      return { ok: false, items: [{ severity: 'error', code: 'TASK_NOT_FOUND', message: `Target task ${this.targetId} not found`, taskIds: [this.targetId] }] }
    }
    if (!target.dependencies) {
      target.dependencies = []
    }
    if (target.dependencies.includes(this.sourceId)) {
      return { ok: false, items: [{ severity: 'error', code: 'DEP_ALREADY_EXISTS', message: 'Dependency already exists', taskIds: [this.sourceId, this.targetId] }] }
    }
    target.dependencies.push(this.sourceId)
    if (target.dependencyTypes) {
      target.dependencyTypes[this.sourceId] = this.dependencyType
    } else {
      target.dependencyTypes = { [this.sourceId]: this.dependencyType }
    }
    return { ok: true, items: [] }
  }

  undo(ctx: CommandContext): void {
    const target = ctx.tasks.get(this.targetId)
    if (target && target.dependencies) {
      target.dependencies = target.dependencies.filter(d => d !== this.sourceId)
      if (target.dependencyTypes) {
        delete target.dependencyTypes[this.sourceId]
      }
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: {},
      after: { sourceId: this.sourceId, targetId: this.targetId, dependencyType: this.dependencyType }
    }
  }
}

// ========== RemoveDependencyCommand ==========

export interface RemoveDependencyPayload {
  sourceId: TaskId
  targetId: TaskId
}

export class RemoveDependencyCommand extends BaseCommand {
  private sourceId: TaskId
  private targetId: TaskId
  private removedType: DependencyType | undefined

  constructor(payload: RemoveDependencyPayload) {
    super('RemoveDependency')
    this.sourceId = payload.sourceId
    this.targetId = payload.targetId
  }

  execute(ctx: CommandContext): ValidationResult {
    const target = ctx.tasks.get(this.targetId)
    if (!target) {
      return { ok: false, items: [{ severity: 'error', code: 'TASK_NOT_FOUND', message: `Target task ${this.targetId} not found`, taskIds: [this.targetId] }] }
    }
    if (!target.dependencies || !target.dependencies.includes(this.sourceId)) {
      return { ok: false, items: [{ severity: 'error', code: 'DEP_NOT_FOUND', message: 'Dependency not found', taskIds: [this.sourceId, this.targetId] }] }
    }
    this.removedType = target.dependencyTypes?.[this.sourceId]
    target.dependencies = target.dependencies.filter(d => d !== this.sourceId)
    if (target.dependencyTypes) {
      delete target.dependencyTypes[this.sourceId]
    }
    return { ok: true, items: [] }
  }

  undo(ctx: CommandContext): void {
    const target = ctx.tasks.get(this.targetId)
    if (target) {
      if (!target.dependencies) target.dependencies = []
      target.dependencies.push(this.sourceId)
      if (this.removedType) {
        if (!target.dependencyTypes) target.dependencyTypes = {}
        target.dependencyTypes[this.sourceId] = this.removedType
      }
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { sourceId: this.sourceId, targetId: this.targetId },
      after: { removed: true }
    }
  }
}

// ========== BatchCommand ==========

export class BatchCommand extends BaseCommand {
  private children: Command[]
  private executedCount = 0
  private allOk = false

  constructor(children: Command[]) {
    super('BatchCommand')
    this.children = children
  }

  execute(ctx: CommandContext): ValidationResult {
    const allItems: ValidationItem[] = []

    for (const child of this.children) {
      const result = child.execute(ctx)
      allItems.push(...result.items)
      if (!result.ok) {
        this.rollbackExecuted(ctx, allItems.length - result.items.length)
        return { ok: false, items: allItems }
      }
      this.executedCount++
    }

    this.allOk = true
    return { ok: true, items: allItems }
  }

  undo(ctx: CommandContext): void {
    for (let i = this.executedCount - 1; i >= 0; i--) {
      this.children[i].undo(ctx)
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { childCount: this.children.length },
      after: { executedCount: this.executedCount }
    }
  }

  private rollbackExecuted(ctx: CommandContext, startIndex: number): void {
    for (let i = this.executedCount - 1; i >= startIndex; i--) {
      this.children[i].undo(ctx)
    }
  }
}
```

---

### Task 4: Create core/ConstraintEngine.ts

**Files:**
- Create: `packages/tt-gantt/src/core/ConstraintEngine.ts`

- [ ] **Step 1: Write ConstraintEngine class**

```ts
import type {
  Constraint,
  ConstraintEngineLike,
  ValidationResult,
  ValidationItem,
  GanttTaskSnapshot,
  CommandContext
} from './types'

export class ConstraintEngine implements ConstraintEngineLike {
  private rules: Constraint[] = []

  register(rule: Constraint): void {
    const existing = this.rules.findIndex(r => r.id === rule.id)
    if (existing !== -1) {
      this.rules.splice(existing, 1)
    }
    this.rules.push(rule)
    this.rules.sort((a, b) => a.priority - b.priority)
  }

  unregister(ruleId: string): boolean {
    const idx = this.rules.findIndex(r => r.id === ruleId)
    if (idx === -1) return false
    this.rules.splice(idx, 1)
    return true
  }

  getCount(): number {
    return this.rules.length
  }

  preValidate(task: GanttTaskSnapshot, ctx: CommandContext): ValidationResult {
    const allItems: ValidationItem[] = []
    for (const rule of this.rules) {
      const items = rule.preValidate(task, ctx)
      allItems.push(...items)
    }
    const errors = allItems.filter(i => i.severity === 'error')
    return { ok: errors.length === 0, items: allItems }
  }

  postValidate(tasks: GanttTaskSnapshot[], ctx: CommandContext): ValidationResult {
    const allItems: ValidationItem[] = []
    for (const rule of this.rules) {
      const items = rule.postValidate(tasks, ctx)
      allItems.push(...items)
    }
    const errors = allItems.filter(i => i.severity === 'error')
    return { ok: errors.length === 0, items: allItems }
  }
}
```

---

### Task 5: Create core/constraints (5 constraint rules)

**Files:**
- Create: `packages/tt-gantt/src/core/constraints/index.ts`
- Create: `packages/tt-gantt/src/core/constraints/ReadOnlyConstraint.ts`
- Create: `packages/tt-gantt/src/core/constraints/DateOrderConstraint.ts`
- Create: `packages/tt-gantt/src/core/constraints/DependencyConstraint.ts`
- Create: `packages/tt-gantt/src/core/constraints/OverlapConstraint.ts`
- Create: `packages/tt-gantt/src/core/constraints/ResourceCapacityConstraint.ts`

- [ ] **Step 1: Write constraints/index.ts**

```ts
export { ReadOnlyConstraint } from './ReadOnlyConstraint'
export { DateOrderConstraint } from './DateOrderConstraint'
export { DependencyConstraint } from './DependencyConstraint'
export { OverlapConstraint } from './OverlapConstraint'
export { ResourceCapacityConstraint } from './ResourceCapacityConstraint'
```

- [ ] **Step 2: Write ReadOnlyConstraint.ts**

```ts
import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const ReadOnlyConstraint: Constraint = {
  id: 'read-only',
  name: 'ReadOnly Check',
  priority: 100,
  preValidate(task: GanttTaskSnapshot, _ctx: CommandContext): ValidationItem[] {
    if (task.readOnly === true || task.disabled === true) {
      return [{
        severity: 'error',
        code: 'TASK_READONLY',
        message: `Task "${task.name}" is read-only and cannot be modified`,
        taskIds: [task.id]
      }]
    }
    return []
  },
  postValidate(_tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    return []
  }
}
```

- [ ] **Step 3: Write DateOrderConstraint.ts**

```ts
import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const DateOrderConstraint: Constraint = {
  id: 'date-order',
  name: 'Date Order Check',
  priority: 200,
  preValidate(task: GanttTaskSnapshot, _ctx: CommandContext): ValidationItem[] {
    if (task.startDate > task.endDate) {
      return [{
        severity: 'error',
        code: 'DATE_ORDER_INVALID',
        message: `Task "${task.name}" end date (${task.endDate}) is before start date (${task.startDate})`,
        taskIds: [task.id]
      }]
    }
    return []
  },
  postValidate(_tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    return []
  }
}
```

- [ ] **Step 4: Write DependencyConstraint.ts**

```ts
import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const DependencyConstraint: Constraint = {
  id: 'dependency',
  name: 'Dependency Check',
  priority: 300,
  preValidate(task: GanttTaskSnapshot, ctx: CommandContext): ValidationItem[] {
    if (!task.dependencies || task.dependencies.length === 0) return []
    const items: ValidationItem[] = []
    for (const depId of task.dependencies) {
      const depTask = ctx.tasks.get(depId)
      if (!depTask) continue
      if (depTask.endDate < task.startDate) continue
      items.push({
        severity: 'warning',
        code: 'DEP_VIOLATION',
        message: `Task "${task.name}" starts before dependency "${depTask.name}" finishes`,
        taskIds: [task.id, depId]
      })
    }
    return items
  },
  postValidate(_tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    return []
  }
}
```

- [ ] **Step 5: Write OverlapConstraint.ts**

```ts
import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const OverlapConstraint: Constraint = {
  id: 'overlap',
  name: 'Overlap Check',
  priority: 400,
  preValidate(_task: GanttTaskSnapshot, _ctx: CommandContext): ValidationItem[] {
    return []
  },
  postValidate(tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    const items: ValidationItem[] = []
    const grouped = new Map<string, GanttTaskSnapshot[]>()
    for (const t of tasks) {
      const key = t.resourceId ?? '__no_resource__'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(t)
    }
    for (const [resourceId, resourceTasks] of grouped) {
      if (resourceId === '__no_resource__') continue
      for (let i = 0; i < resourceTasks.length; i++) {
        for (let j = i + 1; j < resourceTasks.length; j++) {
          const a = resourceTasks[i]
          const b = resourceTasks[j]
          if (a.endDate < b.startDate || b.endDate < a.startDate) continue
          items.push({
            severity: 'warning',
            code: 'TASK_OVERLAP',
            message: `Tasks "${a.name}" and "${b.name}" overlap on resource ${resourceId}`,
            taskIds: [a.id, b.id],
            resourceIds: [resourceId]
          })
        }
      }
    }
    return items
  }
}
```

- [ ] **Step 6: Write ResourceCapacityConstraint.ts**
    This is a stub for Phase 2 — registers at priority 500 and returns empty results.

```ts
import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const ResourceCapacityConstraint: Constraint = {
  id: 'resource-capacity',
  name: 'Resource Capacity Check',
  priority: 500,
  preValidate(_task: GanttTaskSnapshot, _ctx: CommandContext): ValidationItem[] {
    return []
  },
  postValidate(_tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    return []
  }
}
```

---

### Task 6: Create core/PluginSystem.ts

**Files:**
- Create: `packages/tt-gantt/src/core/PluginSystem.ts`

- [ ] **Step 1: Write PluginSystem**

```ts
import type { GanttPlugin, PluginSystemLike, GanttEngineLike } from './types'

export class PluginSystem implements PluginSystemLike {
  private plugins: Map<string, GanttPlugin> = new Map()
  private engine: GanttEngineLike | null = null

  setEngine(engine: GanttEngineLike): void {
    this.engine = engine
    for (const plugin of this.plugins.values()) {
      plugin.install(engine)
    }
  }

  register(plugin: GanttPlugin): void {
    if (this.plugins.has(plugin.name)) {
      this.uninstall(plugin.name)
    }
    this.plugins.set(plugin.name, plugin)
    if (this.engine) {
      plugin.install(this.engine)
    }
  }

  uninstall(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false
    if (plugin.uninstall) {
      plugin.uninstall()
    }
    this.plugins.delete(pluginId)
    return true
  }

  getCount(): number {
    return this.plugins.size
  }
}
```

---

### Task 7: Create core/layout.ts (pure layout calculation functions)

**Files:**
- Create: `packages/tt-gantt/src/core/layout.ts`

- [ ] **Step 1: Write layout.ts**

Extract pure layout calculation functions from existing useGanttBarMetrics composable.

```ts
import type { FlatTaskSnapshot } from './types'

export function getPxPerDay(columnWidth: number, scale: 'day' | 'week' | 'month'): number {
  if (scale === 'week') return columnWidth / 7
  if (scale === 'month') return columnWidth / 30
  return columnWidth
}

export function getBarLeftPx(
  task: FlatTaskSnapshot,
  columnWidth: number,
  getVisibleDayIndex: (date: Date) => number
): number {
  const startD = normalizeDate(task.startDate)
  return getVisibleDayIndex(startD) * columnWidth
}

export function getBarWidthPx(
  task: FlatTaskSnapshot,
  columnWidth: number,
  scale: 'day' | 'week' | 'month',
  getVisibleDayIndex: (date: Date) => number,
  getVisibleDaysCount: (start: Date, end: Date) => number
): number {
  if (task.type === 'milestone') {
    return Math.max(14, columnWidth * 0.35)
  }

  const startD = normalizeDate(task.startDate)
  const endD = normalizeDate(task.endDate)

  if (scale === 'week' || scale === 'month') {
    const span = getVisibleDayIndex(endD) - getVisibleDayIndex(startD) + 1
    return Math.max(columnWidth * 0.25, span * columnWidth)
  }

  const durationDays = getVisibleDaysCount(startD, endD)
  return Math.max(columnWidth * 0.35, durationDays * columnWidth)
}

export function getMinBarWidthPx(columnWidth: number): number {
  return Math.max(10, columnWidth * 0.2)
}

export function getRowTopPx(index: number, rowHeight: number): number {
  return index * rowHeight + 8
}

export function getRowHeight(rowHeight: number): number {
  return rowHeight - 16
}

export function getDependencyPath(
  fromX: number,
  fromY: number,
  fromW: number,
  toX: number,
  toY: number
): { path: string; arrow: string } {
  const startX = fromX + fromW
  const startY = fromY
  const endX = toX
  const endY = toY
  const diffX = endX - startX

  let path: string
  if (diffX > 20) {
    path = `M ${startX},${startY} C ${startX + diffX / 2},${startY} ${endX - diffX / 2},${endY} ${endX},${endY}`
  } else {
    path = `M ${startX},${startY} L ${startX + 10},${startY} C ${startX + 20},${startY} ${startX + 20},${startY + 15} ${startX + 10},${startY + 15} L ${endX - 10},${startY + 15} C ${endX - 20},${startY + 15} ${endX - 20},${endY} ${endX - 10},${endY} L ${endX},${endY}`
  }

  const arrow = `${endX},${endY} ${endX - 6},${endY - 4} ${endX - 6},${endY + 4}`

  return { path, arrow }
}

function normalizeDate(input: string | Date): Date {
  if (input instanceof Date) return stripTime(input)
  return stripTime(new Date(input + (input.includes('T') ? '' : 'T00:00:00')))
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
```

---

### Task 8: Create core/adapter.ts (DTO <-> Domain)

**Files:**
- Create: `packages/tt-gantt/src/core/adapter.ts`

- [ ] **Step 1: Write adapter.ts**

```ts
import cloneDeep from 'lodash.clonedeep'
import type {
  GanttDTO,
  GanttTaskDTO,
  ResourceDTO,
  ScenarioDTO,
  GanttTaskSnapshot,
  ResourceNode,
  Scenario,
  EngineState
} from './types'

export function fromDTO(dto: GanttDTO): EngineState {
  const tasks = dto.tasks.map(toSnapshot)
  const resources = (dto.resources ?? []).map(toResource)
  const scenarios = (dto.scenarios ?? []).map(toScenario)

  return {
    tasks,
    resources,
    scenarios,
    activeScenarioId: scenarios.find(s => s.isBaseline)?.id ?? null,
    historyDepth: 0,
    futureDepth: 0
  }
}

export function toDTO(state: EngineState): GanttDTO {
  return {
    tasks: state.tasks.map(fromSnapshot),
    resources: state.resources.map(fromResource),
    scenarios: state.scenarios.map(fromScenario)
  }
}

function toSnapshot(task: GanttTaskDTO): GanttTaskSnapshot {
  return {
    id: task.id,
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
    resourceId: task.resourceId,
    dependencies: task.dependencies ? [...task.dependencies] : undefined,
    dependencyTypes: task.dependencyTypes ? { ...task.dependencyTypes } : undefined,
    status: task.status,
    progress: task.progress,
    type: task.type,
    readOnly: task.readOnly,
    disabled: task.disabled
  }
}

function fromSnapshot(task: GanttTaskSnapshot): GanttTaskDTO {
  return {
    id: task.id,
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
    resourceId: task.resourceId,
    dependencies: task.dependencies,
    dependencyTypes: task.dependencyTypes,
    status: task.status,
    progress: task.progress,
    type: task.type,
    readOnly: task.readOnly,
    disabled: task.disabled
  }
}

function toResource(dto: ResourceDTO): ResourceNode {
  const node: ResourceNode = {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    capacity: dto.capacity ? cloneDeep(dto.capacity) : undefined,
    calendar: dto.calendar ? cloneDeep(dto.calendar) : undefined
  }
  if (dto.children && dto.children.length > 0) {
    node.children = dto.children.map(toResource)
  }
  return node
}

function fromResource(node: ResourceNode): ResourceDTO {
  const dto: ResourceDTO = {
    id: node.id,
    name: node.name,
    type: node.type,
    capacity: node.capacity ? cloneDeep(node.capacity) : undefined,
    calendar: node.calendar ? cloneDeep(node.calendar) : undefined
  }
  if (node.children && node.children.length > 0) {
    dto.children = node.children.map(fromResource)
  }
  return dto
}

function toScenario(dto: ScenarioDTO): Scenario {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    createdAt: dto.createdAt,
    isBaseline: dto.isBaseline,
    patches: dto.patches ? [...dto.patches] : []
  }
}

function fromScenario(scenario: Scenario): ScenarioDTO {
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    createdAt: scenario.createdAt,
    isBaseline: scenario.isBaseline,
    patches: scenario.patches ? [...scenario.patches] : []
  }
}
```

---

### Task 9: Create core/GanttEngine.ts

**Files:**
- Create: `packages/tt-gantt/src/core/GanttEngine.ts`

- [ ] **Step 1: Write GanttEngine**

```ts
import cloneDeep from 'lodash.clonedeep'
import type {
  EngineState,
  EngineListener,
  Command,
  CommandContext,
  ValidationResult,
  GanttEngineLike,
  ConstraintEngineLike,
  PluginSystemLike
} from './types'
import { ConstraintEngine } from './ConstraintEngine'
import { PluginSystem } from './PluginSystem'

export class CommandBus {
  private history: Command[] = []
  private future: Command[] = []
  private maxHistory = 100

  push(cmd: Command): void {
    this.history.push(cmd)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
    this.future = []
  }

  undo(ctx: CommandContext): Command | null {
    const cmd = this.history.pop()
    if (!cmd) return null
    this.future.push(cmd)
    cmd.undo(ctx)
    return cmd
  }

  redo(ctx: CommandContext): Command | null {
    const cmd = this.future.pop()
    if (!cmd) return null
    this.history.push(cmd)
    cmd.execute(ctx)
    return cmd
  }

  canUndo(): boolean {
    return this.history.length > 0
  }

  canRedo(): boolean {
    return this.future.length > 0
  }

  getHistoryDepth(): number {
    return this.history.length
  }

  getFutureDepth(): number {
    return this.future.length
  }
}

export class GanttEngine implements GanttEngineLike {
  private state: EngineState = {
    tasks: [],
    resources: [],
    scenarios: [],
    activeScenarioId: null,
    historyDepth: 0,
    futureDepth: 0
  }
  private listeners: Set<EngineListener> = new Set()

  readonly commandBus = new CommandBus()
  readonly constraintEngine: ConstraintEngine & ConstraintEngineLike = new ConstraintEngine()
  readonly pluginSystem: PluginSystem & PluginSystemLike

  constructor() {
    this.pluginSystem = new PluginSystem()
    this.pluginSystem.setEngine(this)
  }

  getState(): Readonly<EngineState> {
    return this.state
  }

  setState(state: EngineState): void {
    this.state = cloneDeep(state)
    this._notify()
  }

  execute(cmd: Command): ValidationResult {
    const ctx = this._buildContext()

    const task = this._findTaskForCommand(cmd)
    if (task) {
      const preResult = this.constraintEngine.preValidate(task, ctx)
      const errors = preResult.items.filter(i => i.severity === 'error')
      if (errors.length > 0) {
        return { ok: false, items: preResult.items }
      }
    }

    const result = cmd.execute(ctx)

    if (result.ok) {
      this._applyContext(ctx)
      this.commandBus.push(cmd)

      const postResult = this.constraintEngine.postValidate(this.state.tasks, ctx)
      result.items.push(...postResult.items)
    }

    this._syncDepth()
    this._notify()
    return result
  }

  undo(): ValidationResult | null {
    const ctx = this._buildContext()
    const cmd = this.commandBus.undo(ctx)
    if (!cmd) return null
    this._applyContext(ctx)
    this._syncDepth()
    this._notify()
    return { ok: true, items: [] }
  }

  redo(): ValidationResult | null {
    const ctx = this._buildContext()
    const cmd = this.commandBus.redo(ctx)
    if (!cmd) return null
    this._applyContext(ctx)
    this._syncDepth()
    this._notify()
    return { ok: true, items: [] }
  }

  subscribe(fn: EngineListener): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private _buildContext(): CommandContext {
    return {
      tasks: new Map(this.state.tasks.map(t => [t.id, cloneDeep(t)])),
      resources: new Map(this.state.resources.map(r => [r.id, cloneDeep(r)])),
      flatTasks: this.state.tasks.map(t => ({
        ...cloneDeep(t),
        _level: 0,
        _hasChildren: false,
        _visible: true
      }))
    }
  }

  private _applyContext(ctx: CommandContext): void {
    this.state.tasks = Array.from(ctx.tasks.values())
    this.state.resources = Array.from(ctx.resources.values())
  }

  private _findTaskForCommand(cmd: Command): ReturnType<typeof this.state.tasks.find> {
    const patch = cmd.toPatch()
    const taskId = (patch.before as Record<string, unknown>)?.taskId ?? (patch.after as Record<string, unknown>)?.taskId
    if (taskId == null) return undefined
    return this.state.tasks.find(t => t.id === taskId)
  }

  private _syncDepth(): void {
    this.state.historyDepth = this.commandBus.getHistoryDepth()
    this.state.futureDepth = this.commandBus.getFutureDepth()
  }

  private _notify(): void {
    const snapshot = this.getState()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
```

---

### Task 10: Create core/index.ts barrel export

**Files:**
- Create: `packages/tt-gantt/src/core/index.ts`

- [ ] **Step 1: Write barrel export**

```ts
export * from './types'
export { BaseCommand, MoveTaskCommand, ResizeTaskCommand, CreateDependencyCommand, RemoveDependencyCommand, BatchCommand } from './Command'
export type { MoveTaskPayload, ResizeTaskPayload, CreateDependencyPayload, RemoveDependencyPayload } from './Command'
export { ConstraintEngine } from './ConstraintEngine'
export { PluginSystem } from './PluginSystem'
export { CommandBus, GanttEngine } from './GanttEngine'
export * from './layout'
export { fromDTO, toDTO } from './adapter'
export {
  ReadOnlyConstraint,
  DateOrderConstraint,
  DependencyConstraint,
  OverlapConstraint,
  ResourceCapacityConstraint
} from './constraints'
```

---

### Task 11: Write tests for core/Command

**Files:**
- Create: `packages/tt-gantt/src/core/__tests__/Command.test.ts`

- [ ] **Step 1: Write Command tests**

```ts
import { describe, it, expect } from 'vitest'
import {
  MoveTaskCommand,
  ResizeTaskCommand,
  CreateDependencyCommand,
  RemoveDependencyCommand,
  BatchCommand
} from '../Command'
import type { CommandContext, GanttTaskSnapshot } from '../types'

function makeContext(tasks: GanttTaskSnapshot[]): CommandContext {
  return {
    tasks: new Map(tasks.map(t => [t.id, { ...t }])),
    resources: new Map(),
    flatTasks: tasks.map(t => ({ ...t, _level: 0, _hasChildren: false, _visible: true }))
  }
}

describe('MoveTaskCommand', () => {
  it('moves task dates', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }
    const ctx = makeContext([task])
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })

    const result = cmd.execute(ctx)
    expect(result.ok).toBe(true)
    expect(ctx.tasks.get('1')!.startDate).toBe('2026-01-10')
    expect(ctx.tasks.get('1')!.endDate).toBe('2026-01-15')
  })

  it('undo restores original dates', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }
    const ctx = makeContext([task])
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })

    cmd.execute(ctx)
    cmd.undo(ctx)
    expect(ctx.tasks.get('1')!.startDate).toBe('2026-01-01')
    expect(ctx.tasks.get('1')!.endDate).toBe('2026-01-05')
  })

  it('returns error for missing task', () => {
    const ctx = makeContext([])
    const cmd = new MoveTaskCommand({ taskId: '99', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    const result = cmd.execute(ctx)
    expect(result.ok).toBe(false)
    expect(result.items[0].code).toBe('TASK_NOT_FOUND')
  })

  it('generates patch', () => {
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    const patch = cmd.toPatch()
    expect(patch.commandType).toBe('MoveTask')
    expect(patch.after).toEqual({ taskId: '1', startDate: '2026-01-10', endDate: '2026-01-15' })
  })
})

describe('CreateDependencyCommand', () => {
  it('creates dependency', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10' }
    ]
    const ctx = makeContext(tasks)
    const cmd = new CreateDependencyCommand({ sourceId: '1', targetId: '2' })

    const result = cmd.execute(ctx)
    expect(result.ok).toBe(true)
    expect(ctx.tasks.get('2')!.dependencies).toContain('1')
    expect(ctx.tasks.get('2')!.dependencyTypes!['1']).toBe('FS')
  })

  it('prevents duplicate dependency', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10', dependencies: ['1'] }
    ]
    const ctx = makeContext(tasks)
    const cmd = new CreateDependencyCommand({ sourceId: '1', targetId: '2' })
    const result = cmd.execute(ctx)
    expect(result.ok).toBe(false)
  })

  it('undo removes dependency', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10' }
    ]
    const ctx = makeContext(tasks)
    const cmd = new CreateDependencyCommand({ sourceId: '1', targetId: '2' })
    cmd.execute(ctx)
    cmd.undo(ctx)
    expect(ctx.tasks.get('2')!.dependencies).not.toContain('1')
  })
})

describe('RemoveDependencyCommand', () => {
  it('removes dependency', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10', dependencies: ['1'] }
    ]
    const ctx = makeContext(tasks)
    const cmd = new RemoveDependencyCommand({ sourceId: '1', targetId: '2' })
    const result = cmd.execute(ctx)
    expect(result.ok).toBe(true)
    expect(ctx.tasks.get('2')!.dependencies).not.toContain('1')
  })
})

describe('BatchCommand', () => {
  it('executes multiple commands atomically', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10' }
    ]
    const ctx = makeContext(tasks)
    const batch = new BatchCommand([
      new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }),
      new CreateDependencyCommand({ sourceId: '1', targetId: '2' })
    ])
    const result = batch.execute(ctx)
    expect(result.ok).toBe(true)
    expect(ctx.tasks.get('1')!.startDate).toBe('2026-01-10')
    expect(ctx.tasks.get('2')!.dependencies).toContain('1')
  })

  it('rolls back on failure', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10' }
    ]
    const ctx = makeContext(tasks)
    const batch = new BatchCommand([
      new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }),
      new MoveTaskCommand({ taskId: '99', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }) // fails
    ])
    const result = batch.execute(ctx)
    expect(result.ok).toBe(false)
    expect(ctx.tasks.get('1')!.startDate).toBe('2026-01-01') // rolled back
  })
})
```

- [ ] **Step 2: Run Command tests**

```bash
Set-Location -LiteralPath "packages\tt-gantt"; pnpm test src/core/__tests__/Command.test.ts
```

Expected: All tests pass.

---

### Task 12: Write tests for core/ConstraintEngine

**Files:**
- Create: `packages/tt-gantt/src/core/__tests__/ConstraintEngine.test.ts`

- [ ] **Step 1: Write ConstraintEngine tests**

```ts
import { describe, it, expect } from 'vitest'
import { ConstraintEngine } from '../ConstraintEngine'
import {
  ReadOnlyConstraint,
  DateOrderConstraint,
  DependencyConstraint,
  OverlapConstraint,
  ResourceCapacityConstraint
} from '../constraints'
import type { CommandContext, GanttTaskSnapshot, Constraint } from '../types'

function makeContext(tasks: GanttTaskSnapshot[]): CommandContext {
  return {
    tasks: new Map(tasks.map(t => [t.id, { ...t }])),
    resources: new Map(),
    flatTasks: tasks.map(t => ({ ...t, _level: 0, _hasChildren: false, _visible: true }))
  }
}

describe('ConstraintEngine', () => {
  it('registers and executes rules in priority order', () => {
    const engine = new ConstraintEngine()
    const calls: string[] = []

    const ruleA: Constraint = {
      id: 'a', name: 'A', priority: 200,
      preValidate(t: GanttTaskSnapshot) { calls.push('A'); return [] },
      postValidate() { return [] }
    }
    const ruleB: Constraint = {
      id: 'b', name: 'B', priority: 100,
      preValidate(t: GanttTaskSnapshot) { calls.push('B'); return [] },
      postValidate() { return [] }
    }

    engine.register(ruleA)
    engine.register(ruleB)

    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-05' }
    engine.preValidate(task, makeContext([]))
    expect(calls).toEqual(['B', 'A'])
  })

  it('unregisters rules', () => {
    const engine = new ConstraintEngine()
    engine.register(ReadOnlyConstraint)
    expect(engine.unregister('read-only')).toBe(true)
    expect(engine.unregister('read-only')).toBe(false)
  })

  it('collects errors from all rules', () => {
    const engine = new ConstraintEngine()
    engine.register(ReadOnlyConstraint)
    engine.register(DateOrderConstraint)

    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-10', endDate: '2026-01-01', readOnly: true }
    const result = engine.preValidate(task, makeContext([task]))
    expect(result.ok).toBe(false)
    expect(result.items.length).toBe(2)
    expect(result.items.map(i => i.code)).toContain('TASK_READONLY')
    expect(result.items.map(i => i.code)).toContain('DATE_ORDER_INVALID')
  })
})

describe('ReadOnlyConstraint', () => {
  it('blocks read-only tasks', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-05', readOnly: true }
    const items = ReadOnlyConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(1)
    expect(items[0].code).toBe('TASK_READONLY')
  })

  it('blocks disabled tasks', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-05', disabled: true }
    const items = ReadOnlyConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(1)
  })

  it('allows normal tasks', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-05' }
    const items = ReadOnlyConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(0)
  })
})

describe('DateOrderConstraint', () => {
  it('rejects end before start', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-10', endDate: '2026-01-01' }
    const items = DateOrderConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(1)
    expect(items[0].code).toBe('DATE_ORDER_INVALID')
  })

  it('allows valid date range', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-10' }
    const items = DateOrderConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(0)
  })
})

describe('DependencyConstraint', () => {
  it('warns when successor starts before predecessor finishes', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Predecessor', startDate: '2026-01-01', endDate: '2026-01-10' },
      { id: '2', name: 'Successor', startDate: '2026-01-05', endDate: '2026-01-15', dependencies: ['1'] }
    ]
    const ctx = makeContext(tasks)
    const items = DependencyConstraint.preValidate(tasks[1], ctx)
    expect(items.length).toBe(1)
    expect(items[0].code).toBe('DEP_VIOLATION')
  })

  it('allows valid dependency order', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Predecessor', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Successor', startDate: '2026-01-10', endDate: '2026-01-15', dependencies: ['1'] }
    ]
    const ctx = makeContext(tasks)
    const items = DependencyConstraint.preValidate(tasks[1], ctx)
    expect(items.length).toBe(0)
  })
})

describe('OverlapConstraint', () => {
  it('detects overlapping tasks on same resource', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'A', startDate: '2026-01-01', endDate: '2026-01-10', resourceId: 'r1' },
      { id: '2', name: 'B', startDate: '2026-01-05', endDate: '2026-01-15', resourceId: 'r1' }
    ]
    const items = OverlapConstraint.postValidate(tasks, makeContext([]))
    expect(items.length).toBe(1)
    expect(items[0].code).toBe('TASK_OVERLAP')
  })

  it('allows non-overlapping tasks', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'A', startDate: '2026-01-01', endDate: '2026-01-05', resourceId: 'r1' },
      { id: '2', name: 'B', startDate: '2026-01-10', endDate: '2026-01-15', resourceId: 'r1' }
    ]
    const items = OverlapConstraint.postValidate(tasks, makeContext([]))
    expect(items.length).toBe(0)
  })

  it('allows overlapping on different resources', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'A', startDate: '2026-01-01', endDate: '2026-01-10', resourceId: 'r1' },
      { id: '2', name: 'B', startDate: '2026-01-05', endDate: '2026-01-15', resourceId: 'r2' }
    ]
    const items = OverlapConstraint.postValidate(tasks, makeContext([]))
    expect(items.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run ConstraintEngine tests**

```bash
Set-Location -LiteralPath "packages\tt-gantt"; pnpm test src/core/__tests__/ConstraintEngine.test.ts
```

Expected: All tests pass.

---

### Task 13: Write tests for core/GanttEngine

**Files:**
- Create: `packages/tt-gantt/src/core/__tests__/GanttEngine.test.ts`

- [ ] **Step 1: Write GanttEngine tests**

```ts
import { describe, it, expect } from 'vitest'
import { GanttEngine } from '../GanttEngine'
import { MoveTaskCommand } from '../Command'
import { ReadOnlyConstraint, DateOrderConstraint } from '../constraints'
import { fromDTO } from '../adapter'
import type { GanttDTO } from '../types'

function makeEngine(dto?: GanttDTO): GanttEngine {
  const engine = new GanttEngine()
  if (dto) {
    engine.setState(fromDTO(dto))
  }
  engine.constraintEngine.register(DateOrderConstraint)
  engine.constraintEngine.register(ReadOnlyConstraint)
  return engine
}

describe('GanttEngine', () => {
  it('executes command and updates state', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }]
    })
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    const result = engine.execute(cmd)
    expect(result.ok).toBe(true)
    const state = engine.getState()
    expect(state.tasks[0].startDate).toBe('2026-01-10')
    expect(state.historyDepth).toBe(1)
  })

  it('blocks read-only task modification', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05', readOnly: true }]
    })
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    const result = engine.execute(cmd)
    expect(result.ok).toBe(false)
    const state = engine.getState()
    expect(state.tasks[0].startDate).toBe('2026-01-01') // unchanged
  })

  it('blocks invalid date order', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }]
    })
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-05' })
    const result = engine.execute(cmd)
    expect(result.ok).toBe(false)
    const state = engine.getState()
    expect(state.tasks[0].startDate).toBe('2026-01-01') // unchanged
  })

  it('undo and redo work', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }]
    })
    engine.execute(new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }))

    engine.undo()
    expect(engine.getState().tasks[0].startDate).toBe('2026-01-01')

    engine.redo()
    expect(engine.getState().tasks[0].startDate).toBe('2026-01-10')
  })

  it('subscribes to state changes', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }]
    })

    let captured: Readonly<ReturnType<typeof engine.getState>> | null = null
    engine.subscribe((s) => { captured = s })

    engine.execute(new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }))

    expect(captured).not.toBeNull()
    expect(captured!.tasks[0].startDate).toBe('2026-01-10')
  })
})
```

- [ ] **Step 2: Run GanttEngine tests**

```bash
Set-Location -LiteralPath "packages\tt-gantt"; pnpm test src/core/__tests__/GanttEngine.test.ts
```

Expected: All tests pass.

---

### Task 14: Adapt useGanttStore to use GanttEngine

**Files:**
- Modify: `packages/tt-gantt/src/composables/useGanttStore.ts`

- [ ] **Step 1: Rewrite useGanttStore as Engine adapter**

Replace the current file with the new adapter version.

```ts
import { ref, computed, provide, inject, shallowRef } from 'vue'
import type { InjectionKey, ComputedRef, Ref } from 'vue'
import type {
  GanttTask,
  FlatGanttTask,
  GanttColumn,
  GanttScale,
  GanttSnapMode,
  GanttStatusStyle
} from '../types/gantt'
import {
  GanttEngine,
  MoveTaskCommand,
  ResizeTaskCommand,
  CreateDependencyCommand,
  RemoveDependencyCommand,
  ReadOnlyConstraint,
  DateOrderConstraint
} from '../core'
import type { GanttTaskSnapshot, EngineState } from '../core/types'
import { flattenTasks } from '../utils/gantt'
import {
  parseLocalDate,
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  formatLocalDate
} from '../utils/date'
import type { GanttEventBus } from './useGanttPlugin'

export function createGanttStore(eventBus: GanttEventBus) {
  const engine = new GanttEngine()

  // Register default constraints
  engine.constraintEngine.register(ReadOnlyConstraint)
  engine.constraintEngine.register(DateOrderConstraint)

  // ========== Vue reactive wrappers around Engine state ==========
  const tasks = shallowRef<GanttTask[]>([])
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

  // Sync engine state to Vue refs
  engine.subscribe((state: Readonly<EngineState>) => {
    tasks.value = state.tasks.map(toGanttTask)
    // resources and scenarios are available via state.resources / state.scenarios
  })

  function toGanttTask(snapshot: GanttTaskSnapshot): GanttTask {
    return {
      id: snapshot.id,
      name: snapshot.name,
      startDate: snapshot.startDate,
      endDate: snapshot.endDate,
      status: snapshot.status,
      progress: snapshot.progress,
      type: snapshot.type,
      readOnly: snapshot.readOnly,
      disabled: snapshot.disabled,
      dependencies: snapshot.dependencies ? [...snapshot.dependencies] : undefined,
      dependencyTypes: snapshot.dependencyTypes ? { ...snapshot.dependencyTypes } : undefined
    }
  }

  function toSnapshot(task: GanttTask): GanttTaskSnapshot {
    return {
      id: task.id,
      name: task.name,
      startDate: formatLocalDate(parseLocalDate(task.startDate)),
      endDate: formatLocalDate(parseLocalDate(task.endDate)),
      status: task.status,
      progress: task.progress,
      type: task.type,
      readOnly: task.readOnly,
      disabled: task.disabled,
      dependencies: task.dependencies ? [...task.dependencies] : undefined,
      dependencyTypes: task.dependencyTypes ? { ...task.dependencyTypes } : undefined
    }
  }

  // Initialize engine state from props (will be set via watch in GanttLayout)
  function syncTasksToEngine(rawTasks: GanttTask[]) {
    const state = engine.getState()
    const newState: EngineState = {
      ...state,
      tasks: rawTasks.map(toSnapshot)
    }
    engine.setState(newState)
  }

  // ========== Computed (unchanged from original) ==========
  const columnWidth = computed(() => {
    if (scale.value === 'month') return 180
    if (scale.value === 'week') return 120
    return 44
  })

  const flatTasks = computed(() => flattenTasks(tasks.value))
  const allVisibleTasks = computed(() => flatTasks.value.filter((task) => task._visible))

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

  const computedDateRange = computed(() => {
    let minDate = new Date()
    let maxDate = new Date()
    let hasTasks = false

    for (const task of flatTasks.value) {
      const sDate = parseLocalDate(task.startDate)
      const eDate = parseLocalDate(task.endDate)
      if (!hasTasks) {
        minDate = sDate
        maxDate = eDate
        hasTasks = true
      } else {
        if (sDate < minDate) minDate = sDate
        if (eDate > maxDate) maxDate = eDate
      }
    }

    if (!hasTasks) {
      const now = new Date()
      minDate = new Date(now.getFullYear(), now.getMonth(), 1)
      maxDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    } else {
      minDate = addDays(minDate, -7)
      maxDate = addDays(maxDate, 7)
    }

    if (manualStartDate.value) minDate = manualStartDate.value
    if (manualEndDate.value) maxDate = manualEndDate.value

    if (scale.value === 'week') {
      minDate = startOfWeek(minDate, weekStartsOn.value)
      maxDate = startOfWeek(maxDate, weekStartsOn.value)
      maxDate = addDays(maxDate, 6)
    } else if (scale.value === 'month') {
      minDate = startOfMonth(minDate)
      maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0)
    }

    return { startDate: minDate, endDate: maxDate }
  })

  const startDate = computed(() => computedDateRange.value.startDate)
  const endDate = computed(() => computedDateRange.value.endDate)
  const today = computed(() => parseLocalDate(new Date()))
  const totalHeight = computed(() => allVisibleTasks.value.length * rowHeight.value)
  const totalHeightVal = computed(() => totalHeight.value)

  // Virtual scroll (unchanged)
  const startIndex = computed(() => Math.floor(scrollTop.value / rowHeight.value))
  const endIndex = computed(() =>
    Math.min(allVisibleTasks.value.length, Math.ceil((scrollTop.value + viewportHeight.value) / rowHeight.value))
  )
  const bufferSize = 2
  const renderStartIndex = computed(() => Math.max(0, startIndex.value - bufferSize))
  const renderEndIndex = computed(() => Math.min(allVisibleTasks.value.length, endIndex.value + bufferSize))
  const visibleTasks = computed(() => allVisibleTasks.value.slice(renderStartIndex.value, renderEndIndex.value))
  const offsetY = computed(() => renderStartIndex.value * rowHeight.value)

  // Timeline dates (unchanged)
  const startColIndex = computed(() => Math.floor(scrollLeft.value / columnWidth.value))
  const endColIndex = computed(() => Math.ceil((scrollLeft.value + viewportWidth.value) / columnWidth.value))
  const renderStartColIndex = computed(() => Math.max(0, startColIndex.value - bufferSize))

  const activeDates = computed(() => {
    const dates: Date[] = []
    let current = new Date(startDate.value)
    const end = endDate.value

    if (scale.value === 'week') {
      const weeks = Math.max(1, Math.ceil((end.getTime() - startDate.value.getTime()) / (7 * 86400000)) + 1)
      for (let i = 0; i < weeks; i++) {
        dates.push(addDays(startDate.value, i * 7))
      }
    } else if (scale.value === 'month') {
      const months = Math.max(1, (end.getFullYear() - startDate.value.getFullYear()) * 12 + (end.getMonth() - startDate.value.getMonth()) + 1)
      for (let i = 0; i < months; i++) {
        dates.push(addMonths(startDate.value, i))
      }
    } else {
      while (current <= end) {
        if (!hideHolidays.value || !isNonWorkingDay(current)) {
          dates.push(new Date(current))
        }
        current = addDays(current, 1)
      }
    }
    return dates
  })

  const totalCols = computed(() => activeDates.value.length)
  const renderEndColIndex = computed(() => Math.min(totalCols.value, endColIndex.value + bufferSize))
  const visibleDates = computed(() => activeDates.value.slice(renderStartColIndex.value, renderEndColIndex.value))
  const offsetX = computed(() => renderStartColIndex.value * columnWidth.value)
  const totalWidth = computed(() => totalCols.value * columnWidth.value)

  // ========== Core methods delegated to Engine ==========

  const updateTaskDates = (taskId: string | number, newStart: string | Date | number, newEnd: string | Date | number) => {
    const task = taskNodeMap.value.get(taskId)
    if (!task || isTaskReadOnly(task)) return false

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

    manualStartDate.value = null
    manualEndDate.value = null
    syncTasksToEngine(engine.getState().tasks.map(t => ({ ...taskNodeMap.value.get(t.id)!, startDate: t.startDate, endDate: t.endDate } as GanttTask)))
    return true
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

    const cmd = new CreateDependencyCommand({ sourceId, targetId: targetTaskId })
    const result = engine.execute(cmd)

    if (result.ok) {
      syncTasksToEngine(engine.getState().tasks.map(t => ({ ...taskNodeMap.value.get(t.id)!, startDate: t.startDate, endDate: t.endDate } as GanttTask)))
      eventBus.emit('onDependencyCreate', { sourceId, targetId: targetTaskId })
      return true
    }
    return false
  }

  const undo = () => {
    const result = engine.undo()
    if (result) {
      syncTasksToEngine(engine.getState().tasks.map(t => ({ ...taskNodeMap.value.get(t.id)!, startDate: t.startDate, endDate: t.endDate } as GanttTask)))
    }
  }

  const redo = () => {
    const result = engine.redo()
    if (result) {
      syncTasksToEngine(engine.getState().tasks.map(t => ({ ...taskNodeMap.value.get(t.id)!, startDate: t.startDate, endDate: t.endDate } as GanttTask)))
    }
  }

  // ========== Unchanged methods ==========

  const isTaskReadOnly = (task: GanttTask | FlatGanttTask) => {
    return readOnly.value || !editable.value || task.readOnly === true || task.disabled === true
  }

  const isHoliday = (date: Date) => holidays.value.includes(formatLocalDate(parseLocalDate(date)))
  const isNonWorkingDay = (date: Date) => {
    if (scale.value !== 'day') return false
    return nonWorkingWeekdays.value.includes(date.getDay()) || isHoliday(date)
  }

  const moveTaskByDays = (taskId: string | number, days: number) => {
    const task = taskNodeMap.value.get(taskId)
    if (!task || isTaskReadOnly(task)) return
    const start = parseLocalDate(task.startDate)
    const end = parseLocalDate(task.endDate)
    updateTaskDates(taskId, addDays(start, days), addDays(end, days))
  }

  const moveSelectedTasks = (direction: 1 | -1) => {
    const unit = snapMode.value === 'week' ? 7 : snapMode.value === 'month' ? 30 : 1
    selectedTaskIds.value.forEach((taskId) => moveTaskByDays(taskId, direction * unit))
  }

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

  const getVisibleDayIndex = (date: Date) => {
    const d = parseLocalDate(date)
    if (scale.value !== 'day' || !hideHolidays.value) {
      if (scale.value === 'week') return Math.ceil((d.getTime() - startDate.value.getTime()) / (7 * 86400000))
      if (scale.value === 'month') return (d.getFullYear() - startDate.value.getFullYear()) * 12 + (d.getMonth() - startDate.value.getMonth())
      return Math.ceil((d.getTime() - startDate.value.getTime()) / 86400000)
    }
    const dateStr = formatLocalDate(d)
    const index = activeDates.value.findIndex(ad => formatLocalDate(ad) >= dateStr)
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
      return Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1
    }
    const sStr = formatLocalDate(s)
    const eStr = formatLocalDate(e)
    return activeDates.value.filter(ad => {
      const adStr = formatLocalDate(ad)
      return adStr >= sStr && adStr <= eStr
    }).length
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
    readOnly?: boolean; editable?: boolean; multiSelect?: boolean;
    snapMode?: GanttSnapMode; weekStartsOn?: number;
    statusStyleMap?: Record<string, GanttStatusStyle>;
    nonWorkingWeekdays?: number[]; holidays?: string[];
    hideHolidays?: boolean; showBaseline?: boolean; showTodayLine?: boolean;
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
    tasks, columns, scale, flatTasks, allVisibleTasks, visibleTasks, totalHeight: totalHeightVal, offsetY,
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
    moveSelectedTasks, undo, redo, setConfig, toggleTask, updateTaskDates
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
```

---

### Task 15: Update exports in src/index.ts and src/types/gantt.ts

**Files:**
- Modify: `packages/tt-gantt/src/index.ts`
- Modify: `packages/tt-gantt/src/types/gantt.ts`

- [ ] **Step 1: Update src/types/gantt.ts — add re-exports**

Add at bottom of file (after existing exports):

```ts
// Re-export core types for backward compatibility
export type {
  ResourceNode,
  ResourceType,
  ResourceCapacity,
  ResourceShift,
  ResourceCalendar,
  UnavailablePeriod,
  MaintenanceWindow,
  Command,
  PatchRecord,
  Constraint,
  ValidationResult,
  ValidationItem,
  Severity,
  Scenario,
  EngineState,
  GanttTaskSnapshot,
  DependencyType as CoreDependencyType
} from '../core/types'
```

- [ ] **Step 2: Update src/index.ts — add core exports**

After existing exports add:

```ts
// Core exports (Phase 1)
export {
  GanttEngine,
  CommandBus,
  MoveTaskCommand,
  ResizeTaskCommand,
  CreateDependencyCommand,
  RemoveDependencyCommand,
  BatchCommand,
  ConstraintEngine,
  PluginSystem,
  ReadOnlyConstraint,
  DateOrderConstraint,
  DependencyConstraint,
  OverlapConstraint,
  ResourceCapacityConstraint,
  fromDTO,
  toDTO
} from './core'
export type {
  MoveTaskPayload,
  ResizeTaskPayload,
  CreateDependencyPayload,
  RemoveDependencyPayload
} from './core'
```

---

### Task 16: Run full test suite and verify build

- [ ] **Step 1: Run all tests**

```bash
Set-Location -LiteralPath "packages\tt-gantt"; pnpm test
```

Expected: All tests pass (existing date.test.ts + new core tests).

- [ ] **Step 2: Verify TypeScript compilation**

```bash
Set-Location -LiteralPath "packages\tt-gantt"; npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Verify build**

```bash
Set-Location -LiteralPath "packages\tt-gantt"; npx vite build
```

Expected: Build succeeds.
