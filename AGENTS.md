# kids-games · AGENTS.md

## 项目内容（What）
为 **3~6 岁儿童**设计的网页小游戏合集，**81 个**寓教于乐的小游戏，有设计感、有巧思。零第三方游戏引擎，纯 Vite + TypeScript + 原生 Canvas/DOM/SVG，构建后是**可离线安装的 PWA**，手机/平板/电脑通吃。

不做：不做大型游戏引擎、不做多人/在线对战、不做付费/账号体系。

## 目标（Goal）
- 81 个真正可玩、有教育内核（颜色/形状/数字/字母/记忆/逻辑……）、有交互巧思的小游戏。
- 零运行时游戏引擎依赖，纯原生实现，构建产物可双击打开。
- 儿童友好：吉祥物引导、语音/音效、成就、家长报告面板。

## 当前情况（Status）
**功能完整，大规模。** README 宣称 81 个游戏——**核实属实**（`src/games/` 81 个子目录，`registry.ts` 81 条 id，二者一致）。

- **81 个游戏**：每个独立目录，绝大多数单 `index.ts`，少数有算法模块（colorMath/maze/pathfind/pattern）
- **core/ 12 个核心模块**：achievements / audio / engine / input / mascot / parentReport / particles / praise / pwa / scoring / storage / toast
- **ui/ + lobby/**：Button / Overlay / ParentPanel / 大厅 / 内容过滤
- **PWA**：已构建 dist/（含 sw.js / manifest.webmanifest），可离线安装
- **测试 10 个**：colorMath / lobby_filters / maze / parentReport / pathfind / pattern / pwa / registry / scoring / storage（**核心算法级，非逐游戏测试**）

## 技术栈与架构
- **语言**：TypeScript，ESM，Node ≥ 20.19
- **依赖**：**无运行时 dependencies**（devDeps：vite / tsx / typescript / eslint / prettier）
- **关键**：`src/games/registry.ts` 是**内容规模的唯一事实来源**——README/存档/成就/家长面板都从 GAMES 数组派生。凡提及游戏数，引用它。

```
src/
├── main.ts, router.ts, types.ts, style.css, lobby.css
├── core/      12 模块（achievements/audio/engine/input/mascot/
│              parentReport/particles/praise/pwa/scoring/storage/toast）
├── ui/        Button, Overlay, ParentPanel, toast
├── lobby/     Lobby.ts, contentFilters.ts, util.ts
└── games/     registry.ts(注册表) + shell.ts(游戏外壳)
               + 81 个游戏目录（每个一个 index.ts）
```

## 如何运行
```bash
npm install
npm run dev          # Vite 开发服务器
npm run build        # 生产构建（dist/，PWA）
npm run preview      # 预览构建产物
npm test             # 10 个测试
npm run type-check / lint / format
```

## 关键约定
- **`registry.ts` 是唯一事实源**：新增/删除游戏必须在 registry 加 GAMES 条目，其余（README 数字、成就、家长面板）自动派生。改游戏数**不要**手改 README 数字。
- 每个游戏一个独立目录，入口 `index.ts`，遵守 `Game` 接口约定。
- 测试针对**核心算法**（colorMath/maze/pathfind 等），不是每个游戏一个测试——新游戏有算法逻辑时才加测试。
- 零运行时依赖：用原生 Canvas/DOM/SVG，不引游戏引擎。
- 内容过滤（lobby/contentFilters.ts）按年龄段筛选，改标签会影响大厅展示。

## 与其他项目的关系
独立项目。属游戏系，与 `agenttrain`（单游戏）形态不同——本项目是大规模合集。
