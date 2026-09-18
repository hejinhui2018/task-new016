import { describe, expect, it } from 'vitest';
import {
  createInitialDoc,
  MASTER_MAP,
  PLACEMENTS,
} from '../data/defaults';
import { computeLayout } from './index';
import { measureElement, solveLayout } from './layout';
import { resolveAll } from './resolve';
import { measureText } from './textMeasure';
import type { Doc, ElementId, ElementPatch, PlacementId } from '../types';

const LONG_TITLE = '秋季发布会 · 新一代极光系列正式登场，预约直播享限定好礼';

function docWith(
  master: Partial<Record<ElementId, ElementPatch>> = {},
  overrides: Partial<Record<PlacementId, Partial<Record<ElementId, ElementPatch>>>> = {},
): Doc {
  const doc = createInitialDoc();
  doc.master = master as Doc['master'];
  for (const [scope, map] of Object.entries(overrides)) {
    doc.placements[scope as PlacementId].overrides = map as never;
  }
  return doc;
}

function inRect(x: number, y: number, r: { x: number; y: number; width: number; height: number }) {
  return x >= r.x - 1e-6 && y >= r.y - 1e-6 && x <= r.x + r.width + 1e-6 && y <= r.y + r.height + 1e-6;
}

describe('默认「秋季发布会」素材', () => {
  const doc = createInitialDoc();

  it('三个版位初始均无冲突', () => {
    for (const scope of ['web', 'mobile', 'social'] as PlacementId[]) {
      const l = computeLayout(doc, scope);
      expect(l.violations).toEqual([]);
    }
  });

  it('所有元素严格位于安全区内（不会裁掉 Logo/按钮/免责声明）', () => {
    for (const scope of ['web', 'mobile', 'social'] as PlacementId[]) {
      const l = computeLayout(doc, scope);
      for (const id of ['logo', 'title', 'cta', 'disclaimer'] as ElementId[]) {
        const r = l.elements[id].rect;
        expect(inRect(r.x, r.y, l.safe), `${scope}.${id} 左上`).toBe(true);
        expect(inRect(r.x + r.width, r.y + r.height, l.safe), `${scope}.${id} 右下`).toBe(true);
      }
    }
  });

  it('锚定与间距被精确满足：Logo 贴顶、标题 = Logo 底 + 间距、按钮 = 标题底 + 间距', () => {
    const l = computeLayout(doc, 'web');
    const { safe, elements } = l;
    expect(elements.logo.rect.y).toBe(safe.y + (MASTER_MAP.logo.vMargin ?? 0));
    expect(elements.title.rect.y).toBeCloseTo(
      elements.logo.rect.y + elements.logo.rect.height + (MASTER_MAP.title.vGap ?? 0),
      5,
    );
    expect(elements.cta.rect.y).toBeCloseTo(
      elements.title.rect.y + elements.title.rect.height + (MASTER_MAP.cta.vGap ?? 0),
      5,
    );
    expect(elements.disclaimer.rect.y + elements.disclaimer.rect.height).toBeCloseTo(
      safe.y + safe.height,
      5,
    );
  });
});

describe('空间不足：报告具体约束冲突，绝不偷偷缩小或重叠', () => {
  const doc = docWith({ title: { text: LONG_TITLE } });

  it('长标题在移动开屏产生 space 冲突，并点名相关元素与 px 差值', () => {
    const l = computeLayout(doc, 'mobile');
    const codes = l.violations.map((v) => v.code);
    expect(codes).toContain('space');
    const v = l.violations.find((x) => x.code === 'space')!;
    // 顶链标题与贴底免责声明都应被点名
    expect(v.elementIds).toContain('title');
    expect(v.elementIds).toContain('disclaimer');
    expect(v.message).toMatch(/\d+px/);
    // 冲突元素同时带 space 与 overlap 标记（渲染描边/列表用）
    expect(l.elements.title.violationCodes).toContain('space');
  });

  it('引擎没有缩小字号或尺寸：标题仍按 64px 折行渲染', () => {
    const l = computeLayout(doc, 'mobile');
    expect(l.elements.title.def.fontSize).toBe(64);
    const lineH = l.elements.title.lineHeightPx!;
    const lines = l.elements.title.lines!;
    expect(lines.length).toBeGreaterThan(2); // 320px 行宽下折成多行
    expect(l.elements.title.rect.height).toBeCloseTo(lines.length * lineH, 5);
    // 每行都不超过生效行宽（移动安全区宽 320）
    for (const line of lines) {
      expect(measureText(line, 64)).toBeLessThanOrEqual(320 + 0.01);
    }
    expect(lines.length).toBeGreaterThanOrEqual(5); // 长标题在窄屏折成多行
  });

  it('同样的长标题在官网横幅仍然成立（只出问题的版位报冲突）', () => {
    const web = computeLayout(doc, 'web');
    expect(web.violations).toEqual([]);
    expect(web.elements.title.lines!.length).toBeLessThan(
      computeLayout(doc, 'mobile').elements.title.lines!.length,
    );
  });

  it('社媒方图无冲突', () => {
    expect(computeLayout(doc, 'social').violations).toEqual([]);
  });
});

describe('最小字号 / 最小尺寸约束', () => {
  it('版位覆盖字号低于最小字号时报 font-floor，且不改变实际渲染字号', () => {
    const doc = docWith({}, { mobile: { title: { fontSize: 34 } } });
    const l = computeLayout(doc, 'mobile');
    expect(l.elements.title.violationCodes).toContain('font-floor');
    expect(l.violations.some((v) => v.code === 'font-floor')).toBe(true);
    expect(l.elements.title.rect.height).toBeGreaterThan(0);
    // 主创意与其他版位不受影响
    expect(computeLayout(doc, 'web').violations).toEqual([]);
  });

  it('显式放宽最小字号（minFontSize 34）后 font-floor 消失', () => {
    const doc = docWith(
      { title: { text: LONG_TITLE } },
      { mobile: { title: { fontSize: 34, minFontSize: 34, maxWidth: 320 } } },
    );
    const l = computeLayout(doc, 'mobile');
    expect(l.elements.title.violationCodes).not.toContain('font-floor');
    // 34px × 5 行可放入移动竖版，整条空间链也应解除
    expect(l.violations.map((v) => v.code)).not.toContain('space');
  });

  it('Logo 等比缩放后窄于最小宽度：报 min-size，渲染宽度撑到最小宽度下限', () => {
    const doc = docWith({ logo: { height: 30, minWidth: 200 } });
    const l = computeLayout(doc, 'web');
    expect(l.elements.logo.violationCodes).toContain('min-size');
    expect(l.elements.logo.rect.width).toBeCloseTo(200, 5);
  });
});

describe('安全区与裁切', () => {
  it('元素被推过安全区边缘时报 safe-overflow，并指出将被画板裁切', () => {
    const doc = docWith({ logo: { marginX: 1100 } });
    const l = computeLayout(doc, 'web');
    expect(l.elements.logo.violationCodes).toContain('safe-overflow');
    const v = l.violations.find((x) => x.code === 'safe-overflow')!;
    expect(v.message).toContain('裁切');
    // 实际越过画板右边缘
    expect(l.elements.logo.rect.x + l.elements.logo.rect.width).toBeGreaterThan(
      PLACEMENTS.web.canvas.width,
    );
  });

  it('正常布局没有任何元素两两重叠', () => {
    const l = computeLayout(createInitialDoc(), 'mobile');
    const ids = ['logo', 'title', 'cta', 'disclaimer'] as ElementId[];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = l.elements[ids[i]].rect;
        const b = l.elements[ids[j]].rect;
        const overlap = !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
        expect(overlap, `${ids[i]} x ${ids[j]}`).toBe(false);
      }
    }
  });
});

describe('求解器纯函数性', () => {
  it('相同输入多次求解得到完全一致的位置', () => {
    const doc = docWith({ title: { text: LONG_TITLE } });
    const resolved = resolveAll(doc, 'mobile');
    const a = solveLayout(resolved, PLACEMENTS.mobile);
    const b = solveLayout(resolved, PLACEMENTS.mobile);
    expect(JSON.stringify(a.elements)).toBe(JSON.stringify(b.elements));
  });

  it('measureElement 对折行高度的确定性（空文本高度为 0）', () => {
    const empty = resolveAll(createInitialDoc(), 'web').title;
    const m = measureElement({ ...empty, text: '' }, 1000);
    expect(m.height).toBe(0);
    expect(m.lines).toEqual([]);
  });
});
