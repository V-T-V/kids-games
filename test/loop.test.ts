// loop 单测：验证三个工厂函数返回 stop 且可调用（不模拟 rAF 帧，只验契约）。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRafLoop,
  createFixedStepLoop,
  createIntervalLoop,
} from "../src/core/loop.ts";

test("createIntervalLoop stop 清除 interval 且不触发 tick", () => {
  let calls = 0;
  const stop = createIntervalLoop(1000, () => {
    calls += 1;
  });
  stop();
  assert.equal(calls, 0, "stop 后不应触发 tick");
});

test("createRafLoop 返回 stop 函数", () => {
  // node 无 rAF，注入空 mock（不实际驱动帧，只验证 stop 可调用不抛错）
  const origRaf = (globalThis as { requestAnimationFrame?: unknown })
    .requestAnimationFrame;
  const origCancel = (globalThis as { cancelAnimationFrame?: unknown })
    .cancelAnimationFrame;
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame =
    (() => 0) as never;
  (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame =
    (() => {}) as never;
  try {
    const stop = createRafLoop(() => {});
    assert.equal(typeof stop, "function", "应返回 stop 函数");
    // 调用 stop 不应抛错
    stop();
    assert.ok(true, "stop 调用成功");
  } finally {
    if (origRaf === undefined)
      delete (globalThis as { requestAnimationFrame?: unknown })
        .requestAnimationFrame;
    else
      (
        globalThis as { requestAnimationFrame?: unknown }
      ).requestAnimationFrame = origRaf;
    if (origCancel === undefined)
      delete (globalThis as { cancelAnimationFrame?: unknown })
        .cancelAnimationFrame;
    else
      (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame =
        origCancel;
  }
});

test("createFixedStepLoop 返回 stop 函数", () => {
  const origRaf = (globalThis as { requestAnimationFrame?: unknown })
    .requestAnimationFrame;
  const origCancel = (globalThis as { cancelAnimationFrame?: unknown })
    .cancelAnimationFrame;
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame =
    (() => 0) as never;
  (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame =
    (() => {}) as never;
  try {
    const stop = createFixedStepLoop(1 / 60, {
      update: () => {},
      render: () => {},
    });
    assert.equal(typeof stop, "function", "应返回 stop 函数");
    stop();
    assert.ok(true, "stop 调用成功");
  } finally {
    if (origRaf === undefined)
      delete (globalThis as { requestAnimationFrame?: unknown })
        .requestAnimationFrame;
    else
      (
        globalThis as { requestAnimationFrame?: unknown }
      ).requestAnimationFrame = origRaf;
    if (origCancel === undefined)
      delete (globalThis as { cancelAnimationFrame?: unknown })
        .cancelAnimationFrame;
    else
      (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame =
        origCancel;
  }
});

test("createRafLoop dt 钳制到 [0, 0.1]", () => {
  // 通过捕获 update 收到的 dt，验证钳制逻辑
  const received: number[] = [];
  let driveFrame: ((now: number) => void) | null = null;
  const origRaf = (globalThis as { requestAnimationFrame?: unknown })
    .requestAnimationFrame;
  const origCancel = (globalThis as { cancelAnimationFrame?: unknown })
    .cancelAnimationFrame;
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = ((
    cb: (t: number) => void,
  ) => {
    driveFrame = cb;
    return 0;
  }) as never;
  (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame =
    (() => {}) as never;
  const lastNow = 1000;
  const origPerf = (globalThis as { performance?: unknown }).performance;
  (globalThis as { performance?: unknown }).performance = {
    now: () => lastNow,
  } as never;
  try {
    const stop = createRafLoop((dt) => {
      received.push(dt);
    });
    // 第一帧：now=1000 → dt=0（同 now）
    driveFrame!(1000);
    // 第二帧：now=2000 → dt=1.0，应钳到 0.1
    driveFrame!(2000);
    // 第三帧：now=2000 → dt=0
    driveFrame!(2000);
    stop();
    assert.ok(received.length >= 1, "update 至少调用一次");
    // 所有 dt 应在 [0, 0.1]
    for (const dt of received) {
      assert.ok(dt >= 0 && dt <= 0.1, `dt=${dt} 应在 [0, 0.1]`);
    }
  } finally {
    if (origRaf === undefined)
      delete (globalThis as { requestAnimationFrame?: unknown })
        .requestAnimationFrame;
    else
      (
        globalThis as { requestAnimationFrame?: unknown }
      ).requestAnimationFrame = origRaf;
    if (origCancel === undefined)
      delete (globalThis as { cancelAnimationFrame?: unknown })
        .cancelAnimationFrame;
    else
      (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame =
        origCancel;
    if (origPerf === undefined)
      delete (globalThis as { performance?: unknown }).performance;
    else (globalThis as { performance?: unknown }).performance = origPerf;
  }
});
