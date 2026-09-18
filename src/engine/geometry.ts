import type { Rect, SafeArea } from '../types';

export function safeRect(width: number, height: number, safe: SafeArea): Rect {
  return {
    x: safe.left,
    y: safe.top,
    width: Math.max(0, width - safe.left - safe.right),
    height: Math.max(0, height - safe.top - safe.bottom),
  };
}

export function rectsOverlap(a: Rect, b: Rect, eps = 0.5): boolean {
  return (
    a.x < b.x + b.width - eps &&
    a.x + a.width > b.x + eps &&
    a.y < b.y + b.height - eps &&
    a.y + a.height > b.y + eps
  );
}

export function intersectionRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

export type Edge = 'top' | 'right' | 'bottom' | 'left';

/** 矩形相对目标矩形越出的边与距离（在目标内则不返回该边） */
export function overflowEdges(box: Rect, bounds: Rect): { edge: Edge; amount: number }[] {
  const out: { edge: Edge; amount: number }[] = [];
  if (box.y < bounds.y) out.push({ edge: 'top', amount: bounds.y - box.y });
  if (box.x + box.width > bounds.x + bounds.width)
    out.push({ edge: 'right', amount: box.x + box.width - (bounds.x + bounds.width) });
  if (box.y + box.height > bounds.y + bounds.height)
    out.push({ edge: 'bottom', amount: box.y + box.height - (bounds.y + bounds.height) });
  if (box.x < bounds.x) out.push({ edge: 'left', amount: bounds.x - box.x });
  return out;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
