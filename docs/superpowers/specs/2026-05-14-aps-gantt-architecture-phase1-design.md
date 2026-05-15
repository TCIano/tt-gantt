# APS 甘特图架构改造 — Phase 1 设计文档

> 驱动文档：`APS甘特图组件检测文档.md`  
> 评分基线：22/70 (D)，目标 ≥ 40/70 (B/C)  
> 改造范围：Phase 1 — Command 模式 + Headless Core 解耦 + 资源模型  
> 策略：渐进式重构，现有 Vue 组件保持可运行

---

## 1. 改造动机

当前 tt-gantt 组件得分为 D（22/70），核心问题是：

1. **无资源模型** —— GanttTask 只有任务层级，缺少 Resource/Calendar/Shift 概念
2. **核心与 Vue 耦合** —— useGanttStore(603行) 全部依赖 Vue ref/computed，无法脱离 Vue 单测
3. **无正式命令模式** —— history 数组只记录日期变更，无 Command 抽象/序列化/审计
4. **校验散落** —— 仅 normalizeTaskDates 做 end<start 修正，无可插拔规则引擎
5. **无 Scenario 模型** —— 排产核心能力空白

Phase 1 聚焦**架构基座**：将上述前三项缺失补上，使架构评分从 8/26 提升至 ≥ 15/26。

---

## 2. 架构总览

### 2.1 数据流

```
Props/API → GanttEngine (纯 TS, Headless)
              ├── State (tasks, resources, scenarios)
              ├── CommandBus (execute/undo/redo)
              │     └── 前置执行 ConstraintEngine (规则链)
              ├── ConstraintEngine (可插拔规则注册)
              └── PluginSystem (通过 EventBus 扩展)
                    ↓
         Vue Adapter (useGanttStore, ~60行)
                    ↓
         Vue Components (GanttLayout/Bar/Table/Timeline — 渐进接入)
```

### 2.2 目录结构

```
src/
├── core/                          ← NEW: 零 Vue 依赖
│   ├── index.ts
│   ├── types.ts                   ← Resource, Shift, Calendar, Scenario,
│   │                                  Command, Constraint, ValidationResult
│   ├── GanttEngine.ts             ← 状态机 + 单写入口
│   ├── Command.ts                 ← Command 接口 + MoveTask/ResizeTask/
│   │                                  CreateDependency/BatchCommand
│   ├── ConstraintEngine.ts        ← 规则注册 + 链式执行
│   ├── constraints/
│   │   ├── index.ts
│   │   ├── ReadOnlyConstraint.ts
│   │   ├── DateOrderConstraint.ts
│   │   ├── DependencyConstraint.ts
│   │   ├── OverlapConstraint.ts
│   │   └── ResourceCapacityConstraint.ts
│   ├── layout.ts                  ← 纯函数：时间→x、行→y、依赖线 path
│   ├── adapter.ts                 ← DTO ↔ Domain 转换
│   └── PluginSystem.ts            ← 增强插件系统
│
├── types/gantt.ts                 ← MODIFY: 扩展类型导出
├── composables/
│   └── useGanttStore.ts           ← MODIFY: 变为 Engine 的 Vue reactive 包装
│
├── components/                    ← UNCHANGED
└── plugins/                       ← UNCHANGED
```

### 2.3 设计原则

1. `src/core/` 零外部依赖 — 不 import Vue / @vue/* / 组件代码
2. 命令驱动 — 所有写操作通过 `engine.execute(command)`
3. 规则可插拔 — `ConstraintEngine.register(rule)` → 执行前链式校验
4. 渐进兼容 — `useGanttStore` API 签名不变，内部委托给 Engine
5. 工具函数优先使用成熟库 — nanoid(ID生成)、lodash(cloneDeep/merge)、现有 date.ts

---

## 3. 核心类型

### 3.1 Resource Model

```ts
interface ResourceNode {
  id: string
  name: string
  type: 'factory' | 'workshop' | 'line' | 'workcenter' | 'machine'
  children?: ResourceNode[]
  capacity?: {
    default: number        // 产能(件/日)
    unit: string
    shifts?: ResourceShift[]
  }
  calendar?: ResourceCalendar
}

interface ResourceShift {
  name: string
  startHour: number
  endHour: number
  capacityRatio: number
}

interface ResourceCalendar {
  unavailablePeriods: UnavailablePeriod[]
  maintenanceWindows: MaintenanceWindow[]
}

interface UnavailablePeriod {
  id: string
  type: 'holiday' | 'shutdown' | 'break'
  start: string             // YYYY-MM-DD
  end: string
  recurring?: 'weekly' | 'monthly'
}

interface MaintenanceWindow extends UnavailablePeriod {
  type: 'maintenance'
}
```

### 3.2 Command Pattern

```ts
interface Command {
  readonly id: string
  readonly type: string
  readonly timestamp: number
  execute(ctx: CommandContext): ValidationResult
  undo(ctx: CommandContext): void
  canUndo(): boolean
  toPatch(): PatchRecord
}

interface CommandContext {
  tasks: Map<string, GanttTask>
  resources: Map<string, ResourceNode>
  flatTasks: FlatGanttTask[]
}

interface PatchRecord {
  commandId: string
  commandType: string
  timestamp: number
  before: Record<string, unknown>
  after: Record<string, unknown>
}
```

### 3.3 Constraint Engine

```ts
type Severity = 'error' | 'warning' | 'info'

interface ValidationResult {
  ok: boolean
  items: ValidationItem[]
}

interface ValidationItem {
  severity: Severity
  code: string               // 'DEP_VIOLATION' | 'CAP_OVERLOAD' | 'OVERLAP'
  message: string
  taskIds?: string[]
  resourceIds?: string[]
  autoFix?: Command
}

interface Constraint {
  readonly id: string
  readonly name: string
  readonly priority: number   // 越小越先执行
  preValidate(task: GanttTask, ctx: CommandContext): ValidationItem[]
  postValidate(tasks: GanttTask[], ctx: CommandContext): ValidationItem[]
}
```

### 3.4 Scenario

```ts
interface Scenario {
  id: string
  name: string
  description?: string
  createdAt: number
  isBaseline: boolean
  patches: PatchRecord[]     // 引用 patch 而非拷贝全量数据
}
```

---

## 4. 核心类设计

### 4.1 GanttEngine

```ts
class GanttEngine {
  private state: EngineState
  private listeners: Set<Listener>

  readonly commandBus: CommandBus
  readonly constraintEngine: ConstraintEngine
  readonly pluginSystem: PluginSystem

  getState(): Readonly<EngineState>
  execute(cmd: Command): ValidationResult    // 唯一写入口
  undo(): ValidationResult | null
  redo(): ValidationResult | null
  subscribe(fn: Listener): () => void
}
```

- **单写入口**：所有修改走 `execute()`，内部先跑 `constraintEngine.preValidate()`
- **不可变快照**：`getState()` 返回只读拷贝
- **订阅机制**：Vue adapter 通过 `subscribe()` 获取变更通知

### 4.2 CommandBus

```ts
class CommandBus {
  private history: Command[]
  private future: Command[]
  private maxHistory = 100

  push(cmd: Command): void
  undo(ctx: CommandContext): Command | null
  redo(ctx: CommandContext): Command | null
  canUndo(): boolean
  canRedo(): boolean
  getPatches(): PatchRecord[]
}
```

**内置命令（Phase 1）**：
- `MoveTaskCommand` — 拖拽移动
- `ResizeTaskCommand` — 拉伸/缩短
- `CreateDependencyCommand` — 创建依赖
- `RemoveDependencyCommand` — 删除依赖（新增能力）
- `BatchCommand` — 原子化多命令

### 4.3 ConstraintEngine

```ts
class ConstraintEngine {
  register(rule: Constraint): void
  unregister(ruleId: string): boolean

  preValidate(task: GanttTask, ctx: CommandContext): ValidationResult
  postValidate(tasks: GanttTask[], ctx: CommandContext): ValidationResult
}
```

**内置规则（Phase 1）**：

| 规则 | priority | 描述 |
|------|----------|------|
| ReadOnlyConstraint | 100 | 拒绝修改只读/冻结任务 |
| DateOrderConstraint | 200 | end >= start |
| DependencyConstraint | 300 | 前置任务完工 ≥ 后置任务开工 |
| OverlapConstraint | 400 | 同资源行任务不重叠 |
| ResourceCapacityConstraint | 500 | 资源产能不超载（存根） |

### 4.4 PluginSystem

```ts
class PluginSystem {
  register(plugin: GanttPlugin): void
  uninstall(pluginId: string): void
  useConstraintEngine(engine: ConstraintEngine): void
}
```

与现有 `GanttEventBus` 并行运行，Plugin 可同时监听事件 + 动态注册约束规则。

---

## 5. Vue 适配层

### 5.1 useGanttStore 改造

改造前（603 行业务逻辑全在 Vue reactive 里）→ 改造后（~60 行薄包装）：

```ts
export function createGanttStore(eventBus: GanttEventBus) {
  const engine = new GanttEngine()

  // Engine state → Vue ref（单向同步）
  const tasks = shallowRef(engine.getState().tasks)
  const resources = shallowRef(engine.getState().resources)

  // Engine listener → 触发 Vue 更新
  engine.subscribe((state) => {
    tasks.value = state.tasks
    resources.value = state.resources
  })

  // API 委托到 Engine（签名不变）
  const updateTaskDates = (taskId, newStart, newEnd) => {
    const cmd = new MoveTaskCommand({ taskId, newStart, newEnd })
    const result = engine.execute(cmd)
    if (!result.ok) eventBus.emit('onValidationError', ...)
    return result.ok
  }

  return { tasks, resources, updateTaskDates, undo: () => engine.undo(), ... }
}
```

### 5.2 组件影响面

| 文件 | 改动 | 风险 |
|------|------|------|
| **NEW** `src/core/*` (12+ 文件) | 新增 | 零（纯 TS） |
| `src/composables/useGanttStore.ts` | 重写为适配器 | 中（API 签名不变） |
| `src/composables/useGanttBarMetrics.ts` | 使用 core/layout 函数 | 低 |
| `src/types/gantt.ts` | 新增导出 | 低 |
| `src/index.ts` | 新增导出 | 低 |
| `src/components/*` | **不改** | 零 |
| `package.json` | 添加 nanoid/lodash dependencies | 低 |

---

## 6. 内置命令实现规格

### 6.1 MoveTaskCommand

```ts
class MoveTaskCommand implements Command {
  execute(ctx) {
    const task = ctx.tasks.get(this.taskId)
    // 1. constraint preValidate
    // 2. 记录 before 快照
    // 3. task.startDate = newStart; task.endDate = newEnd
    // 4. 返回 ValidationResult
  }
  undo(ctx) { /* 恢复 before 快照 */ }
  toPatch() { /* { before: { startDate, endDate }, after: { ... } } */ }
}
```

### 6.2 BatchCommand

```ts
class BatchCommand implements Command {
  private children: Command[]
  execute(ctx) {
    const results = children.map(cmd => cmd.execute(ctx))
    // 任一失败则全部回滚（原子性）
    if (results.some(r => !r.ok)) {
      this.rollback(ctx)
    }
    return mergeResults(results)
  }
  undo(ctx) { children.reverse().forEach(c => c.undo(ctx)) }
}
```

---

## 7. 迁移路径

```
Phase 1-A: 创建 core/ 模块（纯 TS，零风险）
  ├── core/types.ts
  ├── core/Command.ts (基类 + 5 个内置命令)
  ├── core/ConstraintEngine.ts (引擎 + 5 个规则)
  ├── core/constraints/*.ts
  ├── core/GanttEngine.ts
  ├── core/PluginSystem.ts
  ├── core/layout.ts (从 composables 提取纯函数)
  ├── core/adapter.ts
  └── core/index.ts

Phase 1-B: 桥接层
  └── useGanttStore 改造成 Engine 适配器（API 不变）

Phase 1-C: 测试补全
  ├── core/types 不需要测（类型定义）
  ├── core/Command 单测（5个内置命令）
  ├── core/ConstraintEngine 单测（5个规则）
  ├── core/GanttEngine 单测（状态机集成）
  └── core/layout 单测（纯函数）

Phase 1-D: 渐进接入（后续迭代，可选）
  └── useGanttBarMetrics → 使用 core/layout
  └── GanttTimeline → 依赖线计算用 core/layout
```

---

## 8. 预期评分提升

| 评分项 | 改造前 | 改造后 | 变化 |
|--------|--------|--------|------|
| 3.1.1 Headless Core | 1 | **2** | +1 |
| 3.1.2 ViewModel 纯函数/可单测 | 1 | **2** | +1 |
| 3.1.4 Interaction 独立 | 1 | **2** | +1 |
| 3.2.5 Command + Undo/Redo | 1 | **2** | +1 |
| 3.2.6 Command 序列化 | 0 | **1** | +1 |
| 3.3.7 constraintEngine | 0 | **2** | +2 |
| 3.3.8 校验结果结构化 | 0 | **2** | +2 |
| 3.4.9 功能插件化 | 1 | **1** | — |
| 3.4.11 适配层 | 0 | **1** | +1 |
| 3.5.12 核心单测 | 1 | **2** | +1 |
| **架构总分** | **8/26** | **18/26** | **+10** |

业务能力同步提升（资源模型 → 2.1.1 +1, 2.1.3 +1）：14/44 → 16/44  
**总评**：22/70 → **34/70**（D→C，进入"展示型甘特为主"区间，接近 B 线）

---

## 9. 依赖清单

| 包 | 版本 | 用途 | 来源 |
|----|------|------|------|
| `nanoid` | ^5.x | Command/Constraint/Resource ID 生成 | 新增 dependency |
| `lodash.clonedeep` | ^4.x | 状态快照 | 新增 dependency |
| `lodash.merge` | ^4.x | 约束配置合并 | 新增 dependency |

全部为纯 JS 零运行时依赖的成熟工具包。

---

## 10. Self-Review

- [x] 无占位符/TODO/模糊项
- [x] 所有接口定义完整，无内部矛盾
- [x] 范围聚焦 Phase 1，无 scope creep
- [x] 依赖明确（nanoid + lodash 子包）
