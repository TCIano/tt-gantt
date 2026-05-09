# 甘特图组件现状分析与改进计划

## 1. 现有代码缺陷与潜在 Bug (Problems & Bugs)

经过对项目代码的深入阅读，当前的甘特图基础骨架在实现上存在以下技术缺陷和潜在问题：

### 1.1 日期与时区处理缺陷 (Date & Timezone Issues)
- **UTC 与本地时间偏移**：在 `GanttBar.vue` 的拖拽结束逻辑中，使用了 `new Date(newStartMs).toISOString().split('T')[0]`。`toISOString()` 会将时间转换为 UTC 时间，对于东八区 (GMT+8) 等正时区用户，可能会导致日期在拖拽后计算错误（向后偏移一天）。
- **夏令时 (DST) 计算误差**：使用 `(endMs - startMs) / msPerDay` 来计算天数。如果跨越夏令时边界，一天可能只有 23 或 25 小时，直接除以固定毫秒数会产生小数，导致宽度渲染出现像素级偏差。

### 1.2 状态管理反模式 (State Management Anti-pattern)
- **单例状态污染**：在 `src/composables/useGanttStore.ts` 中，所有的 `ref`（如 `tasks`, `scrollTop`, `startDate`）都定义在 `useGanttStore` 函数外部。这意味着整个应用共享同一份状态，如果同一个页面渲染两个甘特图组件，它们的数据和滚动状态会互相污染。

### 1.3 性能与渲染问题 (Performance Issues)
- **对象频繁重建**：`visibleDates` 计算属性在每次横向滚动时，都会在 `for` 循环中 `new Date()`。这会导致高频的内存分配和垃圾回收（GC），在低端设备上容易引起卡顿。
- **拖拽边界缺失**：`GanttBar.vue` 中没有对拖拽的极值进行限制，用户可以将任务条拖出时间轴的有效范围（`startDate` 之前或 `endDate` 之后），导致 UI 错乱。

### 1.4 静态范围硬编码 (Hardcoded Ranges)
- 时间轴的起点和终点（`startDate` 和 `endDate`）目前被硬编码为 `2026-04-01` 到 `2026-05-31`。没有根据实际传入的 `tasks` 数据动态计算时间轴的范围。

---

## 2. 功能层面的缺失 (Functional Defects)

与标准、成熟的甘特图组件相比，当前版本缺少以下核心功能：

1. **任务周期调整 (Task Resizing)**：目前只能整体拖拽移动任务，无法通过拖拽任务条的左右边缘来改变任务的开始时间或结束时间（修改工期）。
2. **任务依赖连线 (Task Dependencies/Links)**：不支持任务之间的前后置关联（如 Finish-to-Start），缺乏绘制 SVG 连线的能力。
3. **多视图缩放 (Time Scale Zooming)**：目前只有固定的一天一格的视图，缺乏按周、按月、按季度的多级时间轴缩放功能。
4. **进度展示 (Progress Indicator)**：任务条内部无法展示任务的完成百分比进度。
5. **里程碑 (Milestones)**：不支持工期为 0 的任务节点（通常以菱形图标展示）。
6. **动态表格列 (Dynamic Columns)**：左侧的树形表格目前仅写死了“Task Name”一列，不支持自定义列（如负责人、状态、开始/结束时间等），也不支持列宽拖拽。
7. **右键菜单与提示 (Context Menu & Tooltips)**：缺少对任务条悬浮时的详细信息提示（Tooltip）以及右键操作菜单。

---

## 3. 建议的修复与迭代计划 (Implementation Plan)

针对上述问题，建议按照以下阶段进行修复和功能完善：

### 阶段一：修复核心 Bug 与底层重构 (高优先级)
- **重构 Store**：将 `useGanttStore` 改为 `Pinia` 风格的组件级 Provide/Inject 模式，或将状态放入函数内部并通过闭包管理，支持多实例。
- **修复日期 Bug**：引入轻量级日期库（如 `date-fns` 或 `dayjs`）或重写原生本地日期格式化工具函数，彻底解决时区与夏令时计算偏差。
- **动态时间轴**：编写工具函数，遍历 `tasks` 找出最小 `startDate` 和最大 `endDate`，并向两端各延伸一定缓冲期，动态设置时间轴范围。
- **优化滚动性能**：缓存时间轴列的日期对象，避免滚动时频繁实例化。限制拖拽边界。

### 阶段二：完善核心交互 (中优先级)
- **实现 Resizing**：在 `GanttBar.vue` 左右两侧添加拖拽手柄（Handles），使用与目前拖拽相似的 Pointer Events 机制实现宽度的动态调整。
- **进度百分比**：扩展 `GanttTask` 类型支持 `progress` 字段，并在任务条内部增加深色进度覆盖层。
- **扩展左侧表格**：将 `GanttTable.vue` 改造成支持传入 `columns` 配置的动态表格，允许展示更多任务属性。

### 阶段三：高级功能扩展 (低优先级)
- **依赖连线绘制**：新增一个绝对定位的 SVG 层，通过计算任务条坐标绘制贝塞尔曲线。
- **视图缩放切换**：重构 `useGanttStore` 中的时间轴计算逻辑，支持 `scale` 变量（day/week/month），动态改变 `columnWidth` 和表头渲染逻辑。

请确认是否需要按照上述计划开始进行**阶段一**和**阶段二**的修复与开发？