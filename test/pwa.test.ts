import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

test("pwa: index 声明 manifest、主题色与 81 游戏标题", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /theme-color/);
  assert.match(html, /81 个小游戏/);
});

test("pwa: manifest 可安装且指向离线图标", () => {
  const manifest = JSON.parse(
    readFileSync(join(root, "public", "manifest.webmanifest"), "utf8"),
  ) as {
    name: string;
    display: string;
    icons: Array<{ src: string }>;
  };
  assert.equal(manifest.name, "童趣游戏屋");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.src.includes("icon.svg")));
});

test("pwa: service worker 缓存 app shell 并处理 fetch", () => {
  const sw = readFileSync(join(root, "public", "sw.js"), "utf8");
  assert.match(sw, /CACHE_NAME/);
  assert.match(sw, /index\.html/);
  assert.match(sw, /addEventListener\(["']fetch["']/);
});
