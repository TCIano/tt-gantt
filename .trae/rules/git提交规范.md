# Git 提交规范

为确保代码库的稳定性、可追溯性及协作效率，本项目采用严格的 Git 提交规范。所有代码提交必须遵循本规范。

## 1. 统一提交消息格式

每次提交的消息格式必须严格遵循以下结构：

```text
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### 1.1 标题行 (Header)

格式：`<type>(<scope>): <subject>`

- **type**：提交类型（见下方核心场景）。
- **scope**：影响的模块英文简称（如：`layout`, `timeline`, `store`, `utils`）。
- **subject**：简短描述。
  - 限制在 **50个字符** 以内。
  - **首字母小写**。
  - **结尾不加句号（`.`）**。

### 1.2 正文模板 (Body)

正文需详细说明修改的动机和内容，每行不超过 **72个字符**，支持 Markdown 列表格式。必须逐条包含以下四个维度：

- **Why**: 为什么必须进行这次修改？（解决什么业务痛点或技术债务）
- **How**: 具体的实现思路和关键技术选择是什么？
- **What**: 代码层面具体改动了什么？（新增了什么类、修改了什么配置等）
- **Impact**: 对现有系统的影响范围（如是否破坏向下兼容、是否有性能影响）。

### 1.3 页脚关键字 (Footer)

用于关联 Issue、PR 或标记破坏性变更（Breaking Changes）。

- 格式要求：`关键字 #编号`，支持多行。
- 常用关键字：`Fixes`, `Closes`, `Refs`。
- 示例：
  ```text
  Fixes #123
  Refs #456
  ```

### 1.4 禁止项 🚫

- **禁止关键字**：标题中严禁出现 `WIP`, `tmp`, `test` 等无意义词汇。
- **禁止空提交**：严禁提交内容为空的 commit。

---

## 2. 核心场景与要求

### 2.1 性能优化 (`perf`)

用于提升系统性能、减少资源消耗的修改。

- **强制要求**：
  - 明确**性能基准**（Baseline）。
  - 提供**可量化的提升指标**（如：渲染耗时从 500ms 降至 100ms）。
  - 描述**性能测试方法**与工具。
  - 记录**测试结果格式**（如 Lighthouse 跑分截图链接或终端输出）。

### 2.2 bug修复 (`fix`)

用于修复系统缺陷。

- **强制要求**：
  - 关联具体的 **issue 编号**。
  - 提供**复现步骤**（Steps to Reproduce）。
  - 详细的**根因分析**（Root Cause Analysis）。
  - 明确受**影响范围**。
  - 补充**回归测试清单**（Regression Test Checklist）。

### 2.3 新增特性 (`feat`)

用于新增产品功能或核心能力。

- **强制要求**：
  - 必须包含**需求来源**（如 Jira 编号或产品文档链接）。
  - 简述**用户故事**（User Story）。
  - 说明**接口/UI变更说明**。
  - 明确**向后兼容性声明**（是否破坏旧版本行为）。

### 2.4 文档更新 (`docs`)

用于更新项目相关文档。

- **强制要求**：
  - 明确**区分文档类型**（代码注释、API文档、README、CHANGELOG）。
  - 提供相关修改的**示例模板**或对照。

### 2.5 重构 (`refactor`)

用于重写代码结构，但不改变现有外部行为和功能。

- **强制要求**：
  - 强制说明**“零行为变更”验证方式**。
  - 单元测试覆盖率必须达到**设定阈值**（如 ≥90%）。
  - 必须说明**静态检查通过标准**（Lint/Type Check）。

---

## 3. 提交前强制检查清单 ✅

在执行 `git commit` 前，开发者必须确保满足以下条件：

- [ ] **代码规范**：本地 Lint 检查完全通过。
- [ ] **单元测试**：单元测试覆盖率 `≥ 90%` 且全部用例通过。
- [ ] **性能标准**：性能回归指标 `≤ 5%`（不得出现明显性能退化）。
- [ ] **运行状态**：应用正常启动，无任何控制台报错（Console Errors）。
- [ ] **变更日志**：CHANGELOG 已同步更新（若适用）。

---

## 4. 交付物与自动化配置

### 4.1 Git Hook 脚本 (`.git/hooks/commit-msg`)

请将以下代码保存到项目的 `.git/hooks/commit-msg` 文件中，并赋予执行权限（`chmod +x .git/hooks/commit-msg`），以实现对提交消息的正则校验。不合规将自动拒绝并给出修正提示：

```bash
#!/usr/bin/env bash

# 校验提交消息格式的正则表达式
# 格式: type(scope): subject (注意首字母小写，无句号)
COMMIT_PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\([a-zA-Z0-9_-]+\):\s[a-z][^。.]*$"
# 禁止的关键词
FORBIDDEN_PATTERN="^(WIP|tmp|test)$"

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(head -n 1 "$COMMIT_MSG_FILE")

# 检查是否包含禁止词汇
if [[ "$COMMIT_MSG" =~ $FORBIDDEN_PATTERN ]]; then
  echo -e "\033[31m[错误] 提交标题不能只包含 WIP, tmp, test 等无意义词汇！\033[0m"
  echo -e "\033[33m当前标题: $COMMIT_MSG\033[0m"
  exit 1
fi

# 检查格式
if ! [[ "$COMMIT_MSG" =~ $COMMIT_PATTERN ]]; then
  echo -e "\033[31m[错误] 提交消息格式不合规！\033[0m"
  echo -e "规范格式: <type>(<scope>): <subject>"
  echo -e "当前标题: \033[33m$COMMIT_MSG\033[0m"
  echo -e ""
  echo -e "要求："
  echo -e "  1. type 必须为 feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert 之一"
  echo -e "  2. scope 必须为英文简称并用括号包裹"
  echo -e "  3. 冒号后必须有一个空格"
  echo -e "  4. subject 首字母小写，且限制 50 字符内，结尾不能有句号"
  exit 1
fi

exit 0
```

### 4.2 CI/CD 门禁配置示例 (GitHub Actions)

在 `.github/workflows/pr-check.yml` 中配置门禁，提交PR时自动运行上述检查，任一失败即阻断合并：

```yaml
name: PR Check Gate

on:
  pull_request:
    branches: [main, master]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Lint Check
        run: npm run lint

      - name: Unit Tests & Coverage (≥90%)
        run: npm run test:coverage -- --passWithNoTests

      - name: Performance Regression Check (≤5%)
        run: npm run test:perf
        # 需确保配置的性能测试工具会在回归 > 5% 时以非零状态码退出

      - name: No Console Errors Verification
        run: npm run test:e2e -- --env no-console-errors

      - name: Changelog Verification
        run: npx commit-and-pr-checker --check-changelog
```

### 4.3 《提交规范速查表》

复制以下速查表以便日常开发参考：

```markdown
# 🚀 Git 提交规范速查表

| Type       | 说明                     | 强制要求核心要点                                   |
| ---------- | ------------------------ | -------------------------------------------------- |
| `perf`     | 性能优化                 | 性能基准、量化提升指标、测试方法、结果记录         |
| `fix`      | bug 修复                 | Issue编号、复现步骤、根因分析、影响范围、回归清单  |
| `feat`     | 新增特性                 | 需求来源、用户故事、接口/UI变更、兼容性声明        |
| `docs`     | 文档更新                 | 区分文档类型、提供示例模板                         |
| `refactor` | 重构（无行为变更）       | “零变更”验证方式、测试覆盖率阈值、静态检查通过标准 |
| `style`    | 格式调整（不影响逻辑）   | 无                                                 |
| `test`     | 测试用例增删改           | 无                                                 |
| `chore`    | 构建/工具链/依赖配置变更 | 无                                                 |

**📝 消息模板样例：**
feat(timeline): add virtual scrolling support

Why: 解决渲染上万条任务时浏览器卡顿的问题
How: 引入横向和纵向的虚拟列表，仅渲染可视区域节点
What: 新增 useVirtualScroll hook，重构 GanttTimeline 组件
Impact: 向下兼容，内存占用减少约 80%

Fixes #102
```
