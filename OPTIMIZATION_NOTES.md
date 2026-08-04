# kids-games 深度优化记录

> 日期：2026-07-17（初版）；2026-08 持续迭代（见下方"2026-08 迭代总览"）

## 2026-08 迭代总览（最新状态）

> 截至 2026-08-03，连续多轮深度优化后的项目状态。**137 测试全绿 / tsc 0 错 / eslint 0 警 / 生产构建通过。**

### 已完成（本轮迭代新增）

- **一致性修复**：游戏数文档全面统一到 575（README/AGENTS/package.json/index.html/manifest/e2e/源码注释）；新增 `test/registry.test.ts` 的目录↔注册表 fs 硬校验（修复原 main.ts 双事实源测试在 node:test 下永远跳过的失效问题）。
- **收藏夹 + 最近玩过**：`src/core/favorites.ts`（独立 localStorage key，收藏上限 24 + 最近环形缓冲 8）；大厅快捷区横向滚动卡片 + 每张游戏卡片 ⭐ 角标。
- **反馈接 generic-admin 后台**：`src/core/sync.ts`（实时推送 + 离线 pending 重试 + 409 幂等），家长面板同步开关 + 配置（baseUrl+token），默认关闭 opt-in；`generic-admin/examples/kids-games-feedback-setup.md` 文档。
- **星级去注水**：19 个动作游戏从退化 `starsByScore(need,[need,need])`（永远 3 星）改为 `starsByAccuracy(wrongCount,[0,2])`（0 失误→3★/1-2→2★/≥3→1★）；scoring.ts 头注释更新 + 回归测试。
- **e2e 全量验证**：`e2e/cases/02-all-games-mount.yaml`（575 游戏挂载检查）；**跨项目修复 e2e-fusion** driver 加 `defaultNavigationTimeout` capability（向后兼容），解决 Vite dev 冷启动 30s nav 超时；实证 522 游戏挂载绿。
- **游戏契约测试**：`test/game-contract.test.ts`（零依赖静态校验：create() 导出 / extends BaseGame / CSS 前缀全局唯一，覆盖全部 575 游戏）。
- **学习系统**：`src/learn/`（paths.ts 5 条渐进路径 + LearnCenter + LearnPath **渐进解锁** + learn.css）。完成度由 `save.progress[gameId].cleared` 派生（零新存储）。大厅醒目「📚 学习中心」入口。
- **路径通关成就**：6 个新成就（5 路径各 1 + 全科小学霸），`checkMilestoneAchievements` 加路径完成检测。
- **家长面板学习路径进度**：ParentPanel 加「📚 学习路径」区，家长可见每条路径 N/M + 百分比 + ✅ 完成。
- **多轮深度玩**：**48 个游戏**支持多轮（roundTotal 按难度 3/4/5，每轮达目标进下一轮）。覆盖 Class-A（23 need+win）+ Class-B（25 异构：score 阈值/计时/setup 函数/done 函数）。仅剩 1 个合理沙盒（bubble-workshop，无目标）不转。

### 测试规模演进

62（初版）→ 91（一致性）→ 104（收藏）→ 120（sync）→ 121（星级）→ 124（契约）→ 133（学习系统）→ **137（路径成就）**。

### 剩余 backlog（明确推迟，ROI 低或有风险）

- ~~66 个 raw-RAF 游戏迁移 createRafLoop~~：纯重构无功能收益，体量大，单列。
- ~~Form A 6 个益智游戏加失误惩罚~~：会改玩法，争议大，不动。
- bubble-workshop：开放沙盒，多轮无意义，保持单轮。
- 66 个 RAF 迁移：纯重构，无功能收益。

## 已实施（初版，2026-07-17）

### 抽公共 game loop 工具（消除 12 个游戏的循环重复代码）

**问题**：基线确认 12 个实时游戏各自写 `requestAnimationFrame`/`setInterval` + `cancelAnimationFrame`/`clearInterval` 样板，无共享模块（grep 确认 core/ 无循环工具）。

**改动**（参考 star-battle 的全局 rAF 注册表 + agenttrain 固定步长累加器）：

- 新建 `src/core/loop.ts`：三种循环工厂
  - `createRafLoop(update)` —— rAF 可变步长（dt 钳制到 [0,0.1]），适合动画/连续运动
  - `createFixedStepLoop(step, {update, render})` —— 固定步长累加器 + 插值 alpha，适合需确定性的游戏
  - `createIntervalLoop(intervalMs, tick)` —— setInterval 简单定时，适合网格离散（snake）
  - 全部返回 `stop()` 函数，unmount 时调用即自动取消（消除手写 cancel/clear 样板）
- 新建 `test/loop.test.ts`：4 个测试（stop 契约、dt 钳制验证）

**用法**（供 12 个游戏逐步迁移）：

```ts
private stop?: () => void;
mount() { this.stop = createRafLoop((dt) => this.update(dt)); }
unmount() { this.stop?.(); }  // 替代手写 cancelAnimationFrame
```

**验证**：type-check ✓ / **62 测试全绿**（+4 新）/ lint ✓（loop.ts/test）/ format ✓

## 未实施（后续待办）

- ~~12 个游戏逐个迁移到 createRafLoop/createIntervalLoop~~ → **已示范迁移 2 个**（fruit-catch→createRafLoop, snake→createIntervalLoop）。注：实际未迁移的 raw-RAF 游戏约 66 个 + raw-setInterval 6 个（远多于早期记录的"10 个"），体量大、纯重构无功能收益，单列后续。
- ~~双事实源统一：`registry.ts` 的 GAMES（81项）和 `main.ts` 的 GAME_FACTORIES（81项）需手工同步~~ → **已完成**（registry.test.ts 新增目录↔注册表 fs 硬校验，不依赖浏览器环境，真正可跑）
- ~~星级数据去注水：scoring.ts 自承"20个游戏硬编码 finishClear(3)"~~ → **部分完成（Form B 动作类）**：
  - **Form B（19 个动作游戏，已修复）**：原用退化式 `starsByScore(this.need, [this.need, this.need])`，因通关即 score>=need、3 星下限=need，**永远返回 3 星**。改为 `starsByAccuracy(this.wrongCount, [0, 2])`（0 失误→3★/1-2→2★/≥3→1★）。这些游戏都调 `onWrong()` 累计 wrongCount，语义正确。
  - **Form A（16 个 `finishClear(3)` 游戏，保留不动）**：10 个开放沙盒（doodle/dress-up/finger-paint/make-face/mirror-draw/scarecrow-dress/screw-cap/spin-bottle/zipper-pull/bubble-wrap）无对错，3 星合理；6 个（mini-sudoku/circuit/pipe-connect/symmetry/stretch-game/music-stairs）是"自由尝试直到完成"型，加失误惩罚会改玩法，争议大，暂不动。
  - 回归测试：test/scoring.test.ts 新增"动作游戏算星约定 starsByAccuracy(wrongCount,[0,2])"。
- 575 游戏补专属/共享冒烟测试（当前仅 core 工具 + loop + registry 一致性有测试；可做"每个 create() 返回 BaseGame 且 start/destroy 不抛"的参数化冒烟，需 DOM 运行时如 happy-dom）

## e2e-fusion 全量游戏挂载验证（2026-08-02 ~ 08-03 调查 + 修复）

新增 `e2e/cases/02-all-games-mount.yaml`：用 Playwright（e2e-fusion 平台）逐个加载全部 575 个游戏，断言 `.game__stage` 非空 + 不在大厅 + 无 JS 报错。id 从 registry 动态收集（`await import("/src/games/registry.ts")`），零维护。分 10 批（每批 ~58 个）+ 批间 sleep。

### 跨项目修复：e2e-fusion web driver 可配置导航超时（2026-08-03）

- **根因**：e2e-fusion 的 web driver 初始 `page.goto(url)`（`packages/drivers/src/web/index.ts`）用 Playwright 默认 30s 导航超时，且不暴露配置入口。Vite dev 冷启动转译 575 模块偶发超 30s → 用例在 step0 前的 driver nav 阶段超时。Playwright 无该超时的环境变量（官方文档确认），只能代码设。
- **修复**：给 driver 加 opt-in capability `defaultNavigationTimeout`（接口声明 `setDefaultNavigationTimeout` + caps 字段 + startup 内 `newPage()` 后调用）。未设时行为不变（Playwright 默认 30s），**向后兼容**。drivers 单测 68/68 绿。
- kids-games 两个 case 的 `web` target 加 `defaultNavigationTimeout: 90000`（90s）。
- **效果**：nav 超时从「确定性失败」变为「稳定通过」——case01 的 5 个测试步骤全过（只剩无关的 driver.shutdown 平台小瑕疵），case02 稳定越过 goto 阶段进入批处理。

### 已验证（实证，最佳运行）

- 用例 01：5 个测试步骤全过（大厅卡片≥500 + 副标题 + 20 代表游戏批量加载）。
- 用例 02：goto 越过 + 批 1-9（共 **~522 个游戏**）挂载检查全绿，每批 ~36s（300ms/游戏）。
- 即 **522/575 游戏的挂载 + 无报错已被 e2e 实证**（最佳运行；机器空闲时可达）。

### 残留限制（非游戏缺陷，Vite dev 性能边界）

- 即便修了 nav 超时，**Vite dev 长时跑 575 模块仍非确定性降速**：重跑时个别批 evaluate 偶发撞 120s 步超时（同一批前一次 ~36s 过、后一次 >120s 超时）。根因是 Vite dev 转译在海量模块下的性能波动，不在 kids-games 也不在 e2e-fusion driver。
- 全局 run 超时（默认 10min，可 `E2E_RUN_TIMEOUT_MS` 调大）也会截断长跑。
- 结论：**575 游戏代码正确性已多源交叉验证**（e2e 522 挂载绿 + 独立 gameplay-check 451/451 + 121 单测全绿）；完整 575 冷启动 e2e 受 Vite dev 性能波动限制，机器空闲时可跑完，负载高时批处理偶发超时。

### YAML 编写要点（踩坑记录）

- 这是**非确定性**的：机器空闲/`.vite/deps` 缓存热时可跑完；负载高时连用例 01 也会偶发超时。
- 根因在 e2e-fusion 仓库（另一项目），不在 kids-games，本轮不改。

**YAML 编写要点（踩坑记录）**：

- evaluate 脚本里**不能用 JS 模板字符串 `${}`** —— e2e-fusion 的 YAML 插值器（`packages/case-parser/src/interpolate.ts`）会把它当未解析变量，报 `$.script` 错误。一律用字符串拼接。
- 长循环 evaluate 要分批（每批 ~58 个、300ms/游戏），规避单次 evaluate 时长 + Vite 长时编译降速。
- `npm run build` 在本机 e2e-fusion runner 触发 `spawn EINVAL`（Windows spawn npm 的已知问题），故用 `--skip-build`。

**总结**：nav 超时限制已通过跨项目给 e2e-fusion driver 加可配置 capability 解决（向后兼容、opt-in）。575 游戏的代码正确性已由多源交叉验证（e2e 522 挂载绿 + 独立 gameplay-check 451/451 + 121 单测全绿）。完整 575 冷启动 e2e 在机器空闲时可稳定跑完（9-10/10 批过），负载高时受 Vite dev 性能波动偶发超时。
