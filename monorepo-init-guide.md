# 企业级前端 Monorepo 初始化指南

本文档将指导你从零开始搭建一个基于 **pnpm + Turborepo + Vite + Vue 3** 的企业级 Monorepo 架构。该架构旨在统一管理通用组件库（如甘特图）、平台应用、移动端应用以及各种定制化项目。

---

## 1. 架构蓝图与目录规范

在初始化项目之前，请确保你了解并遵循以下目录结构规范：

```text
my-monorepo/
├── 📂 apps/                # 【核心业务应用】(标准平台、管理后台等)
├── 📂 projects/            # 【定制化项目】(特定客户的定制化应用)
├── 📂 packages/            # 【通用共享库】(组件库如甘特图、UI库、工具函数等)
├── 📂 internal/            # 【工程化配置】(共享的 ESLint、TS、Vite 配置)
├── 📄 .nvmrc               # Node.js 版本锁定
├── 📄 .npmrc               # pnpm 配置
├── 📄 pnpm-workspace.yaml  # 工作区配置文件
├── 📄 turbo.json           # Turborepo 构建编排配置
├── 📄 .gitlab-ci.yml       # GitLab CI 自动化流水线
└── 📄 package.json         # 根目录依赖与脚本
```

---

## 2. 基础环境搭建

### 2.1 环境准备与版本锁定

请确保开发环境满足要求，并在根目录创建 `.nvmrc` 锁定 Node 版本：

```bash
echo "v18.18.0" > .nvmrc
```

建议使用 `pnpm` >= 8.x (`npm install -g pnpm`)。

### 2.2 初始化根目录

在你的空白项目根目录下执行以下命令：

```bash
# 1. 初始化 package.json
pnpm init

# 2. 创建核心目录
mkdir apps projects packages internal

# 3. 创建 Git 忽略文件
echo "node_modules\ndist\n.turbo\n.DS_Store" > .gitignore
```

### 2.3 配置 pnpm 工作区

在根目录创建 `pnpm-workspace.yaml` 文件，定义哪些目录下的项目应该被包含在工作区内：

```yaml
packages:
  - 'apps/*'
  - 'projects/*'
  - 'packages/*'
  - 'internal/*'
```

### 2.4 配置 .npmrc

在根目录创建 `.npmrc` 文件，配置依赖提升和公共配置，以解决“幽灵依赖”问题，并配置私有仓库（如适用）：

```text
shamefully-hoist=true
strict-peer-dependencies=false
auto-install-peers=true
# @your-org:registry=https://gitlab.com/api/v4/projects/<Project-ID>/packages/npm/
```

---

## 3. 安装全局工程化依赖

在根目录安装 Turborepo 和 TypeScript 作为开发依赖（`-w` 或 `--workspace-root` 表示安装到根目录）：

```bash
pnpm add turbo typescript @changesets/cli -Dw
```

_(注：`@changesets/cli` 用于后续的包版本管理和发版)_

更新根目录的 `package.json`，添加常用的工作区脚本：

```json
{
  "name": "enterprise-monorepo",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules",
    "changeset": "changeset",
    "version-packages": "changeset version"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.1",
    "turbo": "latest",
    "typescript": "latest"
  }
}
```

---

## 4. 配置 Turborepo 任务调度

在根目录创建 `turbo.json` 文件。它定义了任务的依赖关系和缓存策略：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## 5. 迁移现有甘特图项目

现在，我们将现有的 `tt-gantt` 项目迁移进来作为通用组件库。

1. **移动代码**：将 `tt-gantt` 整个文件夹移动到 `packages/tt-gantt` 目录下。
2. **清理旧依赖**：删除 `packages/tt-gantt/node_modules` 文件夹和锁文件。
3. **配置作用域与依赖**：
   - 修改 `packages/tt-gantt/package.json` 中的 `name` 为 `@tt-gantt/core`（假设您的组件库核心包名为 core）。
   - ⚠️ **关键**：确保 `tt-gantt` 将 `vue` 声明为 `peerDependencies`，而不是普通的 `dependencies`，以防止多个 Vue 实例冲突。
4. **重新安装**：回到 Monorepo **根目录**，运行：
   ```bash
   pnpm install
   ```

---

## 6. 创建新的业务应用并引用甘特图

### 6.1 初始化应用

```bash
cd apps
# 使用 Vite 创建一个新的 Vue 项目
pnpm create vite platform-admin --template vue-ts
cd platform-admin
```

修改 `apps/platform-admin/package.json` 的名称为 `@tt-gantt/platform-admin`。

### 6.2 引用甘特图组件

在 `apps/platform-admin` 目录下，将甘特图作为本地依赖安装：

```bash
pnpm add @tt-gantt/core --workspace
```

### 6.3 验证运行

在 `apps/platform-admin/src/App.vue` 中引入甘特图进行测试：

```vue
<script setup lang="ts">
import { GanttLayout } from '@tt-gantt/core';
import '@tt-gantt/core/dist/tt-gantt.css';
</script>

<template>
  <GanttLayout :tasks="[]" :columns="[]" />
</template>
```

回到 Monorepo **根目录**，运行 `pnpm dev`，Turbo 会同时启动所有应用的开发服务器！

---

## 7. 版本管理与发布 (Changesets)

在 Monorepo 中，推荐使用 Changesets 进行发版管理。

1. **初始化**：在根目录运行 `pnpm changeset init`。
2. **日常开发**：每次完成特性开发后，运行 `pnpm changeset`，选择修改的包并填写变更日志。
3. **发布前**：运行 `pnpm version-packages` 自动消耗 changeset 文件，升级对应包的 `package.json` 版本号并生成 CHANGELOG。

---

## 8. GitLab CI/CD 自动化构建

在根目录创建 `.gitlab-ci.yml`，利用 Turborepo 的缓存和增量构建能力提升 CI 速度：

```yaml
image: node:20

stages:
  - install
  - lint
  - test
  - build

# 缓存 pnpm 依赖
cache:
  key:
    files:
      - pnpm-lock.yaml
  paths:
    - .pnpm-store
    - .turbo

install_deps:
  stage: install
  script:
    - corepack enable
    - corepack prepare pnpm@latest --activate
    - pnpm config set store-dir .pnpm-store
    - pnpm install
  only:
    - merge_requests
    - main

build_all:
  stage: build
  script:
    - corepack enable
    - corepack prepare pnpm@latest --activate
    - pnpm install
    # 仅构建受影响的项目（增量构建）
    - pnpm turbo run build --filter=...[origin/main]
  artifacts:
    paths:
      - 'apps/*/dist'
      - 'packages/*/dist'
  only:
    - merge_requests
    - main
```

---

## 9. 后续架构演进建议

1. **抽离公共配置**：在 `internal/` 下创建 `@tt-gantt/eslint-config` 和 `@tt-gantt/tsconfig`，并在各个包中通过 `extends` 引用，保持全仓库规范一致。
2. **CODEOWNERS**：在 GitLab 中配置 `.gitlab/CODEOWNERS`，例如设置 `/packages/tt-gantt/ @architecture-team`，保护核心资产。
3. **UI 组件库抽象**：随着项目扩大，可新建 `packages/ui-components` 存放基础组件，`tt-gantt` 专注于复杂业务组件。

---

🎉 **恭喜！你已经成功搭建了一个现代化的企业级前端 Monorepo 架构！**
