// ESLint 9 flat config —— 童趣游戏屋（纯前端 DOM/Canvas 项目）。
// 与工作区兄弟项目（dashan）保持一致的规则集。
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      ".git/",
      "*.log",
      "e2e/",
      "_drivers.js",
      "_testharness.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        // Web Audio / Canvas 浏览器全局
        AudioContext: "readonly",
        webkitAudioContext: "readonly",
        PointerEvent: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
      // 游戏主循环常含串行 await
      "no-await-in-loop": "off",
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        document: "readonly",
        window: "readonly",
        HTMLElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        Event: "readonly",
        MouseEvent: "readonly",
        TouchEvent: "readonly",
        KeyboardEvent: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        location: "readonly",
        history: "readonly",
        crypto: "readonly",
      },
    },
  },
  {
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        URL: "readonly",
      },
    },
  },
);
