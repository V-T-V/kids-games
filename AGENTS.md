# kids-games · AGENTS.md

## 项目内容（What）

为 **3~6 岁儿童**设计的网页小游戏合集，**575 个**寓教于乐的小游戏，有设计感、有巧思。含**学习系统**（5 条渐进学习路径：启蒙认知→文字语言→数学思维→科学常识→综合复习，渐进解锁）。零第三方游戏引擎，纯 Vite + TypeScript + 原生 Canvas/DOM/SVG，构建后是**可离线安装的 PWA**，手机/平板/电脑通吃。

不做：不做大型游戏引擎、不做多人/在线对战、不做付费/账号体系。

## 目标（Goal）

- 575 个真正可玩、有教育内核（颜色/形状/数字/字母/记忆/逻辑/古诗/安全/健康……）、有交互巧思的小游戏。
- 零运行时游戏引擎依赖，纯原生实现，构建产物可双击打开。
- 儿童友好：吉祥物引导、语音/音效、成就、家长报告面板、游戏问题反馈闭环。

## 当前情况（Status）

**功能完整，大规模。** `src/games/` 575 个子目录，`registry.ts` 575 条 id，`types.ts` GameId 联合 575 项，三者一致（由 `test/registry.test.ts` 的目录↔注册表硬校验锁住）。

- **575 个游戏**：每个独立目录，绝大多数单 `index.ts`，少数有算法模块（colorMath/maze/pathfind/pattern）。10 个步骤排序游戏复用 `_shared/StepOrderGame.ts` + `_shared/CycleFlowGame.ts` 两个公共基类。**48 个动作/街机/益智游戏支持多轮深度玩**（roundTotal 按难度 3/4/5 轮，每轮达目标进下一轮）。
- **core/ 模块（15 个）**：achievements（**38 成就**：里程碑/品类/技能/隐藏 + **6 学习路径成就**）/ adaptive（自适应难度 2 局窗口）/ audio / engine（BaseGame 生命周期）/ feedback（反馈闭环 + 接 generic-admin 后台）/ input / loop（RAF 工具 + motionScale）/ mascot / parentReport（能力概览）/ particles / praise / scoring（评分/连击/衰减/最高分）/ storage / sync（离线队列+重试）/ toast
- **learn/ 学习系统（新）**：`paths.ts` 定义 5 条渐进学习路径（启蒙认知→文字语言→数学思维→科学常识→综合复习，每路径 8-12 游戏由浅入深）+ `LearnCenter.ts`（学习中心入口）+ `LearnPath.ts`（路径详情，**渐进解锁**：前一关 cleared 才解锁下一关）。完成度由 `save.progress[gameId].cleared` 派生（零新存储）。路径全通关解锁对应成就，5 条全通解锁「全科小学霸」。
- **favorites 收藏夹 + recent 最近玩过**：独立 localStorage key，大厅快捷区横向滚动卡片 + 每张游戏卡片 ⭐ 角标。
- **ui/ + lobby/**：Button / Overlay / ParentPanel（含反馈管理 + 成就墙 + 家长报告 + 反馈同步开关）/ Lobby（分块渲染 + 学习中心入口 + 收藏/最近快捷区）/ toast / contentFilters（能力域/年龄/时长/通关/搜索组合筛选）
- **PWA**：sw.js v5（stale-while-revalidate）+ manifest（standalone，主题色 #ffd166），可离线安装
- **测试 227 个（19 文件）**：核心算法 + registry 一致性（目录↔注册表 fs 硬校验）+ 存档（含错误路径加固）+ 成就（38 成就元数据/累计型解锁/品类映射/路径成就/隐藏成就深层分支/hint 非空）+ 反馈（含离线队列/重试/countHardFeedback/exportFeedback）+ 自适应（rank/bump幂等/太难反馈降档链）+ 家长报告（含 6 领域 buildDomainReport）+ 评分 + 大厅筛选（含拼音搜索/时长估算）+ **夸赞文案池**（情感安全黑名单+不重复）+ PWA + **游戏契约**（create 导出/extends BaseGame/CSS 前缀唯一）+ **学习路径**（路径有效性/完成度）+ favorites + sync
- **e2e-fusion 接入**：`e2e/` 目录含 descriptor + smoke suite（01 大厅+20 代表游戏 / 02 全 575 游戏挂载验证，已实证 522 游戏挂载绿）+ 多轮 playthrough/screenshot 脚本，`pnpm e2e project run` 可跑回归

## 技术栈与架构

- **语言**：TypeScript 严格模式（noUncheckedIndexedAccess / verbatimModuleSyntax），ESM，Node ≥ 20.19
- **依赖**：**无运行时 dependencies**（devDeps：vite / tsx / typescript / eslint / prettier）
- **关键**：`src/games/registry.ts` 是**内容规模的唯一事实来源**——README/存档/成就/家长面板/大厅标题都从 GAMES 数组派生。`findGame` 用 `Map` O(1) 查找。

```
src/
├── main.ts, router.ts, types.ts, style.css, lobby.css
├── core/      achievements/adaptive/audio/engine/feedback/favorites/input/loop/
│              mascot/parentReport/particles/praise/scoring/storage/sync/toast
├── learn/     paths.ts(5 条学习路径定义) + LearnCenter.ts(学习中心) + LearnPath.ts(路径详情+渐进解锁) + learn.css
├── ui/        Button, Overlay, ParentPanel, toast
├── lobby/     Lobby.ts, contentFilters.ts, util.ts
└── games/     registry.ts(注册表) + shell.ts(游戏外壳)
               + _shared/(StepOrderGame + CycleFlowGame 公共基类)
               + 575 个游戏目录（每个一个 index.ts）
```

## 如何运行

```bash
npm install
npm run dev          # Vite 开发服务器
npm run build        # 生产构建（dist/，PWA）
npm run preview      # 预览构建产物
npx tsx --test test/*.test.ts   # 227 个测试（19 文件）
npx tsc --noEmit     # 类型检查
npx eslint src --quiet          # lint
# e2e 回归（需 e2e-fusion 仓库）
cd D:/M_X_M/e2e-fusion && pnpm e2e project run D:/M_X_M/kids-games/e2e/e2e.project.yaml --suite smoke --skip-build
```

## 关键约定

- **`registry.ts` 是唯一事实源**：新增游戏必须在 registry 加 GAMES 条目 + types.ts 加 GameId，`import.meta.glob` 自动发现游戏模块。
- **CSS 前缀全局唯一**：每个游戏的 style id 和 class 前缀必须唯一（如 `brt-`/`fbird-`），避免互相覆盖。`engine.ts` 的 destroy 兜底清理 `style[id$="-style"]:not(#fb-style)`（fb-style 是反馈系统长生命周期样式）。
- **公共基类**：步骤排序类游戏继承 `StepOrderGame`（slots 流派）或 `CycleFlowGame`（箭头时间线流派），只提供数据+配置。
- **反馈系统**：`feedback.ts` 是闭环——收集（带游戏上下文）→存储（可标记/删除/导出）→展示（家长面板）→行动（联动难度降档/reset）。提交后派发 `feedback-updated` 事件，齿轮按钮显示未处理数角标。可接 generic-admin 后台（`sync.ts`，默认关闭 opt-in，API token 认证，离线 pending 重试）。
- **学习路径**：`learn/paths.ts` 是学习内容的唯一事实源——5 条路径（每路径 8-12 游戏，按由浅入深排序），学习中心/路径详情/路径成就都从 `LEARN_PATHS` 派生。完成度由 `save.progress[gameId].cleared` 派生（零新存储）。路径详情用渐进解锁（前一关 cleared 才解锁下一关）。新增路径要在 `LEARN_PATHS` 加条目 + 路径成就要在 `achievements.ts` 加定义。
- **多轮游戏**：动作类游戏（有 `need` 目标 + `win()`）支持多轮——`roundTotal` 按难度 3/4/5，win() 内 `roundsDone++` 后 `>= roundTotal ? finishClear : startRound`。`wrongCount` 跨轮累积（engine.ts 只在 start() 清零），`starsByAccuracy(wrongCount,[0,2])` 反映整局失误。canonical 模式见 balance/color-sort。
- 零运行时依赖：用原生 Canvas/DOM/SVG，不引游戏引擎。
- 触控目标 ≥40px（`pointer:coarse` 全局兜底 + 游戏内 CSS）。

## 模块完成度

| 模块                 | 文件                      | 完成度  | 说明                                                        |
| -------------------- | ------------------------- | ------- | ----------------------------------------------------------- |
| 注册表（唯一事实源） | `games/registry.ts`       | ✅ 完整 | 575 条 id 唯一、字段非空、与 types.ts GameId 一致           |
| 引擎基类             | `core/engine.ts`          | ✅ 完整 | BaseGame 生命周期 / 事件系统 / 状态管理 / destroy 兜底      |
| 主循环               | `core/loop.ts`            | ✅ 完整 | RAF 工具 + motionScale（减少动效）                          |
| 音效合成             | `core/audio.ts`           | ✅ 完整 | Web Audio，零文件，ADSR 包络                                |
| 粒子/特效            | `core/particles.ts`       | ✅ 完整 | 粒子 + 满屏彩纸                                             |
| 夸赞文案             | `core/praise.ts`          | ✅ 完整 | 永不重复文案池                                              |
| 吉祥物               | `core/mascot.ts`          | ✅ 完整 | "点点" 引导/庆祝                                            |
| 存档                 | `core/storage.ts`         | ✅ 完整 | localStorage + 容错迁移 + 损坏 JSON 兜底                    |
| 输入抽象             | `core/input.ts`           | ✅ 完整 | PointerEvent 统一触屏/鼠标                                  |
| 评分                 | `core/scoring.ts`         | ✅ 完整 | 分数计算 / 连击 / 衰减 / 最高分持久化                       |
| 成就                 | `core/achievements.ts`    | ✅ 完整 | 38 成就 4 大类（里程碑7/品类8/技能14/隐藏9）+ 累计型自动检测 |
| 难度自适应           | `core/adaptive.ts`        | ✅ 完整 | 2 局窗口升降档 + 反馈降档信号                               |
| 家长报告             | `core/parentReport.ts`    | ✅ 完整 | 能力概览 + 优势/练习 Top3 + 推荐下一步                      |
| 反馈闭环             | `core/feedback.ts`        | ✅ 完整 | 收集→存储→展示→行动，联动难度降档                           |
| 离线队列             | `core/sync.ts`            | ✅ 完整 | 反馈离线入队 + 去重 + 重试 + 上限截断                       |
| PWA                  | `public/sw.js` + manifest | ✅ 完整 | SW v5 stale-while-revalidate，可离线安装                    |
| 大厅筛选             | `lobby/contentFilters.ts` | ✅ 完整 | 能力域/年龄/时长/通关/搜索组合                              |
| 游戏内容             | `games/*/index.ts`        | ✅ 完整 | 575 个独立游戏，含 colorMath/maze/pathfind/pattern 算法模块 |

## 测试覆盖（227 项 / 19 文件）

| 测试文件                | 数量 | 覆盖点                                                      |
| ----------------------- | ---- | ----------------------------------------------------------- |
| `achievements.test.ts`  | 26   | 38 成就元数据 / 累计型解锁 / 品类映射 / hint 非空 / hard-master/collector/persistent/explorer/three-star-15/jack-of-all 深层分支 / 梯度里程碑 / id 唯一 |
| `adaptive.test.ts`      | 24   | 升降档规则 / 边界 / 反馈降档信号 / resolveDifficulty 优先级 / rank / bump 幂等 / 升档须连续2局满分 / 太难反馈降档链 |
| `colorMath.test.ts`     | 10   | 减色法混合 / 目标色匹配 / 评星                              |
| `favorites.test.ts`     | 11   | 收藏排序/分组/统计/导出/清理无效 id/收藏内搜索              |
| `feedback.test.ts`      | 19   | 反馈收集/标记/删除/导出/countHardFeedback 难度降档信号/exportFeedback 文本格式+上下文/200条上限/FEEDBACK_TYPES 元数据 |
| `game-contract.test.ts` | 3    | 游戏导出契约（create/destroy 签名一致性）                   |
| `learn.test.ts`         | 19   | 学习路径有效性/完成度 + 理论模型（6 领域/认知层/bloom 分布） |
| `lobby_filters.test.ts` | 20   | 能力域/年龄/时长/通关/搜索组合 / categoryOf / parseAgeRange 正则边界 / estimateMinutes 6 类时长估算 / 拼音首字母搜索 |
| `loop.test.ts`          | 4    | RAF 步长限制 / motionScale / dt 钳制                        |
| `maze.test.ts`          | 6    | DFS 迷宫生成 / 可达性 / 星星分布                            |
| `parentReport.test.ts`  | 13   | 能力概览 / 优势排序 / 推荐游戏 / buildDomainReport 6 领域归类 / recommendGames 去重排序 / formatParentSummary 边界 |
| `pathfind.test.ts`      | 6    | A\* / 启发式 / 障碍绕行                                     |
| `pattern.test.ts`       | 5    | 序列规律识别（等差/几何/斐波那契）                          |
| `praise.test.ts`        | 7    | 夸赞文案池永不出现否定词 / 永不连续重复 / 池非空 / 语义正向 |
| `pwa.test.ts`           | 3    | manifest 字段 / SW 缓存策略 / 图标                          |
| `registry.test.ts`      | 6    | 575 id 唯一 / 字段非空 / 目录↔注册表硬校验 / types.ts 一致  |
| `scoring.test.ts`       | 9    | 分数 / 连击 / 衰减 / 最高分持久化                           |
| `storage.test.ts`       | 20   | 存档读写 / recordResult / 容错 / reset / getItem+setItem 抛错兜底 / durationMs NaN防护 / recentResults 环形缓冲 / migrate 字段补全 |
| `sync.test.ts`          | 16   | 离线入队 / 去重 / 重试 / 幂等 / 上限截断 / flushAll         |

## 下一步（Next）

- **内容深化**：575 个游戏已有，可继续打磨个别游戏的视觉/音效细节与教育内核文案。
- **家长报告增强**：加入周/月趋势曲线、能力雷达图、导出 PDF 报告。
- **i18n**：当前中文优先，可加英文/双语切换（UI 文案集中度已较高）。
- **可访问性**：更多游戏的键盘焦点管理 + 高对比度模式 + 屏幕阅读器语义。
- **性能**：575 个懒加载 chunk 已 OK；可进一步预取相邻游戏、做 chunk 体积监控。
- **e2e 扩面**：smoke suite 覆盖大厅 + 抽样游戏，可扩展为按能力域分组的回归矩阵。

## 与其他项目的关系

独立项目。属游戏系，与 `agenttrain`（单游戏）形态不同——本项目是大规模合集。已接入 e2e-fusion 做跨端回归。
