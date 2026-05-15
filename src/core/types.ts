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

export interface MaintenanceWindow {
  id: string
  type: 'maintenance'
  start: string
  end: string
  recurring?: 'weekly' | 'monthly'
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
  dependencyLags?: Partial<Record<TaskId, number>>
  children?: GanttTaskSnapshot[]
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
  dependencyLags?: Record<TaskId, number>
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
