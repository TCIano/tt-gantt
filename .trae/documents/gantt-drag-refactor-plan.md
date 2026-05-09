# 甘特图拖动方案优化与重构计划

## Summary

本计划基于当前仓库中 `GanttBar.vue`、`GanttTimeline.vue` 和 `useGanttStore.ts` 的真实实现，目标是分阶段重构甘特图的任务条拖拽、左右 Resize、边界自动扩展和依赖线实时预览逻辑。

本次计划锁定以下决策：

- 重构范围覆盖：任务条整体拖拽、左右 Resize、依赖线实时预览
- 实施方式：分阶段改造
- 体验目标：以更优交互体验为先，允许调整边缘阈值、自动扩展时机和拖拽手感
- 拖拽预览方案：继续复用原任务条 DOM，不新增独立 overlay 预览层
- 事件协议：接受从“偏移天数”为主，重构为“像素坐标 + 日期草稿”为主的更明确协议
- 验证要求：包含构建检查、诊断检查，以及明确的浏览器手动验收脚本

最终目标不是继续局部修补 `currentOffset`，而是建立一套稳定的“预览态坐标 + 时间轴扩展控制 + 连线共享坐标源”的拖拽架构。

---

## Current State Analysis

### 1. 当前组件职责

- `src/components/GanttBar.vue`
  - 同时负责静态条定位、任务条拖拽、左右 Resize、自动滚动、边界扩展、点击判定、事件派发
  - 当前职责过重，是主要重构目标
- `src/components/GanttTimeline.vue`
  - 负责时间轴、网格、任务条列表和依赖线渲染
  - 当前依赖线预览通过事件总线接收 `draggedDays`
- `src/composables/useGanttStore.ts`
  - 负责任务、时间范围、虚拟列、滚动状态和日期扩展
  - 当前只有 `expandStartDate()` / `expandEndDate()`，但没有统一的扩展控制策略

### 2. 当前拖拽链路

当前拖拽链路为：

1. `GanttBar.vue` 在 `pointerdown` 中记录 `startX`
2. `pointermove` 中计算 `currentOffset = e.clientX - startX`
3. 使用 DOM `transform` 做拖拽预览
4. 边缘触发 `startAutoScroll()`
5. 到达边界时触发 `expandStartDate()` / `expandEndDate()`
6. `pointerup` 时根据 `currentOffset` 换算日期并提交到 store

这条链路已经具备“预览态与最终提交分离”的基础，但仍存在两个结构性问题：

- 当前任务条拖动位置同时受静态 `left` 和拖拽时 `transform` 影响
- 时间轴扩展、滚动补偿和条本身预览都集中在一个组件内，耦合过高

### 3. 当前依赖线预览链路

- `GanttBar.vue` 拖拽中通过事件总线发送 `onTaskDragging`
- 负载内容当前是 `taskId + draggedDays`
- `GanttTimeline.vue` 收到后，把“天数偏移”再折算成依赖线实时坐标

当前方案存在的问题：

- 依赖线预览与任务条预览并没有真正共享同一个像素级坐标源
- 一旦时间轴扩展策略变化，连线预览仍可能产生短暂偏差

### 4. 当前边界扩展问题

当前代码已经修复了“左扩展时重复补偿”的抖动问题，但仍是修补式架构：

- 左右扩展逻辑分散在拖拽和 Resize 两套代码路径
- 仍然依赖 `startX` / `currentOffset` 的相对位移模型
- 扩展是在撞墙后触发，而不是提前缓冲
- 扩展能力没有形成可复用的控制器

因此，从长期维护和体验角度，现状适合升级为统一的拖拽预览与时间轴扩展机制。

---

## Proposed Changes

### 方案总览

采用“原节点预览 + 草稿坐标 + 统一扩展控制 + 新事件协议”的分阶段方案。

重构后核心原则：

- 静态定位与拖拽预览定位分离
- 左扩展只通过滚动锚点补偿维持视口稳定
- 拖拽、Resize、依赖线预览共享同一份草稿坐标/日期数据
- 时间轴扩展从撞墙后触发改为靠近边缘提前触发
- `GanttBar.vue` 只保留视图渲染和手势入口，重逻辑抽到 composables

---

### Phase 1: 建立统一的拖拽预览模型

#### 文件

- `src/components/GanttBar.vue`
- `src/composables/useGanttStore.ts`
- 新增 `src/composables/useGanttBarMetrics.ts`
- 新增 `src/composables/useGanttBarDraft.ts`

#### 目标

把任务条的静态坐标、拖拽预览坐标、Resize 预览坐标拆开，建立单一预览数据源。

#### 具体改动

1. 在 `useGanttBarMetrics.ts` 中抽出任务条基础几何计算：
   - 输入：`task`, `startDate`, `columnWidth`, `scale`
   - 输出：
     - `baseLeftPx`
     - `baseWidthPx`
     - `pxPerDay`
     - `minWidthPx`

2. 在 `useGanttBarDraft.ts` 中建立草稿态：
   - 状态：
     - `mode: 'idle' | 'drag' | 'resize-left' | 'resize-right'`
     - `draftLeftPx`
     - `draftWidthPx`
     - `draftStartDate`
     - `draftEndDate`
     - `dragAnchorCanvasX`
     - `pointerStartClientX`
   - 行为：
     - 开始拖拽
     - 更新拖拽草稿
     - 开始 Resize
     - 更新 Resize 草稿
     - 结束并提交
     - 取消并回弹

3. `GanttBar.vue` 中取消“静态 `left` + 拖拽 `transform`”双链路定位：
   - 改为由一个统一的 `renderLeftPx`
   - 非拖拽态：`renderLeftPx = baseLeftPx`
   - 拖拽态：`renderLeftPx = draftLeftPx`
   - 宽度同理：
     - 非 Resize 态：`renderWidthPx = baseWidthPx`
     - Resize 态：`renderWidthPx = draftWidthPx`

4. 预览期间不再依赖“任务条 DOM transform 叠加静态 left”作为唯一坐标机制：
   - 可继续保留 transform 做微动画，但定位语义改为以草稿坐标为准
   - 计划中的实现应优先用 `left + width` 的草稿值表达位置和尺寸

#### 原因

- 这是后续彻底摆脱左扩展抖动的根本
- 能让拖拽、Resize、依赖线共享同一份预览位置
- 符合 Vue composable 拆分职责的最佳实践

---

### Phase 2: 引入统一的时间轴扩展控制器

#### 文件

- `src/components/GanttBar.vue`
- `src/composables/useGanttStore.ts`
- 新增 `src/composables/useGanttTimelineExpansion.ts`

#### 目标

把拖拽和 Resize 两条路径中重复的自动滚动、边缘判断、左补偿、右扩展逻辑统一到一个 composable。

#### 具体改动

1. 在 `useGanttTimelineExpansion.ts` 中统一封装：
   - 输入：
     - `containerEl`
     - `clientX`
     - `scale`
     - `columnWidth`
     - `scrollLeft`
     - `viewportRect`
   - 输出：
     - 当前边缘方向
     - 是否应自动滚动
     - 是否应提前扩展
     - 执行扩展后的锚点补偿结果

2. 把当前分散在 `startAutoScroll()` 和 `startResizeAutoScroll()` 中的逻辑抽象为统一策略：
   - 统一边缘阈值
   - 统一自动滚动速度
   - 统一扩展锁
   - 统一左扩展补偿

3. 扩展触发策略从“撞到边界”改为“提前缓冲”：
   - 当鼠标进入边缘危险区时尝试扩展
   - 阈值由计划实施时统一配置，例如：
     - `edgeTriggerPx`
     - `preExpandThresholdPx`
   - 左扩展时继续采用滚动锚点补偿

4. 在 `useGanttStore.ts` 中增加更明确的扩展接口：
   - 保留 `expandStartDate()` / `expandEndDate()`
   - 新增统一语义入口，例如：
     - `prependTimeline(days)`
     - `appendTimeline(days)`
   - 扩展块大小按视图维度决定：
     - day: 7 天
     - week: 1 列
     - month: 1 列

#### 原因

- 当前拖拽和 Resize 都有独立的边缘处理逻辑，重复度高
- 左扩展补偿应成为统一策略，不应散落在多个分支里
- 统一后可以更方便做手感调优

---

### Phase 3: 将拖拽计算从“相对偏移”升级为“画布坐标”

#### 文件

- `src/components/GanttBar.vue`
- 新增 `src/composables/useGanttCanvasPointer.ts`
- `src/composables/useGanttBarDraft.ts`

#### 目标

把拖拽和 Resize 的核心输入从：

- `currentOffset = clientX - startX`

升级为：

- `canvasX = clientX - viewportLeft + scrollLeft`

#### 具体改动

1. 新增 `useGanttCanvasPointer.ts`
   - 输入：
     - 指针 `clientX`
     - 甘特右侧容器元素
   - 输出：
     - `canvasX`
     - `viewportLeft`
     - `scrollLeft`

2. `useGanttBarDraft.ts` 改用画布坐标更新草稿值：
   - 拖拽：
     - `draftLeftPx = currentCanvasX - dragAnchorOffsetPx`
   - 左 Resize：
     - `draftLeftPx` 和 `draftWidthPx` 同时变化
   - 右 Resize：
     - `draftWidthPx` 变化，`draftLeftPx` 不变

3. 所有“天数换算”只在两个阶段发生：
   - 拖拽预览中生成 `draftStartDate` / `draftEndDate`
   - 提交时将草稿日期写回真实任务

#### 原因

- 画布坐标天然适配滚动容器
- `scrollLeft` 变化时，预览坐标更稳定
- 能显著降低左扩展时“相对位移模型”失稳的概率

---

### Phase 4: 重构依赖线预览协议

#### 文件

- `src/components/GanttBar.vue`
- `src/components/GanttTimeline.vue`
- `src/composables/useGanttPlugin.ts`
- `src/types/gantt.ts`
- 可选新增 `src/types/gantt-preview.ts`

#### 目标

让依赖线预览不再依赖“偏移天数猜测”，而直接复用拖拽/Resize 草稿坐标和草稿日期。

#### 具体改动

1. 重新定义拖拽预览事件协议：
   - 当前：
     - `onTaskDragging({ taskId, draggedDays })`
   - 计划改为：
     - `onTaskPreviewChange({ taskId, mode, draftLeftPx, draftWidthPx, draftStartDate, draftEndDate })`
     - `onTaskPreviewEnd({ taskId })`

2. `GanttTimeline.vue` 中的依赖线预览坐标改为优先读取草稿预览：
   - 若任务存在 `preview` 数据，则优先使用 `draftLeftPx` 和 `draftWidthPx`
   - 若不存在预览，则回退到任务真实日期计算

3. 若依赖线需要兼容树展开后的行位置：
   - 继续使用当前 `allVisibleTasks` 计算 Y 坐标
   - X 坐标改为优先使用预览坐标

4. 删除旧的“仅偏移天数”事件依赖

#### 原因

- 连线和任务条预览应共享同一份几何信息
- 避免缩放模式切换时对“天数偏移”的重复换算
- 新协议更清晰，也更适合后续加 hover、选中和批量拖拽

---

### Phase 5: 精简 `GanttBar.vue` 职责

#### 文件

- `src/components/GanttBar.vue`

#### 目标

让 `GanttBar.vue` 回归“组件视图 + 交互入口”，把拖拽、Resize、扩展、坐标换算全部交给 composables。

#### 具体改动

保留在组件中的内容：

- `props`
- 视图模板
- 指针事件入口绑定
- 样式态类名

迁出到 composables 的内容：

- 几何计算
- 预览态计算
- 自动滚动
- 时间轴扩展控制
- 日期草稿换算
- 提交策略

#### 原因

- 当前文件承担了过多行为，不利于持续迭代
- 符合“组件聚焦、逻辑抽到 composable”的 Vue 组织方式

---

## Component Map

### `GanttBar.vue`

- 单一职责：渲染任务条、显示当前拖拽或 Resize 的视觉状态、触发交互入口

### `useGanttBarMetrics.ts`

- 单一职责：从任务和时间轴状态推导基础几何信息

### `useGanttBarDraft.ts`

- 单一职责：维护拖拽/Resize 期间的草稿几何和草稿日期

### `useGanttTimelineExpansion.ts`

- 单一职责：处理边缘判定、自动滚动、预扩展和左侧锚点补偿

### `useGanttCanvasPointer.ts`

- 单一职责：把浏览器指针坐标转换为甘特画布坐标

### `GanttTimeline.vue`

- 单一职责：消费任务真实数据与预览态数据，统一渲染网格、条和依赖线

### `useGanttStore.ts`

- 单一职责：提供任务数据、时间轴范围、滚动状态、扩展接口和最终提交动作

---

## Event/Data Interfaces

### 1. 预览事件协议

计划引入以下事件负载：

```ts
interface TaskPreviewChangePayload {
  taskId: string | number
  mode: 'drag' | 'resize-left' | 'resize-right'
  draftLeftPx: number
  draftWidthPx: number
  draftStartDate: string
  draftEndDate: string
}

interface TaskPreviewEndPayload {
  taskId: string | number
}
```

### 2. 任务条草稿状态

计划在 composable 中维护：

```ts
interface TaskDraftState {
  mode: 'idle' | 'drag' | 'resize-left' | 'resize-right'
  draftLeftPx: number
  draftWidthPx: number
  draftStartDate: string
  draftEndDate: string
}
```

### 3. Store 扩展接口

计划统一扩展语义：

```ts
prependTimeline(days: number): void
appendTimeline(days: number): void
```

旧接口是否保留：

- 计划保留 `expandStartDate()` / `expandEndDate()` 作为内部兼容层
- 新逻辑优先通过统一语义入口调用

---

## Assumptions & Decisions

- 保持 Vue 3 + Composition API + `<script setup lang="ts">`
- 不引入新的第三方拖拽库
- 不新增独立 overlay 预览层，优先复用当前任务条 DOM
- 允许调整：
  - 自动滚动阈值
  - 预扩展触发时机
  - 拖拽和 Resize 的手感
- 不以“兼容旧事件协议”为最高目标，允许升级事件总线负载
- 优先保证左扩展稳定性和视觉连续性，再考虑实现复杂度
- 当前计划以日/周/月三种已有缩放模式为边界，不额外引入新缩放粒度

---

## Edge Cases / Failure Modes

重构时必须覆盖以下边界场景：

- 向左拖动接近边界但尚未撞墙时的预扩展
- 向左拖动多次连续触发预扩展时，不出现重复扩展或跳帧
- 向右拖动持续靠边时，不出现任务条与连线脱节
- 左 Resize 拖动到最短宽度时，草稿宽度不小于 1 个最小时间单位
- 右 Resize 向左收缩到最短宽度时，结束日期不越过开始日期
- 拖拽或 Resize 中松手时，草稿态和事件预览态被正确清理
- 拖拽过程中切换缩放不是本次支持目标，应在计划执行时明确视为不支持的中断场景
- 树折叠/展开过程中不要求支持“拖拽进行中同步结构变化”，应默认在该场景下结束预览态

---

## Verification Steps

### 1. 静态检查

- 运行 TypeScript 诊断，确保新增 composables 和事件类型无错误
- 检查修改后的 `.vue` 文件无新增诊断问题
- 执行构建，确保 `npm run build` 通过

### 2. 手动验收脚本

#### A. 普通拖拽

1. 在中间区域拖拽任务条向左、向右
2. 观察任务条始终跟随鼠标
3. 松手后任务起止日期更新正确

#### B. 左边界拖拽

1. 把任务条拖向左边缘
2. 在接近左边缘时观察是否提前扩展时间轴
3. 检查底部横向滚动条不出现明显跳动
4. 检查任务条不出现来回抖动
5. 检查松手后日期与预览位置一致

#### C. 右边界拖拽

1. 把任务条拖向右边缘
2. 观察是否平滑自动滚动和扩展
3. 检查任务条与鼠标位置保持一致

#### D. 左 Resize

1. 拖动左侧把手向左
2. 靠近边缘时观察左扩展是否稳定
3. 拖动左侧把手向右直至最小宽度
4. 检查宽度不会反转，开始日期不会越过结束日期

#### E. 右 Resize

1. 拖动右侧把手向右和向左
2. 检查右侧扩展和回缩均稳定
3. 检查最小宽度限制正确

#### F. 连线预览

1. 拖动带依赖关系的任务条
2. 检查依赖线实时跟随预览位置
3. 左扩展、右扩展和 Resize 过程中，连线起止点不明显漂移

#### G. 回弹与点击

1. 轻微移动不足以跨过网格时松手
2. 检查任务条是否平滑回弹
3. 检查点击阈值未被破坏

---

## Implementation Order

执行时按以下顺序实施，避免一次改太多无法定位问题：

1. 抽出基础几何和草稿态 composable
2. 让 `GanttBar.vue` 使用 `renderLeftPx` / `renderWidthPx`
3. 抽出统一的时间轴扩展控制器
4. 把拖拽和 Resize 改成画布坐标
5. 升级事件协议，让 `GanttTimeline.vue` 使用预览几何
6. 做诊断、构建和手动验收

---

## Out Of Scope

以下内容不纳入本次重构：

- 引入第三方甘特图或拖拽库
- 新增 overlay 预览层
- 批量拖拽多个任务条
- 拖拽过程中的跨缩放模式热切换支持
- 对外暴露新的公共组件 API

