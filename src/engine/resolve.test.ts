import { describe, expect, it } from 'vitest';
import { createInitialDoc, OVERRIDABLE_KEYS } from '../data/defaults';
import { resolveAll, resolveElement, scopeHasOverrides } from './resolve';
import type { Doc, ElementId, PlacementId } from '../types';

function setOverride(
  doc: Doc,
  scope: PlacementId,
  id: ElementId,
  patch: Record<string, unknown>,
): Doc {
  const next = structuredClone(doc);
  next.placements[scope].overrides[id] = {
    ...next.placements[scope].overrides[id],
    ...patch,
  } as never;
  return next;
}

function setMaster(doc: Doc, id: ElementId, patch: Record<string, unknown>): Doc {
  const next = structuredClone(doc);
  next.master[id] = { ...next.master[id], ...patch } as never;
  return next;
}

describe('覆盖解析与优先级', () => {
  it('未覆盖时版位完全继承主创意值，overriddenKeys 为空', () => {
    const doc = createInitialDoc();
    const t = resolveElement('title', doc, 'mobile');
    expect(t.fontSize).toBe(64);
    expect(t.overriddenKeys).toEqual([]);
    expect(scopeHasOverrides(doc, 'mobile')).toBe(false);
  });

  it('版位覆盖优先于主创意：只改 mobile 的字号，web/social 不变', () => {
    let doc = createInitialDoc();
    doc = setMaster(doc, 'title', { fontSize: 60 });
    doc = setOverride(doc, 'mobile', 'title', { fontSize: 34 });

    expect(resolveElement('title', doc, 'mobile').fontSize).toBe(34);
    expect(resolveElement('title', doc, 'web').fontSize).toBe(60);
    expect(resolveElement('title', doc, 'social').fontSize).toBe(60);
    // 只有被覆盖的键被标记
    const mobile = resolveElement('title', doc, 'mobile');
    expect(mobile.overriddenKeys).toEqual(['fontSize']);
    expect(scopeHasOverrides(doc, 'mobile')).toBe(true);
    expect(scopeHasOverrides(doc, 'web')).toBe(false);
  });

  it('主创意修改向下传播到所有版位（含背景焦点）', () => {
    let doc = createInitialDoc();
    doc = setMaster(doc, 'bg', { fx: 0.2, fy: 0.8 });
    for (const scope of ['web', 'mobile', 'social'] as PlacementId[]) {
      const bg = resolveElement('bg', doc, scope);
      expect(bg.fx).toBe(0.2);
      expect(bg.fy).toBe(0.8);
      // 背景焦点不允许版位覆盖
      expect(bg.overriddenKeys).toEqual([]);
    }
  });

  it('白名单之外的版位字段（文案/颜色）被忽略，不能借覆盖篡改', () => {
    let doc = createInitialDoc();
    doc = setOverride(doc, 'mobile', 'title', {
      fontSize: 40,
      text: '被篡改的文案',
      color: '#000000',
    } as Record<string, unknown>);
    const t = resolveElement('title', doc, 'mobile');
    expect(t.fontSize).toBe(40);
    expect(t.text).toBe('秋季发布会'); // 仍继承主创意
    expect(t.color).toBe('#fff7ec');
    expect(t.overriddenKeys).toEqual(['fontSize']);
  });

  it('恢复继承：删除覆盖键后立即回到主创意值', () => {
    let doc = createInitialDoc();
    doc = setMaster(doc, 'title', { fontSize: 58 });
    doc = setOverride(doc, 'mobile', 'title', { fontSize: 34, vGap: 10 });
    expect(resolveElement('title', doc, 'mobile').fontSize).toBe(34);

    // 删除单个键
    delete doc.placements.mobile.overrides.title!.fontSize;
    const afterOne = resolveElement('title', doc, 'mobile');
    expect(afterOne.fontSize).toBe(58); // 回到继承
    expect(afterOne.vGap).toBe(10); // 其他覆盖保留

    // 删除元素全部覆盖
    delete doc.placements.mobile.overrides.title;
    const resolved = resolveAll(doc, 'mobile');
    expect(resolved.title.overriddenKeys).toEqual([]);
    expect(resolved.title.vGap).toBe(28); // 内置默认（标题间距 28）
    expect(scopeHasOverrides(doc, 'mobile')).toBe(false);
  });

  it('所有可覆盖键都在白名单中声明（无遗漏的约束字段）', () => {
    const expected = ['fontSize', 'minFontSize', 'maxWidth', 'height', 'minWidth', 'padX', 'vAnchor', 'vTarget', 'vMargin', 'vGap', 'xPin', 'marginX'];
    for (const id of ['logo', 'title', 'cta', 'disclaimer'] as ElementId[]) {
      for (const key of OVERRIDABLE_KEYS[id]) {
        expect(expected).toContain(key);
      }
    }
    expect(OVERRIDABLE_KEYS.bg).toEqual([]);
  });
});
