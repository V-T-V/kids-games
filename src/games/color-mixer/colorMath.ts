/**
 * 颜色混合算法 —— 模拟真实颜料混合（减色法），非 RGB 直接相加。
 *
 * 工巧思：儿童对"红+蓝=紫"有直觉，但 RGB 相加（光）会让红+绿=黄、
 * 颜料感全无。这里用"次表面颜料混合"近似：
 * 把各分量做加权平均（按滴数），得到真实颜料观感。
 *
 * 同时提供"目标色匹配"判定（容差比较）。
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** 三原色颜料（儿童认知里的红黄蓝）。 */
export const PRIMARY_COLORS: Record<string, RGB> = {
  红: { r: 230, g: 40, b: 60 },
  黄: { r: 245, g: 210, b: 30 },
  蓝: { r: 40, g: 110, b: 220 },
  白: { r: 255, g: 255, b: 255 },
  黑: { r: 25, g: 25, b: 30 },
};

/** 一滴颜料的定义：颜色 + 滴数权重。 */
export interface Drop {
  color: RGB;
  /** 滴数，默认 1 */
  amount?: number;
}

/**
 * 混合多滴颜料：按"滴数"加权平均各通道。
 * 这模拟真实颜料混合（红+黄=橙，蓝+黄=绿，红+蓝=紫）。
 */
export function mix(drops: Drop[]): RGB {
  if (drops.length === 0) return { r: 255, g: 255, b: 255 };
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (const d of drops) {
    const amt = d.amount ?? 1;
    r += d.color.r * amt;
    g += d.color.g * amt;
    b += d.color.b * amt;
    total += amt;
  }
  return {
    r: Math.round(r / total),
    g: Math.round(g / total),
    b: Math.round(b / total),
  };
}

/** RGB 转十六进制字符串。 */
export function toHex({ r, g, b }: RGB): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** 十六进制转 RGB。 */
export function fromHex(hex: string): RGB {
  const m = hex.replace("#", "");
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

/** 两颜色是否在容差内相同（欧氏距离）。 */
export function isMatch(a: RGB, b: RGB, tolerance = 36): boolean {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);
  return dist <= tolerance;
}

/** 颜色名称猜测（用于反馈，如"你调出了紫色！"）。 */
export function nameOf(c: RGB): string {
  const { r, g, b } = c;
  // 转 HSV 辅助判定
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  if (v < 0.25) return "黑色";
  if (s < 0.18) return v > 0.8 ? "白色" : "灰色";
  const hue = rgbToHue(r, g, b);
  if (hue < 15 || hue >= 345) return "红色";
  if (hue < 40) return "橙色";
  if (hue < 70) return "黄色";
  if (hue < 160) return "绿色";
  if (hue < 200) return "青色";
  if (hue < 260) return "蓝色";
  if (hue < 300) return "紫色";
  return "粉色";
}

function rgbToHue(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}
