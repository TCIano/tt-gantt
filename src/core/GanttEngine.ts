import cloneDeep from 'lodash.clonedeep'
import type {
  EngineState,
  EngineListener,
  Command,
  CommandContext,
  ValidationResult,
  GanttEngineLike,
  ConstraintEngineLike,
  PluginSystemLike,
  GanttTaskSnapshot,
  FlatTaskSnapshot,
  TaskId
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

    // Execute command on context copy first
    const result = cmd.execute(ctx)

    if (!result.ok) {
      return result
    }

    // Pre-validate the modified task from context (proposed state)
    const task = this._findContextTask(cmd, ctx)
    if (task) {
      const preResult = this.constraintEngine.preValidate(task, ctx)
      const errors = preResult.items.filter(i => i.severity === 'error')
      if (errors.length > 0) {
        cmd.undo(ctx)
        return { ok: false, items: preResult.items }
      }
      result.items.push(...preResult.items.filter(i => i.severity !== 'error'))
    }

    // Apply context to state
    this._applyContext(ctx)
    this.commandBus.push(cmd)

    const postResult = this.constraintEngine.postValidate(this.state.tasks, ctx)
    result.items.push(...postResult.items)

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
    const flattenTaskMap = (tasks: GanttTaskSnapshot[]): Map<TaskId, GanttTaskSnapshot> => {
      const map = new Map<TaskId, GanttTaskSnapshot>()
      for (const t of tasks) {
        map.set(t.id, cloneDeep(t))
        if (t.children) {
          for (const [id, child] of flattenTaskMap(t.children)) {
            map.set(id, child)
          }
        }
      }
      return map
    }

    const flattenAllTasks = (tasks: GanttTaskSnapshot[], level = 0): FlatTaskSnapshot[] => {
      const result: FlatTaskSnapshot[] = []
      for (const t of tasks) {
        const hasChildren = Array.isArray(t.children) && t.children.length > 0
        result.push({
          ...cloneDeep(t),
          children: undefined,
          _level: level,
          _hasChildren: hasChildren,
          _visible: true
        })
        if (hasChildren && t.children) {
          const childTasks = flattenAllTasks(t.children, level + 1)
          for (const ct of childTasks) {
            ct._parent = t.id
          }
          result.push(...childTasks)
        }
      }
      return result
    }

    return {
      tasks: flattenTaskMap(this.state.tasks),
      resources: new Map(this.state.resources.map(r => [r.id, cloneDeep(r)])),
      flatTasks: flattenAllTasks(this.state.tasks)
    }
  }

  private _applyContext(ctx: CommandContext): void {
    const updateTree = (tasks: GanttTaskSnapshot[]) => {
      for (const t of tasks) {
        const updated = ctx.tasks.get(t.id)
        if (updated) {
          const { children, ...rest } = updated
          Object.assign(t, rest)
        }
        if (t.children) {
          updateTree(t.children)
        }
      }
    }
    updateTree(this.state.tasks)
    this.state.resources = Array.from(ctx.resources.values())
  }

  private _findContextTask(cmd: Command, ctx: CommandContext): GanttTaskSnapshot | undefined {
    const patch = cmd.toPatch()
    const raw: unknown = (patch.before as Record<string, unknown>)?.taskId ?? (patch.after as Record<string, unknown>)?.taskId
    if (raw == null) return undefined
    const taskId = raw as string | number
    return ctx.tasks.get(taskId)
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
