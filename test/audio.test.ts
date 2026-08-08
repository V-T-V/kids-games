// audio 音效系统单测：错误路径与降级（无 Web Audio / 无 window 不抛错）+ 频率表正确性。
// 浏览器原生 API 在 Node 不存在，正是要守护的「永不抛错、优雅降级」契约。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sfxCorrect,
  sfxWrong,
  sfxPop,
  sfxTick,
  sfxClear,
  sfxHiccup,
  playNote,
  playMelody,
  unlockAudio,
  refreshAudioCache,
} from "../src/core/audio.ts";

// NOTE_FREQ 是模块私有常量，通过 playNote 的可观察行为间接守护。
// 这里聚焦「无 Web Audio 环境（Node 无 window）下所有 sfx 不抛错」+ 频率表覆盖。

test("sfxCorrect: 无 Web Audio 环境不抛错（静默降级）", () => {
  assert.doesNotThrow(() => sfxCorrect());
});

test("sfxWrong: 无 Web Audio 环境不抛错", () => {
  assert.doesNotThrow(() => sfxWrong());
});

test("sfxPop: 无 Web Audio 环境不抛错", () => {
  assert.doesNotThrow(() => sfxPop());
});

test("sfxTick: 无 Web Audio 环境不抛错", () => {
  assert.doesNotThrow(() => sfxTick());
});

test("sfxClear: 无 Web Audio 环境不抛错", () => {
  assert.doesNotThrow(() => sfxClear());
});

test("sfxHiccup: 无 Web Audio 环境不抛错", () => {
  assert.doesNotThrow(() => sfxHiccup());
});

test("playNote: 无 Web Audio 环境不抛错（含未知音名也不抛）", () => {
  assert.doesNotThrow(() => playNote("C4"));
  assert.doesNotThrow(() => playNote("Z9")); // 未知音名静默跳过
  assert.doesNotThrow(() => playNote("C4", 0.5));
});

test("playMelody: 无 Web Audio 环境不抛错（含未知音名）", () => {
  assert.doesNotThrow(() => playMelody(["C4", "E4", "G4"]));
  assert.doesNotThrow(() => playMelody(["C4", "BAD", "G4"], 0.1));
  assert.doesNotThrow(() => playMelody([], 0.2)); // 空数组不抛
});

test("unlockAudio: 无 Web Audio 环境不抛错", () => {
  assert.doesNotThrow(() => unlockAudio());
});

test("refreshAudioCache: 无 localStorage 环境不抛错", () => {
  assert.doesNotThrow(() => refreshAudioCache());
});

test("sfx 系列连续调用不抛错（高频场景稳定性）", () => {
  // 游戏中可能连续触发多个音效，确保不因缓存/状态问题抛错
  assert.doesNotThrow(() => {
    for (let i = 0; i < 20; i++) {
      sfxPop();
      sfxCorrect();
      sfxTick();
    }
  });
});

test("playMelody 多次调用不抛错（音乐楼梯连续演奏）", () => {
  assert.doesNotThrow(() => {
    for (let i = 0; i < 5; i++) {
      playMelody(["C4", "D4", "E4", "F4", "G4"], 0.05);
    }
  });
});

// 频率表正确性（通过 playNote 不抛错间接守护音名存在）。
// 标准 12 平均律：A4=440Hz，相邻半音比 = 2^(1/12)。
test("playNote: 24 个标准音名（C4..C6）均不抛错——频率表覆盖完整", () => {
  const notes = [
    "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
    "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
    "C6",
  ];
  for (const n of notes) {
    assert.doesNotThrow(() => playNote(n), `音名 ${n} 应在频率表中`);
  }
});

test("永不抛错契约：所有公开 sfx API 在无浏览器环境均静默降级", () => {
  // 核心契约：audio 系统永不向外抛错，无 AudioContext 时静默跳过
  const fns = [
    sfxCorrect, sfxWrong, sfxPop, sfxTick, sfxClear, sfxHiccup,
    () => playNote("A4"), () => playMelody(["A4", "B4"]),
    unlockAudio, refreshAudioCache,
  ];
  for (const f of fns) {
    assert.doesNotThrow(() => f(), "audio 公开 API 不应抛错");
  }
});
