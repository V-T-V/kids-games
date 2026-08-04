import { defineConfig } from "vite";

// 童趣游戏屋 —— 纯前端静态站，无需后端代理。
// 构建产物为可双击打开的静态文件（部署到任意静态托管）。
export default defineConfig({
  // 相对路径，便于子目录部署 / 本地直接打开
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020",
    chunkSizeWarningLimit: 1500,
    // 把 registry（368个游戏元信息 ~55KB）拆为独立 chunk，
    // 让首屏主 JS 从 134KB 减到 ~75KB，浏览器并行下载。
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("registry.ts")) return "registry";
        },
      },
    },
  },
  server: {
    port: 5190,
    open: true,
  },
});
