/**
 * 童趣游戏屋 —— 全局类型定义。
 *
 * 所有游戏、引擎、UI 都从这里取类型，保证 81 个游戏体验一致。
 */

/** 难度档位：自适应难度根据孩子表现在这三档之间切换。 */
export type Difficulty = "easy" | "medium" | "hard";

/** 游戏标识符，同时也是 hash 路由路径，如 `#/color-mixer`。 */
export type GameId =
  // —— 第一批 8 个 ——
  | "color-mixer"
  | "shape-match"
  | "number-monster"
  | "letter-bee"
  | "memory-flip"
  | "music-stairs"
  | "maze-adventure"
  | "seek-find"
  // —— 第二批 16 个 ——
  | "size-sort"
  | "jigsaw"
  | "pattern"
  | "whack-mole"
  | "doodle"
  | "weather"
  | "clock"
  | "animal-sound"
  | "color-sort"
  | "connect-dots"
  | "shadow-match"
  | "tangram"
  | "farm-math"
  | "balance"
  | "robot-code"
  | "dress-up"
  // —— 第三批 25 个 ——
  | "fruit-catch" // 接水果：移动篮子接下落水果
  | "link-match" // 连连看：相同图案连线消除
  | "feed-order" // 喂养顺序：按指定顺序点动物
  | "pinyin" // 拼音首字母：找对应拼音的字
  | "antonym" // 找反义词
  | "sliding-puzzle" // 数字华容道
  | "color-reaction" // 颜色反应：听到颜色名点对应色
  | "equation" // 等式填空：让等式成立
  | "spot-diff" // 找不同：两图差异
  | "tidy-up" // 收拾房间：物品归位
  | "mini-sudoku" // 迷你数独：2x2/3x3 填不重复
  | "pipe-connect" // 接水管：旋转管道连通
  | "weight-sort" // 称重排序：按轻重排队
  | "catch-star" // 接星星：限时收集
  | "draw-along" // 照着画：临摹虚线图形
  | "emotion" // 表情配对：情境配情绪
  | "direction" // 方向辨别：左右上下
  | "length" // 比长短
  | "more-less" // 多少比较
  | "symmetry" // 对称：补全对称图形
  | "rhythm" // 节奏模仿：记忆并重复节奏
  | "fishing" // 钓鱼：钓指定鱼
  | "block-tower" // 搭积木塔
  | "word-chain" // 词语接龙（图）
  | "reverse-memory" // 倒序记忆
  // —— 第四批 32 个 ——
  | "claw" // 抓娃娃机
  | "bubble-shoot" // 泡泡射击
  | "wheel" // 转盘抽奖
  | "pinball" // 弹珠台
  | "guess-card" // 翻牌猜大小
  | "snake" // 贪吃蛇
  | "2048" // 数字合并
  | "number-sequence" // 数字序列填空
  | "pinyin-puzzle" // 拼音拼图
  | "radical" // 部首配对
  | "idiom" // 成语接龙
  | "measure-word" // 量词搭配
  | "stroke-order" // 笔画顺序
  | "homophone" // 同音字
  | "similar-char" // 形近字
  | "word-classify" // 词语分类
  | "fraction" // 分数披萨
  | "time-timeline" // 时间线排序
  | "thermometer" // 温度计认读
  | "calendar" // 日历认知
  | "money" // 人民币换算
  | "ruler" // 测量尺
  | "symmetry-axis" // 对称轴判定
  | "3d-shape" // 立体图形
  | "color-gradient" // 颜色渐变排序
  | "spectrum" // 光谱波长
  | "constellation" // 星座连线
  | "planet-orbit" // 行星轨道
  | "ecosystem" // 食物链
  | "weather-forecast" // 天气预测
  | "magnet-maze" // 磁铁迷宫
  | "circuit"; // 电路连通

/** 游戏元信息：用于大厅卡片展示与路由注册。 */
export interface GameMeta {
  id: GameId;
  /** 大厅卡片标题 */
  title: string;
  /** 一句话副标题（给家长看的教育内核） */
  subtitle: string;
  /** 卡片 emoji 图标 */
  icon: string;
  /** 卡片渐变主题色（CSS 变量键名） */
  theme: string;
  /** 适龄范围文案 */
  age: string;
  /** 教育内核标签 */
  tag: string;
}

/** 单局游戏结算数据，驱动夸赞与成就。 */
export interface GameResult {
  gameId: GameId;
  /** 是否通关 */
  cleared: boolean;
  /** 星级 0-3（部分游戏按收集/用时/连击评定） */
  stars: number;
  /** 当前难度 */
  difficulty: Difficulty;
  /** 耗时（毫秒），无时效的游戏可省略 */
  durationMs?: number;
}

/** 持久化的单个游戏进度。 */
export interface GameProgress {
  /** 最高通关难度 */
  bestDifficulty: Difficulty | null;
  /** 最高星数 */
  bestStars: number;
  /** 累计游玩次数 */
  playCount: number;
  /** 累计有效游玩时长（毫秒，仅统计有结算耗时的游戏） */
  totalDurationMs: number;
  /** 是否已通关 */
  cleared: boolean;
  /** 最近一次结算 */
  lastResult: GameResult | null;
}

/** 整体存档结构（localStorage）。 */
export interface SaveData {
  version: number;
  progress: Record<GameId, GameProgress>;
  /** 已解锁的成就 id 列表 */
  achievements: string[];
  /** 家长设置 */
  settings: ParentSettings;
}

/** 家长面板可控设置。 */
export interface ParentSettings {
  /** 是否静音 */
  muted: boolean;
  /** 锁定难度（null = 自适应） */
  lockedDifficulty: Difficulty | null;
  /** 是否启用"连续答错休息"护盾 */
  restShield: boolean;
}

/** 标准化指针位置，input.ts 把 mouse/touch/pen 统一成这个。 */
export interface Pointer {
  x: number;
  y: number;
  /** 指针唯一 id（多点触控区分） */
  id: number;
}

/** 统一指针事件回调签名。 */
export type PointerHandler = (p: Pointer) => void;

/** 粒子（彩纸/星星）定义，particles.ts 使用。 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  /** 旋转（弧度） */
  rot: number;
  vrot: number;
  /** 剩余生命（帧） */
  life: number;
  maxLife: number;
  shape: "circle" | "star" | "rect" | "heart";
}
