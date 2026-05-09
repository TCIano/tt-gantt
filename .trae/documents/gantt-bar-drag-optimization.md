# 甘特图任务条拖拽逻辑优化方案 (Gantt Bar Drag Optimization Plan)

## 1. 现状分析 (Current State Analysis)
在对 `GanttBar.vue` 的拖拽和调整大小逻辑进行分析后，发现以下几个影响用户体验的严重问题：

1. **点击与轻微拖拽冲突 (Click vs Drag Conflict)**：
   在 `onPointerUp` 中，判定是否触发点击事件的标准是 `draggedDays === 0`。这意味着如果用户拖拽了任务条（例如移动了 10px），但距离不足以改变任务日期，松开鼠标时依然会错误地触发 `onTaskClick`，导致意外打开任务详情。
2. **自动滚动边缘脱节 Bug (Auto-scroll Desync)**：
   在 `startAutoScroll` 逻辑中，当鼠标靠近边缘触发自动滚动时，代码会盲目地累加 `currentOffset` 和递减 `startX`。如果此时滚动条已经到达了容器的尽头（`scrollLeft === 0` 或最大值），容器实际上并未发生滚动，但偏移量变量仍在疯狂累加，导致任务条飞出屏幕，与鼠标指针完全脱节。
3. **边缘拖拽无法扩展时间轴 (Edge Dragging Restriction)**：
   当前用户将任务拖拽到时间轴边缘时，由于容器宽度固定，无法继续向更早或更晚的日期拖动。
4. **性能隐患 (RAF Queuing)**：
   在 `onPointerMove` 和 `onResizeMove` 中使用了 `requestAnimationFrame`，但并未取消上一帧的请求。如果在同一帧内触发多次 `pointermove`，会导致多个更新任务排队执行，造成轻微卡顿。

## 2. 改进方案 (Proposed Changes)

我们将主要修改 `src/components/GanttBar.vue` 文件：

### 2.1 修复 RAF 帧堆积 (Fix RAF Queuing)
*   **具体修改**：引入 `dragRafId` 和 `resizeRafId` 变量。在调用 `requestAnimationFrame` 之前，先调用 `cancelAnimationFrame` 清除上一帧的冗余更新，保证 60fps 的绝对平滑。

### 2.2 修复自动滚动脱节并支持自动扩展时间轴 (Fix Auto-scroll Desync & Auto-expand Timeline)
*   **具体修改**：
    1. 在 `startAutoScroll` 的定时器中，记录修改前的 `ganttRightEl.scrollLeft`。
    2. 应用 `scrollSpeed` 后，计算实际发生的滚动量 `actualScroll = newScrollLeft - oldScrollLeft`。
    3. 只有 `actualScroll !== 0` 时，才将 `actualScroll` 累加到 `currentOffset` 和 `startX` 中。这彻底解决了滚动条到头时的脱节 Bug。
    4. 如果发现 `actualScroll === 0`（说明到达了物理边缘），则调用 `store.expandStartDate(7)`（向左）或 `store.expandEndDate(7)`（向右）自动扩展时间轴。
    5. 为了防止向左扩展导致的时间轴坐标系平移，在扩展后使用 `nextTick` 自动修正 `scrollLeft`，补偿增加的宽度（`7 * columnWidth.value`）。

### 2.3 区分真正的点击与无效拖拽 (Distinguish Click from Ineffective Drag)
*   **具体修改**：
    1. 在 `onPointerUp` 中，不再使用 `draggedDays === 0` 判断是否点击，而是引入位移阈值：`const isClick = Math.abs(currentOffset) < 3`。
    2. 如果 `isClick` 为 `true`，才触发 `onTaskClick` 事件。
    3. 如果不是点击，且 `draggedDays === 0`，则仅仅将任务条带动画平滑回弹（`translate3d(0,0,0)`），不再触发点击事件。

### 2.4 优化调整大小的回弹过渡 (Optimize Resize Revert Transition)
*   **具体修改**：在 `onResizeEnd` 中，如果拖拽天数为 0（无效调整），在重置 `width` 时，短暂开启 `transition`，使得任务条宽度平滑恢复，避免生硬的闪烁。

## 3. 假设与决策 (Assumptions & Decisions)
*   **决策**：将点击判定的阈值设定为 `< 3px`。这是业界通用的防手抖阈值，能完美兼顾点按操作和轻微拖拽取消。
*   **决策**：自动扩展时间轴时，每次扩展 7 天（与 `useGanttStore.ts` 的默认缓冲逻辑一致），这既能满足用户的拖拽需求，又不会导致 DOM 节点爆炸性增长。

## 4. 验证步骤 (Verification Steps)
1. **测试防误触**：点击并轻微拖动任务条（不改变天数）后松开，确认不会触发 `onTaskClick`，且任务条能平滑回弹。
2. **测试自动滚动与边界**：拖拽任务条到右侧边缘，确认滚动条能自动向右滚动。当滚动到最右侧尽头时，确认任务条不会飞离鼠标，且时间轴会自动向右扩展。
3. **测试向左扩展**：拖拽任务条到最左侧，确认时间轴向左扩展，且任务条相对鼠标的位置保持稳定（由于 `scrollLeft` 的自动补偿）。
4. **测试缩放调整**：调整任务条左侧和右侧的把手，轻微拉动后松开，确认宽度能平滑恢复，不触发异常。