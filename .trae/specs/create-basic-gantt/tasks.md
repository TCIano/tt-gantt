# Tasks
- [x] Task 1: 初始化 Vue 3 + TS 工程
  - [x] SubTask 1.1: 使用 Vite 创建基础模板（Vue + TS）。
  - [x] SubTask 1.2: 配置基础的代码规范（ESLint, Prettier）和目录结构（components, composables, types, utils）。
- [x] Task 2: 设计核心数据结构与状态管理（Store/Composables）
  - [x] SubTask 2.1: 定义 `Task` 类型，并实现树形数据到一维扁平数据的转换逻辑（`flattenTasks`）。
  - [x] SubTask 2.2: 创建 `useGanttStore` 或核心上下文，管理可视区域状态、时间刻度（TimeScale）和任务列表。
- [x] Task 3: 实现基础双栏布局与同步滚动
  - [x] SubTask 3.1: 开发 `GanttLayout` 组件，包含左侧 `GanttTable` 和右侧 `GanttTimeline`。
  - [x] SubTask 3.2: 监听滚动事件，实现左右两栏的纵向同步滚动。
- [x] Task 4: 实现虚拟滚动核心（Virtual List）
  - [x] SubTask 4.1: 实现纵向虚拟滚动，根据 `scrollTop` 和视口高度动态计算可见的 `tasks` 切片。
  - [x] SubTask 4.2: 实现右侧时间轴的横向按需渲染（计算当前可视时间范围）。
- [x] Task 5: 任务条渲染与拖拽架构
  - [x] SubTask 5.1: 在时间轴区域渲染 `GanttBar` 组件，基于开始/结束时间计算 `left` 和 `width`。
  - [x] SubTask 5.2: 使用 `Pointer Events` 为 `GanttBar` 实现基础的横向拖拽（整体平移）和样式反馈，确保使用 `transform` 保证性能。
- [x] Task 6: 建立插件化机制（Plugin System）
  - [x] SubTask 6.1: 定义并暴露生命周期 Hooks 或 Provide/Inject 接口（例如：`onTaskDragStart`, `onTaskDrop` 等）。
  - [x] SubTask 6.2: 编写一个简单的示例插件（如：日志输出或简单的自定义渲染覆盖）以验证模块化解耦。

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4
- Task 6 depends on Task 5
