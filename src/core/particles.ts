/**
 * 粒子 / 彩纸特效系统。
 *
 * 用一个固定全屏 Canvas 绘制，所有游戏共享。
 * 提供 burst()（点击处迸发）与 confetti()（满屏彩纸庆祝）两个高层 API。
 * 内部用单个 requestAnimationFrame 循环管理所有粒子，性能友好。
 *
 * 尊重 prefers-reduced-motion：开启时粒子数与速度按 motionScale 衰减，
 * 让前庭敏感/光敏的孩子或家长不会被满屏粒子干扰。
 */
import type { Particle } from "../types.ts";
import { motionScale } from "./loop.ts";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let rafId: number | null = null;

/** 初始化特效画布（App 启动时调用一次）。 */
export function initParticles(layer: HTMLElement): void {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  ctx = canvas.getContext("2d");
  layer.appendChild(canvas);
  resize();
  window.addEventListener("resize", resize);
}

function resize(): void {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

const PALETTE = [
  "#ff6b9d",
  "#ffd93d",
  "#6bcf7f",
  "#4d96ff",
  "#ff9f43",
  "#a55eea",
  "#ff6348",
  "#00d2d3",
];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** 在指定坐标迸发一束粒子（答对奖励用）。 */
export function burst(
  x: number,
  y: number,
  count = 18,
  shapes: Particle["shape"][] = ["star", "circle", "heart"],
): void {
  const ms = motionScale();
  const n = Math.max(4, Math.round(count * ms));
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const speed = (3 + Math.random() * 4) * ms;
    const life = 40 + Math.floor(Math.random() * 20);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2 * ms,
      size: 8 + Math.random() * 8,
      color: rand(PALETTE),
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3 * ms,
      life,
      maxLife: life,
      shape: rand(shapes),
    });
  }
  ensureLoop();
}

/** 满屏彩纸雨（通关庆祝用）。 */
export function confetti(count = 80): void {
  if (!canvas) return;
  const ms = motionScale();
  const w = canvas.width;
  const n = Math.max(12, Math.round(count * ms));
  for (let i = 0; i < n; i++) {
    const life = 90 + Math.floor(Math.random() * 60);
    particles.push({
      x: Math.random() * w,
      y: -20 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 3 * ms,
      vy: (2 + Math.random() * 3) * ms,
      size: 8 + Math.random() * 10,
      color: rand(PALETTE),
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.4 * ms,
      life,
      maxLife: life,
      shape: Math.random() < 0.5 ? "rect" : "circle",
    });
  }
  ensureLoop();
}

function ensureLoop(): void {
  if (rafId !== null) return;
  const loop = () => {
    step();
    if (particles.length > 0) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  rafId = requestAnimationFrame(loop);
}

function step(): void {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gravity = 0.12;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    p.vy += gravity;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vrot;
    p.life -= 1;
    if (p.life <= 0 || p.y > canvas.height + 40) {
      particles.splice(i, 1);
      continue;
    }
    drawParticle(p);
  }
}

function drawParticle(p: Particle): void {
  if (!ctx) return;
  const alpha = Math.min(1, p.life / (p.maxLife * 0.4));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  const s = p.size;
  switch (p.shape) {
    case "circle":
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "rect":
      ctx.fillRect(-s / 2, -s / 3, s, (s * 2) / 3);
      break;
    case "heart":
      drawHeart(s);
      break;
    case "star":
      drawStar(s);
      break;
  }
  ctx.restore();
}

function drawStar(s: number): void {
  if (!ctx) return;
  ctx.beginPath();
  const spikes = 5;
  const outer = s / 2;
  const inner = outer * 0.45;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawHeart(s: number): void {
  if (!ctx) return;
  const k = s / 16;
  ctx.beginPath();
  ctx.moveTo(0, 4 * k);
  ctx.bezierCurveTo(-2 * k, -3 * k, -8 * k, -3 * k, -8 * k, 2 * k);
  ctx.bezierCurveTo(-8 * k, 7 * k, 0, 8 * k, 0, 8 * k);
  ctx.bezierCurveTo(0, 8 * k, 8 * k, 7 * k, 8 * k, 2 * k);
  ctx.bezierCurveTo(8 * k, -3 * k, 2 * k, -3 * k, 0, 4 * k);
  ctx.closePath();
  ctx.fill();
}

/** 清空所有粒子（切换游戏/场景时调用）。 */
export function clearParticles(): void {
  particles = [];
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}
