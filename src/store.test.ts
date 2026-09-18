// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  campaignReducer,
  clearSavedDoc,
  initState,
  loadDoc,
  saveDoc,
} from './store';
import type { ElementId } from './types';

function setTitle(state: ReturnType<typeof initState>, text: string, coalesceKey?: string) {
  return campaignReducer(state, {
    type: 'set_field',
    scope: 'master',
    elementId: 'title' as ElementId,
    key: 'text',
    value: text,
    coalesceKey,
  });
}

describe('撤销 / 重做', () => {
  it('每次离散修改入栈，undo 逐步回退、redo 逐步前进', () => {
    let s = initState();
    const t0 = s.doc.master.title?.text;
    s = setTitle(s, 'A');
    s = setTitle(s, 'AB');
    s = setTitle(s, 'ABC');
    expect(s.doc.master.title!.text).toBe('ABC');

    s = campaignReducer(s, { type: 'undo' });
    expect(s.doc.master.title!.text).toBe('AB');
    s = campaignReducer(s, { type: 'undo' });
    expect(s.doc.master.title!.text).toBe('A');
    s = campaignReducer(s, { type: 'undo' });
    expect(s.doc.master.title?.text ?? t0).toBe(t0);

    // 已到最早状态，再撤销不变
    const before = s;
    s = campaignReducer(s, { type: 'undo' });
    expect(s).toBe(before);

    s = campaignReducer(s, { type: 'redo' });
    expect(s.doc.master.title!.text).toBe('A');
    s = campaignReducer(s, { type: 'redo' });
    expect(s.doc.master.title!.text).toBe('AB');
  });

  it('相同 coalesceKey 的连续动作折叠为一条历史（模拟一次拖动）', () => {
    let s = initState();
    s = setTitle(s, 'X', 'drag:title');
    s = setTitle(s, 'XY', 'drag:title');
    s = setTitle(s, 'XYZ', 'drag:title');
    expect(s.past).toHaveLength(1); // 只有一条历史

    // end_coalesce 之后同键动作另起一条
    s = campaignReducer(s, { type: 'end_coalesce' });
    s = setTitle(s, 'XYZ2', 'drag:title');
    expect(s.past).toHaveLength(2);

    // 一次撤销回到拖动前（折叠段整体回退）
    s = campaignReducer(s, { type: 'undo' });
    expect(s.doc.master.title!.text).toBe('XYZ');
    s = campaignReducer(s, { type: 'undo' });
    expect(s.doc.master.title?.text).toBeUndefined();
  });

  it('新修改会清空 redo 栈', () => {
    let s = initState();
    s = setTitle(s, 'A');
    s = setTitle(s, 'B');
    s = campaignReducer(s, { type: 'undo' });
    expect(s.future).toHaveLength(1);
    s = setTitle(s, 'C');
    expect(s.future).toHaveLength(0);
  });

  it('选择元素不进入历史', () => {
    let s = initState();
    s = campaignReducer(s, { type: 'select', selection: { scope: 'mobile', elementId: 'cta' } });
    expect(s.past).toHaveLength(0);
    expect(s.selected).toEqual({ scope: 'mobile', elementId: 'cta' });
  });
});

describe('覆盖清除与一键重置（历史可恢复）', () => {
  it('清除单个覆盖键、清除元素全部覆盖、清除版位全部覆盖', () => {
    let s = initState();
    s = campaignReducer(s, {
      type: 'set_field', scope: 'mobile', elementId: 'title', key: 'fontSize', value: 34,
    });
    s = campaignReducer(s, {
      type: 'set_field', scope: 'mobile', elementId: 'title', key: 'vGap', value: 8,
    });
    s = campaignReducer(s, {
      type: 'set_field', scope: 'mobile', elementId: 'cta', key: 'height', value: 40,
    });

    s = campaignReducer(s, { type: 'clear_override', scope: 'mobile', elementId: 'title', key: 'fontSize' });
    expect(s.doc.placements.mobile.overrides.title!.fontSize).toBeUndefined();
    expect(s.doc.placements.mobile.overrides.title!.vGap).toBe(8);

    s = campaignReducer(s, { type: 'clear_element_overrides', scope: 'mobile', elementId: 'title' });
    expect(s.doc.placements.mobile.overrides.title).toBeUndefined();
    expect(s.doc.placements.mobile.overrides.cta).toBeDefined();

    s = campaignReducer(s, { type: 'clear_placement_overrides', scope: 'mobile' });
    expect(s.doc.placements.mobile.overrides).toEqual({});

    // 这些清除动作本身可撤销
    s = campaignReducer(s, { type: 'undo' });
    expect(s.doc.placements.mobile.overrides.cta).toBeDefined();
  });

  it('一键重置回到初始空文档，且可通过撤销找回修改', () => {
    let s = initState();
    s = setTitle(s, '重置前的标题');
    s = campaignReducer(s, {
      type: 'set_field', scope: 'mobile', elementId: 'title', key: 'fontSize', value: 30,
    });
    s = campaignReducer(s, { type: 'reset' });
    expect(s.doc.master).toEqual({});
    expect(s.doc.placements.mobile.overrides).toEqual({});
    expect(s.restored).toBe(false);

    s = campaignReducer(s, { type: 'undo' });
    expect(s.doc.master.title!.text).toBe('重置前的标题');
    expect(s.doc.placements.mobile.overrides.title!.fontSize).toBe(30);
  });
});

describe('本地持久化（刷新恢复）', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('保存后可原样恢复，并标记 restored', () => {
    let s = initState();
    s = setTitle(s, '刷新后还在');
    s = campaignReducer(s, {
      type: 'set_field', scope: 'mobile', elementId: 'title', key: 'fontSize', value: 36,
    });
    saveDoc(s.doc);
    const loaded = loadDoc();
    expect(loaded).not.toBeNull();
    expect(loaded!.restored).toBe(true);
    expect(loaded!.doc.master.title!.text).toBe('刷新后还在');
    expect(loaded!.doc.placements.mobile.overrides.title!.fontSize).toBe(36);
  });

  it('脏数据 / 缺字段时返回 null（回退到初始素材，不崩溃）', () => {
    localStorage.setItem('campaignfit.doc.v1', '{not json');
    expect(loadDoc()).toBeNull();

    localStorage.setItem('campaignfit.doc.v1', JSON.stringify({ version: 1, master: {} }));
    expect(loadDoc()).toBeNull();

    clearSavedDoc();
    expect(loadDoc()).toBeNull();
  });

  it('hydrate 以外部文档替换状态并清空历史', () => {
    let s = initState();
    s = setTitle(s, '历史垃圾');
    const fresh = initState().doc;
    s = campaignReducer(s, { type: 'hydrate', doc: fresh, restored: true });
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.restored).toBe(true);
  });
});
