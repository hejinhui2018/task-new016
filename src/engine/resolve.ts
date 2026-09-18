import { MASTER_MAP, OVERRIDABLE_KEYS } from '../data/defaults';
import type {
  Doc,
  ElementDef,
  ElementId,
  PlacementId,
  ResolvedElement,
  Scope,
} from '../types';

/**
 * 覆盖解析：主创意规格 + 某版位覆盖补丁 → 生效规格。
 * - 白名单：只有 OVERRIDABLE_KEYS 声明的字段允许覆盖（背景焦点不允许）。
 * - 补丁里值为 undefined 的键视为「恢复继承」。
 * - overriddenKeys 记录实际生效的覆盖字段，供 UI 区分自动/人工。
 */
export function resolveElement(
  id: ElementId,
  doc: Doc,
  scope: Scope,
): ResolvedElement {
  const base: ElementDef = MASTER_MAP[id];
  // 主创意修改先铺一层
  const masterPatch = scope === 'master' ? doc.master[id] ?? {} : doc.master[id] ?? {};
  const placementPatch =
    scope === 'master' ? {} : doc.placements[scope as PlacementId].overrides[id] ?? {};
  const allowed = new Set(OVERRIDABLE_KEYS[id]);

  const overriddenKeys: string[] = [];
  const merged: Record<string, unknown> = { ...base };

  // 主创意层：内置默认里存在的字段都可改（文本、颜色、内容类字段也在此层）
  for (const [key, value] of Object.entries(masterPatch)) {
    if (value === undefined) continue;
    merged[key] = value;
  }
  // 版位层：仅白名单字段可覆盖
  for (const [key, value] of Object.entries(placementPatch)) {
    if (value === undefined) continue;
    if (!allowed.has(key)) continue;
    merged[key] = value;
    overriddenKeys.push(key);
  }
  return { ...(merged as unknown as ElementDef), id, kind: base.kind, overriddenKeys };
}

export function resolveAll(
  doc: Doc,
  scope: Scope,
): Record<ElementId, ResolvedElement> {
  return {
    bg: resolveElement('bg', doc, scope),
    logo: resolveElement('logo', doc, scope),
    title: resolveElement('title', doc, scope),
    cta: resolveElement('cta', doc, scope),
    disclaimer: resolveElement('disclaimer', doc, scope),
  };
}

/** 该版位是否存在任意覆盖 */
export function scopeHasOverrides(doc: Doc, scope: Scope): boolean {
  if (scope === 'master') return false;
  const map = doc.placements[scope as PlacementId].overrides;
  return Object.values(map).some((patch) => patch && Object.keys(patch).length > 0);
}

/** 某元素是否覆盖了指定字段 */
export function isKeyOverridden(
  doc: Doc,
  scope: Scope,
  id: ElementId,
  key: string,
): boolean {
  if (scope === 'master') return false;
  const v = doc.placements[scope as PlacementId].overrides[id] as
    | Record<string, unknown>
    | undefined;
  return !!v && v[key] !== undefined;
}
