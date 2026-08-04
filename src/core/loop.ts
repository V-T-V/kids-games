/**
 * 游戏循环工具：消除 12 个实时游戏里重复的 requestAnimationFrame/setInterval 样板。
 *
 * 设计参考 web-game-research/games/star-battle.md（全局 rAF 注册表）+
 * agenttrain 的固定步长累加器。提供两种模式：
 *   - rAF（默认）：可变步长，每帧调 update(dt)，适合动画/连续运动（fruit-catch/pinball）
 *   - fixed：固定步长累加器，逻辑以固定频率推进、渲染插值，适合需要确定性的游戏
 *   - interval：setInterval 简单定时，适合网格离散推进（snake/whack-mole）
 *
 * 所有模式都返回 stop() 函数，调用即停止并在卸载时自动取消（无需手写 cancelAnimationFrame/clearInterval）。
 */

/**
 * 检测用户是否在系统层开启了"减少动态效果"（prefers-reduced-motion）。
 * 用于让 Canvas/RAF 驱动的动画尊重该设置——前庭敏感/光敏的孩子或家长
 * 即便系统开了"减少动态效果"，全局 CSS 规则也只能压 CSS 动画，
 * 压不到 requestAnimationFrame 驱动的游戏动画。游戏应主动读取此值降速或简化。
 *
 * 返回 0~1 的"动画强度因子"：开启减少动态时返回 0.35（保留可玩性但大幅降速+降幅），
 * 否则返回 1（正常）。游戏可把它乘到速度/粒子数/振幅上。
 */
export function motionScale(): number {
  if (typeof window === "undefined" || !window.matchMedia) return 1;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0.35
    : 1;
}

export interface GameLoopOptions {
  /** 每帧/每 tick 调用。rAF 模式收到真实 dt（秒，已钳制到 [0, 0.1]）；fixed 模式收到固定步长。 */
  update: (dt: number) => void;
  /** 渲染回调（可选，仅 fixed 模式有效，收到插值因子 alpha∈[0,1)）。 */
  render?: (alpha: number) => void;
}

/**
 * 创建 requestAnimationFrame 驱动的可变步长循环。
 * @returns stop 函数，调用即取消（unmount 时调）。
 *
 * 用法（替换 game 里的 `this.raf = requestAnimationFrame(this.loop)`）：
 *   private stop?: () => void;
 *   mount() { this.stop = createRafLoop((dt) => this.update(dt)); }
 *   unmount() { this.stop?.(); }
 */
export function createRafLoop(update: (dt: number) => void): () => void {
  let raf = 0;
  let last = performance.now();
  let stopped = false;
  const frame = (now: number): void => {
    if (stopped) return;
    let dt = (now - last) / 1000;
    last = now;
    // 钳制：上限 0.1s 防切后台跳太远；下限 0 防抖动负值
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    update(dt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/**
 * 创建固定步长累加器循环（逻辑固定频率，渲染可选插值）。
 * @param step 固定步长（秒），如 1/60
 * @param opts.update 逻辑更新（收到固定 step）
 * @param opts.render 渲染（收到插值 alpha）
 * @returns stop 函数
 */
export function createFixedStepLoop(
  step: number,
  opts: GameLoopOptions,
): () => void {
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let stopped = false;
  const maxSubSteps = 5; // 防切后台回来追帧爆炸
  const frame = (now: number): void => {
    if (stopped) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // 切 tab 回来丢弃积压
    acc += dt;
    let n = 0;
    while (acc >= step && n < maxSubSteps) {
      opts.update(step);
      acc -= step;
      n++;
    }
    if (n === maxSubSteps) acc = 0; // 追帧上限：丢弃剩余
    if (opts.render) opts.render(step > 0 ? acc / step : 0);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}

/**
 * 创建 setInterval 驱动的简单定时循环（网格离散推进用，如 snake）。
 * @param intervalMs 间隔毫秒
 * @param tick 每 intervalMs 调用一次
 * @returns stop 函数
 */
export function createIntervalLoop(
  intervalMs: number,
  tick: () => void,
): () => void {
  // 用全局 setInterval（浏览器和 node 都有），避免 window 引用在 SSR/测试环境未定义。
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
