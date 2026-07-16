/**
 * 音效系统 —— 纯 Web Audio API 程序合成，零音频文件依赖。
 *
 * 设计要点：
 * - 懒加载：首次用户交互后才创建 AudioContext（浏览器策略要求）。
 * - 可全局静音（家长面板）。
 * - 提供一套语义化 API：correct / wrong / clear / pop / tick / tone，
 *   各游戏直接调用，无需关心波形细节。
 * - 音乐楼梯游戏可通过 playNote() 演奏任意音高。
 */

import { loadSave } from "./storage.ts";

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let masterGain: GainNode | null = null;

/** 安全获取 AudioContext（兼容 webkit 前缀）。 */
function getCtx(): Ctx | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

/**
 * 必须在用户首次交互时调用，解除浏览器自动播放限制。
 * 整个 App 在首次 pointerdown 时统一调用一次即可。
 */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") {
    void c.resume();
  }
}

/** 当前是否被家长静音。
 *  缓存策略：首次读取后缓存，写存档时由 storage 层通知刷新，
 *  避免每次播放音效（高频）都触发 localStorage.getItem + JSON.parse。 */
let cachedMuted: boolean | null = null;

function isMuted(): boolean {
  if (cachedMuted === null) cachedMuted = loadSave().settings.muted;
  return cachedMuted;
}

/** 存档变更时调用，刷新缓存的静音状态。 */
export function refreshAudioCache(): void {
  cachedMuted = loadSave().settings.muted;
}

/**
 * 播放一个带 ADSR 包络的单音。
 * @param freq 频率 Hz
 * @param dur 时长秒
 * @param type 波形
 * @param when 相对当前时间的偏移
 * @param peak 峰值音量
 */
function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  when = 0,
  peak = 0.4,
): void {
  if (isMuted()) return;
  const c = getCtx();
  if (!c || !masterGain) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  // 简易包络：快速起音，指数衰减
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** 答对：明亮的上行三音（C-E-G），清脆叮咚。 */
export function sfxCorrect(): void {
  tone(523.25, 0.14, "sine", 0, 0.4); // C5
  tone(659.25, 0.14, "sine", 0.09, 0.4); // E5
  tone(783.99, 0.22, "sine", 0.18, 0.45); // G5
}

/** 答错：轻柔短促的下行两音，不刺耳（避免挫败）。 */
export function sfxWrong(): void {
  tone(392.0, 0.12, "sine", 0, 0.25); // G4
  tone(329.63, 0.18, "sine", 0.1, 0.25); // E4
}

/** 点击/拾取：清脆水滴。 */
export function sfxPop(): void {
  tone(880, 0.08, "triangle", 0, 0.3);
}

/** 通用 UI 点击。 */
export function sfxTick(): void {
  tone(660, 0.05, "square", 0, 0.12);
}

/** 通关：欢快的五音上行琶音 + 持续尾音。 */
export function sfxClear(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((f, i) => tone(f, 0.16, "triangle", i * 0.1, 0.4));
  tone(1046.5, 0.6, "sine", 0.5, 0.3);
}

/** 失败/打嗝（数字小怪兽吃错）：俏皮的下行滑音。 */
export function sfxHiccup(): void {
  const c = getCtx();
  if (!c || isMuted()) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(500, t0);
  osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.18);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc.connect(g);
  if (masterGain) g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + 0.25);
}

/**
 * 播放一个指定音名的音符（音乐楼梯用）。
 * @param note 音名，如 'C4' 'D#4'
 * @param dur 时长秒
 */
const NOTE_FREQ: Record<string, number> = {
  C4: 261.63,
  "C#4": 277.18,
  D4: 293.66,
  "D#4": 311.13,
  E4: 329.63,
  F4: 349.23,
  "F#4": 369.99,
  G4: 392.0,
  "G#4": 415.3,
  A4: 440.0,
  "A#4": 466.16,
  B4: 493.88,
  C5: 523.25,
  "C#5": 554.37,
  D5: 587.33,
  "D#5": 622.25,
  E5: 659.25,
  F5: 698.46,
  "F#5": 739.99,
  G5: 783.99,
  "G#5": 830.61,
  A5: 880.0,
  "A#5": 932.33,
  B5: 987.77,
  C6: 1046.5,
};

export function playNote(note: string, dur = 0.3): void {
  const freq = NOTE_FREQ[note];
  if (freq) tone(freq, dur, "triangle", 0, 0.35);
}

/**
 * 播放一段旋律（音乐楼梯通关曲）。
 * @param notes 音名数组
 * @param step 每音间隔秒
 */
export function playMelody(notes: string[], step = 0.28): void {
  notes.forEach((n, i) => {
    const freq = NOTE_FREQ[n];
    if (freq) tone(freq, step * 0.9, "triangle", i * step, 0.35);
  });
}
