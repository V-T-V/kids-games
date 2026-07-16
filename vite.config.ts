import { defineConfig } from "vite";

// 童趣游戏屋 —— 纯前端静态站，无需后端代理。
// 构建产物为可双击打开的静态文件（部署到任意静态托管）。
export default defineConfig({
  // 相对路径，便于子目录部署 / 本地直接打开
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    // 儿童游戏不强求分包，保持简单
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5190,
    open: true,
  },
});
