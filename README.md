# TT-Gantt 🚀

一个基于 **Vue 3** + **TypeScript** + **Vite** 开发的高性能、交互式甘特图组件库。

[![Vue 3](https://img.shields.io/badge/vue-3.x-brightgreen.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/vite-6.x-646cff.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## ✨ 核心特性

- ⚡ **极致性能**：内置**双向虚拟滚动**（横向时间轴 + 纵向任务列表），轻松驾驭万级数据。
- 🎨 **多维视图**：支持 **日 (Day)**、**周 (Week)**、**月 (Month)** 三种时间尺度无缝切换。
- 🖱️ **深度交互**：
  - 支持任务条的**拖拽移动**与**双向缩放**。
  - 智能**吸附模式**（根据视图尺度自动对齐日期）。
  - 支持 **Shift+点击** 快速建立任务依赖关系（SVG 动态渲染连线）。
- 🛠️ **专业功能**：
  - **撤销/重做 (Undo/Redo)**：完善的操作历史管理。
  - **对比视图 (Baseline)**：支持计划与实际进度的可视化对比。
  - **隐藏节假日**：一键过滤非工作日，紧凑展示项目进度。
- 📤 **多格式导出**：支持导出为 **SVG 图片**、**JSON 配置文件** 或直接 **打印 PDF**。
- ⌨️ **全键盘支持**：丰富的快捷键绑定，提升专业用户操作效率。

---

## 🛠️ 技术栈

- **框架**: [Vue 3 (Composition API)](https://vuejs.org/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **状态管理**: 响应式 `provide/inject` 模式 (轻量且无依赖)
- **绘图**: SVG + CSS 硬件加速渲染

---

## 📦 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建组件库
npm run build
```

---

## ⌨️ 快捷键指南

| 快捷键 | 功能说明 |
| :--- | :--- |
| <kbd>D</kbd> | 切换至 **日视图** |
| <kbd>W</kbd> | 切换至 **周视图** |
| <kbd>M</kbd> | 切换至 **月视图** |
| <kbd>H</kbd> | **隐藏/显示** 节假日 |
| <kbd>C</kbd> | 开启/关闭 **对比视图** |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | **撤销** 上次操作 |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> | **重做** 操作 |
| <kbd>←</kbd> / <kbd>→</kbd> | 微调选中任务的位置 |
| <kbd>Shift</kbd> + <kbd>Click</kbd> | 建立任务间的依赖连线 |
| <kbd>Esc</kbd> | 取消当前选择 |

---

## 📜 贡献规范

本项目遵循严格的开发规范以保证代码质量：

- **Git 提交**: 必须遵循 [Git 提交规范](.trae/rules/git提交规范.md)。
- **推送规则**: 推送前必须执行 `git pull --rebase` 并通过所有 Lint 检查。
- **性能标准**: 核心渲染帧率需保持在 60fps，任何性能退化需提供量化指标说明。

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 协议开源。
