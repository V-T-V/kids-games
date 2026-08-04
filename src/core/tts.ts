/**
 * 语音朗读（TTS）—— 用浏览器原生 SpeechSynthesis 朗读游戏任务文案。
 *
 * 面向 3-6 岁不识字的孩子：听到"找出紫色的球"比读文字更友好。
 * 零依赖（浏览器原生 API），离线可用，无需 API key。
 *
 * 默认关闭（家长面板可开），避免不需要朗读的孩子被打扰。
 * 朗读中文（zh-CN），自动选可用的中文语音。
 */
const TTS_KEY = "kids-games-tts-v1";

/** 是否启用朗读。默认关闭，家长在面板开。 */
export function isTTSEnabled(): boolean {
  try {
    return localStorage.getItem(TTS_KEY) === "true";
  } catch {
    return false;
  }
}

/** 设置是否启用朗读（家长面板用）。 */
export function setTTSEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(TTS_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
  if (!enabled) stop();
}

/** 中文语音缓存（getVoices 异步加载，缓存第一次拿到的）。 */
let zhVoice: SpeechSynthesisVoice | null = null;
let voicesChecked = false;

function pickZhVoice(): SpeechSynthesisVoice | null {
  if (voicesChecked) return zhVoice;
  voicesChecked = true;
  try {
    const voices = speechSynthesis.getVoices();
    // 优先 zh-CN，其次任何 zh
    zhVoice =
      voices.find((v) => v.lang === "zh-CN") ??
      voices.find((v) => v.lang.startsWith("zh")) ??
      null;
  } catch {
    zhVoice = null;
  }
  return zhVoice;
}

// voices 异步加载：监听 onvoiceschanged
if (
  typeof speechSynthesis !== "undefined" &&
  speechSynthesis.onvoiceschanged !== undefined
) {
  speechSynthesis.onvoiceschanged = () => {
    voicesChecked = false;
    pickZhVoice();
  };
}

/**
 * 朗读一段中文文本。若 TTS 未启用或浏览器不支持，静默跳过。
 * 会自动取消上一个朗读（避免排队堆积）。
 */
export function speak(text: string): void {
  if (!isTTSEnabled()) return;
  if (typeof speechSynthesis === "undefined") return;
  // 清理 emoji 和多余空白（朗读不需要）
  const clean = text
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, "")
    .trim();
  if (!clean) return;
  try {
    speechSynthesis.cancel(); // 取消上一个
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "zh-CN";
    u.rate = 0.9; // 稍慢，适合孩子
    u.pitch = 1.1; // 略高，更友好
    const v = pickZhVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

/** 停止当前朗读。 */
export function stop(): void {
  try {
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
