# 甘特图拖拽交互优化与重构演进文档

## 1. 背景与初始痛点

在早期的甘特图实现中，任务条（`GanttBar.vue`）承担了过多且复杂的职责。其中包括：
* 监听原生鼠标事件（`mousedown`, `mousemove`, `mouseup`）。
* 计算并直接修改全局的 `startDate` 和 `endDate` 数据模型。
* 处理视口边缘的自动滚动（Auto-scroll）与时间轴自动扩容（Timeline Expansion）。

**主要痛点（尤其是向左拖拽）：**
当用户将任务条向左侧拖拽至边缘时，时间轴需要向左扩容（即把全局 `startDate` 提前，比如提前 7 天）。由于甘特图的 X 轴坐标是以 `startDate` 为原点计算的，原点提前会导致所有任务条的绝对坐标瞬间向右偏移（例如：增加 350px）。
如果此时不对滚动条的 `scrollLeft` 施加反向补偿，整个视野会瞬间跳变。但即使原逻辑进行了初步补偿，任务条和底部滚动条依然伴随着剧烈的**抖动（Jitter）**，极大影响了用户体验。

---

## 2. 架构解耦：分离“数据层”与“交互草稿层”

为了解决拖拽时的位置突变和计算竞争问题，我们对组件进行了深度拆分，引入了**草稿模式（Draft Mode）**的概念。

### 2.1 引入 `useGanttBarDraft.ts`
核心思想是：**拖拽期间不修改真实业务数据**。
* **数据分离**：我们分离出了静态计算的 `baseLeftPx`（由真实 `startDate` 计算得出）和活动状态下的 `draftLeftPx`（跟随鼠标实时移动）。
* **画布坐标系（CanvasX）**：废弃了使用相对位移（`deltaX`）累加的脆弱做法，改为在 `useGanttCanvasPointer.ts` 中计算基于时间轴容器内部的绝对坐标 `canvasX = clientX - viewportLeft + scrollLeft`。
* **稳定渲染**：拖拽和 Resize 期间，UI 完全由独立的草稿坐标接管。只有在 `pointerup` 结束交互时，才将最终计算出的 `draftStartDate` 和 `draftEndDate` 提交给全局 Store，确保了业务数据修改的原子性。

### 2.2 隔离依赖连线预览
在 [GanttTimeline.vue](file:///Users/niutiancao/Desktop/project/gantt/src/components/GanttTimeline.vue) 中，我们引入了 `taskPreviewMap` 来监听拖拽节点的临时草稿坐标。通过隔离的事件总线（`useGanttEventBus`），拖拽状态仅在必要组件间流通，不再引发全局的 Reactivity 更新风暴。此时，依赖连线（SVG Links）可以精准且丝滑地跟随鼠标实时重新绘制。

---

## 3. 攻克边缘自动滚动与坐标系原点偏移

拖拽到视口边缘时触发自动滚动是标准甘特图的必备能力。我们提取了 `useGanttTimelineExpansion.ts` 专门处理这部分逻辑。

### 3.1 差异化的左右拖拽逻辑
* **向右拖拽/扩容**：仅仅是在时间轴尾部增加天数（`appendTimeline`），`startDate` 原点不变，现有任务的 `left` 值和当前的 `scrollLeft` 都不需要变动，逻辑天然平顺。
* **向左拖拽/扩容**：在头部增加天数（`prependTimeline`），导致 `startDate` 提前，**坐标系原点发生偏移**。
  此时必须通过 `container.scrollLeft = previousScrollLeft + compensationPx` 强行将滚动条拉回，使视野和鼠标锚点保持在视觉上的相对静止。

### 3.2 解决向左扩容时的底层抖动（终极优化）
尽管实现了草稿层和滚动补偿，但在向左扩容的那一瞬间，整个甘特图视图依然存在瞬间的跳动。经过深度排查，我们发现了三个底层原因并实施了最终的修复：

#### 修复 1：CSS 过渡动画冲突（消除大规模滑动抖动）
**问题**：虽然正在拖拽的节点被赋予了 `.is-dragging` 取消了 CSS 动画，但其他所有未被拖拽的任务条和 SVG 依赖连线仍然保留着 `transition: left 0.2s` 和 `transition: stroke 0.2s`。原点改变瞬间，它们试图花 0.2 秒时间从旧位置滑向新位置。
**方案**：在 Store 中引入了 `isTimelineExpanding` 状态，触发向左扩容时设为 `true`。通过向组件注入 `.is-expanding` 类，瞬间封印（`transition: none !important`）全局的动画。借助双重 `requestAnimationFrame` 确保在浏览器完成 DOM 绘制后再恢复动画。

#### 修复 2：扩容像素精度误差（消除像素级跳变）
**问题**：原先用于补偿的偏移量是理论值（如 `7 * columnWidth`），在遇到不同缩放比例（按月计算）或复杂环境时，真实增加的 DOM 滚动宽度可能与理论值有 `1px` 到 `2px` 的微小误差。
**方案**：废弃理论补偿。在 `nextTick` 之后，通过比对真实 DOM 的物理尺寸差值：
`const actualWidthDiff = container.scrollWidth - previousScrollWidth;`
使用绝对真实的物理差值作为补偿量：`container.scrollLeft = previousScrollLeft + actualWidthDiff;`，做到 100% 严丝合缝。

#### 修复 3：Vue 响应式与原生 Scroll 事件脱节（消除网格与表头滞后）
**问题**：原生修改 `scrollLeft` 后，浏览器要等到下一帧才会异步触发 `scroll` 事件，导致依赖 `store.scrollLeft` 渲染的背景网格和顶部表头滞后一帧才对齐。
**方案**：在主动设置原生 `container.scrollLeft` 的同时，同步调用 `options.setScrollLeft(newScrollLeft)` 立即更新 Vue 的响应式状态 `store.scrollLeft.value`。这使得虚拟滚动的网格、表头与任务条在同一个微任务周期内完成渲染更新，彻底消除了滞后感。

---

## 4. 总结与成果

经过以上重构与演进，项目当前的拖拽交互逻辑实现了：
1. **高性能**：拖拽过程剥离了全局数据更新，避免了大规模重绘。
2. **高稳定性**：利用 `canvasX` 实现了稳定的指针追踪，不受滚动条状态干扰。
3. **丝滑的边缘扩容**：通过精确的 DOM 物理差值补偿、瞬时 CSS 动画封印以及同步的 Vue 状态更新，彻底解决了向左拖拽和扩容时的所有抖动（Jitter）问题。图表在极端操作下也犹如磐石般稳固。