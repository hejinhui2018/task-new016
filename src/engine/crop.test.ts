import { describe, expect, it } from 'vitest';
import { BG_IMAGE_SIZE, PLACEMENTS } from '../data/defaults';
import { coverCrop } from './crop';

describe('coverCrop 背景焦点裁切', () => {
  it('宽幅画板：等比放大到覆盖，素材左右被裁、上下铺满', () => {
    const r = coverCrop(BG_IMAGE_SIZE, PLACEMENTS.web.canvas, 0.62, 0.42);
    const { canvas } = PLACEMENTS.web;
    // 覆盖比例取宽高比的较大者
    expect(r.crop.scale).toBeCloseTo(canvas.width / BG_IMAGE_SIZE.width, 5);
    expect(r.crop.scale).toBeGreaterThan(canvas.height / BG_IMAGE_SIZE.height);
    // 可见窗口放大后恰好铺满画板，无留白
    expect(r.crop.sw * r.crop.scale).toBeCloseTo(canvas.width, 5);
    expect(r.crop.sh * r.crop.scale).toBeCloseTo(canvas.height, 5);
    // 窗口完全位于素材内
    expect(r.crop.sx).toBeGreaterThanOrEqual(0);
    expect(r.crop.sy).toBeGreaterThanOrEqual(0);
    expect(r.crop.sx + r.crop.sw).toBeLessThanOrEqual(BG_IMAGE_SIZE.width + 1e-6);
    expect(r.crop.sy + r.crop.sh).toBeLessThanOrEqual(BG_IMAGE_SIZE.height + 1e-6);
  });

  it('竖版画板：素材上下铺满、左右被裁，纵向焦点被夹回并标记 clampedY', () => {
    const r = coverCrop(BG_IMAGE_SIZE, PLACEMENTS.mobile.canvas, 0.62, 0.42);
    expect(r.crop.sh).toBeCloseTo(BG_IMAGE_SIZE.height, 5); // 高度方向无裁切
    expect(r.crop.sw).toBeLessThan(BG_IMAGE_SIZE.width); // 左右被裁
    expect(r.crop.sy).toBe(0);
    expect(r.clampedY).toBe(true); // 期望焦点更高，但素材上沿不够
    expect(r.clampedX).toBe(false);
  });

  it('方图画板：窗口为居中附近的正方形', () => {
    const r = coverCrop(BG_IMAGE_SIZE, PLACEMENTS.social.canvas, 0.5, 0.5);
    expect(r.crop.sw).toBeCloseTo(600 / r.crop.scale, 5);
    expect(r.crop.sh).toBeCloseTo(600 / r.crop.scale, 5);
    // 正中焦点：窗口居中，不夹回
    expect(r.crop.sx).toBeCloseTo((BG_IMAGE_SIZE.width - r.crop.sw) / 2, 5);
    expect(r.crop.sy).toBeCloseTo((BG_IMAGE_SIZE.height - r.crop.sh) / 2, 5);
    expect(r.clampedX).toBe(false);
    expect(r.clampedY).toBe(false);
  });

  it('极端焦点 fx=0 / fx=1 被夹到素材边缘并标记 clampedX', () => {
    const left = coverCrop(BG_IMAGE_SIZE, PLACEMENTS.web.canvas, 0, 0.5);
    const right = coverCrop(BG_IMAGE_SIZE, PLACEMENTS.web.canvas, 1, 0.5);
    expect(left.crop.sx).toBe(0);
    expect(right.crop.sx).toBeCloseTo(BG_IMAGE_SIZE.width - right.crop.sw, 5);
    expect(left.clampedX).toBe(true);
    expect(right.clampedX).toBe(true);
  });

  it('焦点映射回画板后始终落在画板范围内', () => {
    for (const fx of [0, 0.25, 0.62, 1]) {
      for (const fy of [0, 0.42, 1]) {
        const r = coverCrop(BG_IMAGE_SIZE, PLACEMENTS.mobile.canvas, fx, fy);
        expect(r.focalPoint.x).toBeGreaterThanOrEqual(-1e-6);
        expect(r.focalPoint.x).toBeLessThanOrEqual(PLACEMENTS.mobile.canvas.width + 1e-6);
        expect(r.focalPoint.y).toBeGreaterThanOrEqual(-1e-6);
        expect(r.focalPoint.y).toBeLessThanOrEqual(PLACEMENTS.mobile.canvas.height + 1e-6);
      }
    }
  });
});
