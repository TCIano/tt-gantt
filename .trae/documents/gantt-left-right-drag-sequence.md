# 甘特图左右拖动时序分析

## 1. 目的

本文说明甘特图任务条在以下几种场景下的执行时序与变量变化：

- 普通左右拖动
- 向右拖到边界后的自动扩展
- 向左拖到边界后的自动扩展
- 旧版向左拖动为什么会抖动
- 修复后向左拖动为什么稳定

相关实现主要位于：

- `src/components/GanttBar.vue`
- `src/composables/useGanttStore.ts`

---

## 2. 核心变量

在阅读时序图前，先统一几个关键变量的含义：

- `startX`
  - 本次拖拽开始时记录的鼠标 `clientX`
  - 当容器发生自动横向滚动时，会反向修正它
- `currentOffset`
  - 当前任务条相对初始位置的视觉位移
  - 最终直接作用到 `transform: translate3d(...)`
- `scrollLeft`
  - 右侧甘特区域滚动容器的横向滚动位置
- `startDate`
  - 整个时间轴的左边界日期
  - 一旦左扩展，它会变得更早
- `left`
  - 当前任务条根据 `task.startDate - startDate` 计算出来的静态定位
  - 依赖全局时间轴原点

---

## 3. 总体判断

### 3.1 左右拖动相同的部分

左右拖动在未撞到边界前，主流程完全一致：

1. `pointerdown`
2. 记录 `startX`
3. `pointermove`
4. 计算 `currentOffset = e.clientX - startX`
5. 用 `transform` 实时移动任务条
6. `pointerup`
7. 把 `currentOffset` 换算成天数并更新任务日期

对应代码：

- `onPointerDown`
- `onPointerMove`
- `onPointerUp`

都在 `src/components/GanttBar.vue`

### 3.2 左右拖动不同的部分

差异只出现在任务条拖到视口边界，无法继续通过正常滚动显示更多内容时：

- 向右拖到尽头：扩展 `endDate`
- 向左拖到尽头：扩展 `startDate`

这两者看似对称，但视觉影响并不对称：

- 右扩展是在时间轴尾部追加内容，坐标原点不变
- 左扩展是在时间轴头部插入内容，坐标原点左移

因此：

- 向右拖动通常不需要额外修正 `scrollLeft`
- 向左拖动必须修正 `scrollLeft`

---

## 4. 普通拖动时序

下面是未撞到边界时，左右拖动共用的流程。

```text
用户拖动鼠标
  |
  v
onPointerMove(e)
  |
  |-- currentOffset = e.clientX - startX
  |
  |-- startAutoScroll(e.clientX)
  |     |
  |     |-- 如果没到边界: 不触发自动滚动
  |     |-- 如果在可滚动区域内: 仅修改 scrollLeft
  |
  |-- requestAnimationFrame(...)
        |
        |-- container.style.transform = translate3d(currentOffset, 0, 0)
```

变量变化关系：

```text
鼠标右移 20px  -> currentOffset = +20
鼠标左移 20px  -> currentOffset = -20
```

这一步里，左右并没有本质区别。

---

## 5. 向右拖动到边界时序

### 5.1 修复后的实际时序

```text
用户持续向右拖动
  |
  v
startAutoScroll(clientX)
  |
  |-- scrollSpeed = +10
  |
  |-- ganttRightEl.scrollLeft += 10
  |
  |-- actualScroll = newScrollLeft - oldScrollLeft
         |
         |-- 情况 A: actualScroll !== 0
         |      |
         |      |-- currentOffset += actualScroll
         |      |-- startX -= actualScroll
         |      |-- 任务条继续跟着鼠标移动
         |
         |-- 情况 B: actualScroll === 0
                |
                |-- queueTimelineExpansion(..., +10, ...)
                       |
                       |-- store.expandEndDate(7)
                       |-- nextTick(...)
                       |-- 不需要修正 scrollLeft
                       |-- 重新绘制任务条 transform
```

### 5.2 为什么右边简单

右扩展只是在右侧增加更多列：

```text
扩展前:
[现有时间轴内容................]

扩展后:
[现有时间轴内容................][新增内容]
```

原点没有变化，所以：

- 已有任务条的 `left` 不会整体平移
- 当前视口一般不需要通过 `scrollLeft` 做坐标补偿

---

## 6. 向左拖动到边界时序

### 6.1 修复后的实际时序

```text
用户持续向左拖动
  |
  v
startAutoScroll(clientX)
  |
  |-- scrollSpeed = -10
  |
  |-- ganttRightEl.scrollLeft -= 10
  |
  |-- actualScroll = newScrollLeft - oldScrollLeft
         |
         |-- 情况 A: actualScroll !== 0
         |      |
         |      |-- currentOffset += actualScroll
         |      |-- startX -= actualScroll
         |      |-- 任务条继续跟着鼠标移动
         |
         |-- 情况 B: actualScroll === 0
                |
                |-- queueTimelineExpansion(..., -10, ...)
                       |
                       |-- prevScrollLeft = ganttRightEl.scrollLeft
                       |-- compensation = getExpandCompensation()
                       |-- store.expandStartDate(7)
                       |-- nextTick(...)
                       |-- ganttRightEl.scrollLeft = prevScrollLeft + compensation
                       |-- 重新绘制任务条 transform
```

### 6.2 为什么左边复杂

左扩展是在时间轴头部插入新的列：

```text
扩展前:
[现有时间轴内容................]

扩展后:
[新增内容][现有时间轴内容................]
```

这会导致时间轴的视觉原点变化：

- `startDate` 变早
- 所有任务条的 `left` 全部重新计算
- 底部滚动条可滚动范围变大

如果不修正 `scrollLeft`，用户会感觉整个视口突然往右跳。

所以左边必须补这一刀：

```text
ganttRightEl.scrollLeft = prevScrollLeft + compensation
```

它的本质是：

- 时间轴左边多插入了一段宽度
- 那就把视口也往右平移同样的宽度
- 让用户眼中的可视区域保持不变

---

## 7. 旧版向左拖动为什么会抖动

抖动发生在旧逻辑里，左扩展时做了两次补偿。

### 7.1 旧逻辑时序

```text
用户向左拖到最左边
  |
  v
actualScroll === 0
  |
  |-- store.expandStartDate(7)
  |      |
  |      |-- startDate 变早
  |      |-- 所有任务条 left 重算
  |      |-- 时间轴总宽度变化
  |
  |-- nextTick(...)
         |
         |-- ganttRightEl.scrollLeft = prevScrollLeft + compensation
         |-- currentOffset -= compensation
```

### 7.2 问题点

这里同时做了两件事：

1. 修正容器滚动位置
2. 修正当前任务条自己的 `transform`

但这两件事其实都在试图抵消同一个现象：

- 左侧新增列后，整个坐标系被推了一次

结果是：

```text
时间轴扩展推了一次
scrollLeft 拉回一次
任务条 transform 又额外拉回一次
```

于是视觉上就会出现：

- 任务条左右来回跳
- 底部横向滚动条位置来回抖

---

## 8. 修复后为什么稳定

修复后的原则是：

> 左扩展时只允许存在一个补偿来源

现在保留的是：

- 补偿 `scrollLeft`

去掉的是：

- 额外修改 `currentOffset`

### 8.1 修复后的关键策略

```text
actualScroll === 0 且继续向左拖
  |
  |-- expandStartDate(7)
  |-- nextTick 后修正 scrollLeft
  |-- 不再修改 currentOffset
```

这样分工就清楚了：

- `left` 的变化由时间轴重算自然承担
- 视口稳定由 `scrollLeft` 补偿承担
- 当前拖拽中任务条的即时位置仍然只由 `currentOffset` 控制

互相不重叠，所以不会再打架。

---

## 9. 变量流转对比

### 9.1 向右拖到边界

```text
鼠标 -> currentOffset
滚动容器 -> scrollLeft
scrollLeft 真正变化 -> 修正 startX / currentOffset
右扩展 -> 只增加右边内容
```

特点：

- 坐标原点不变
- 无需额外滚动补偿

### 9.2 向左拖到边界

```text
鼠标 -> currentOffset
滚动容器 -> scrollLeft
scrollLeft 真正变化 -> 修正 startX / currentOffset
左扩展 -> startDate 提前
startDate 提前 -> 所有任务条 left 重算
为保持视口稳定 -> scrollLeft += compensation
```

特点：

- 坐标原点变化
- 必须额外补偿 `scrollLeft`

---

## 10. 一句话总结

向右拖和向左拖在“普通拖动阶段”没有区别，真正不同在边界扩展阶段：

- 向右拖动是“在尾部追加内容”，不会移动时间轴原点
- 向左拖动是“在头部插入内容”，会移动时间轴原点，因此必须补偿 `scrollLeft`

旧版抖动的根因是：

- 左扩展时同时补偿了 `scrollLeft` 和任务条 `transform`

修复后的稳定原因是：

- 左扩展时只保留 `scrollLeft` 补偿，去掉重复的任务条位移补偿

---

## 11. 代码定位

建议结合下面几个位置一起看：

- `src/components/GanttBar.vue`
  - `queueTimelineExpansion`
  - `startAutoScroll`
  - `startResizeAutoScroll`
  - `onPointerMove`
- `src/composables/useGanttStore.ts`
  - `expandStartDate`
  - `expandEndDate`

