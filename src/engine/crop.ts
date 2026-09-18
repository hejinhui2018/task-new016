import type { Rect, Size } from '../types';

/**
 * 背景 cover 裁切计算：等比放大素材直到完全覆盖画板（不留白），
 * 再按焦点 (fx, fy)（归一化 0..1）决定取素材的哪个窗口，
 * 焦点尽量映射到画板对应比例位置；素材边缘不够时夹回并标记 clamped。
 *
 * 因为是 cover，素材始终被裁掉一部分（宽幅裁两侧、竖版裁上下），
 * 焦点控制的正是「保住画面里的哪一块」。
 */
export interface CoverResult {
  /** 素材绘制到画板时的矩形（cover 后等于画板大小，保留字段便于扩展 letterbox） */
  imageRect: Rect;
  /** 素材像素坐标系下的可见窗口 */
  crop: { sx: number; sy: number; sw: number; sh: number; scale: number };
  focalPoint: { x: number; y: number };
  clampedX: boolean;
  clampedY: boolean;
}

export function coverCrop(
  image: Size,
  canvas: Size,
  fx: number,
  fy: number,
): CoverResult {
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  // 素材可见窗口尺寸
  const sw = canvas.width / scale;
  const sh = canvas.height / scale;

  // 希望焦点在素材中的像素位置；窗口在其周围，夹在素材边界内
  const maxSx = image.width - sw;
  const maxSy = image.height - sh;
  const rawSx = fx * image.width - sw / 2;
  const rawSy = fy * image.height - sh / 2;
  const sx = clamp(rawSx, 0, Math.max(0, maxSx));
  const sy = clamp(rawSy, 0, Math.max(0, maxSy));

  // 焦点实际落在画板上的位置（反算）
  const focalCanvasX = (fx * image.width - sx) * scale;
  const focalCanvasY = (fy * image.height - sy) * scale;

  return {
    imageRect: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    crop: { sx, sy, sw, sh, scale },
    focalPoint: { x: focalCanvasX, y: focalCanvasY },
    clampedX: Math.abs(rawSx - sx) > 0.5,
    clampedY: Math.abs(rawSy - sy) > 0.5,
  };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function insetRect(outer: Rect, insets: {
  top: number;
  right: number;
  bottom: number;
  left: number;
}): Rect {
  return {
    x: outer.x + insets.left,
    y: outer.y + insets.top,
    width: outer.width - insets.left - insets.right,
    height: outer.height - insets.top - insets.bottom,
  };
}

/** 矩形相对 safe 各边的溢出量（正值=超出安全区） */
export function overflowOf(rect: Rect, safe: Rect) {
  return {
    top: Math.max(0, safe.y - rect.y),
    right: Math.max(0, rect.x + rect.width - (safe.x + safe.width)),
    bottom: Math.max(0, rect.y + rect.height - (safe.y + safe.height)),
    left: Math.max(0, safe.x - rect.x),
  };
}
