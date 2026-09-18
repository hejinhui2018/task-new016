import { PLACEMENTS } from '../data/defaults';
import type { Doc, LayoutResult, Scope } from '../types';
import { solveLayout } from './layout';
import { resolveAll } from './resolve';

/** 引擎统一入口：文档 + 作用域 → 完整版式结果（纯函数） */
export function computeLayout(doc: Doc, scope: Scope): LayoutResult {
  const placement =
    scope === 'master'
      ? // 主创意以官网横幅画板作为编辑画布
        PLACEMENTS.web
      : PLACEMENTS[scope];
  const resolved = resolveAll(doc, scope);
  return solveLayout(resolved, placement);
}

export * from './crop';
export * from './layout';
export * from './resolve';
export * from './textMeasure';
