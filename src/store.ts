import { createInitialDoc } from './data/defaults';
import type {
  Doc,
  ElementId,
  ElementPatch,
  PlacementId,
  Scope,
} from './types';

const STORAGE_KEY = 'campaignfit.doc.v1';
const HISTORY_LIMIT = 100;

export interface Selection {
  scope: Scope;
  elementId: ElementId;
}

export interface CampaignState {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  selected: Selection;
  /** 最近一次变更的合并键，相同键的连续变更折叠为一条历史（如拖动） */
  lastCoalesceKey: string | null;
  /** 当前文档是否来自本地持久化 */
  restored: boolean;
}

export type CampaignAction =
  | {
      type: 'set_field';
      scope: Scope;
      elementId: ElementId;
      key: keyof ElementPatch;
      value: unknown;
      /** 传入相同 coalesceKey 的连续动作只产生一条历史（拖动/连续微调） */
      coalesceKey?: string;
    }
  | {
      type: 'clear_override';
      scope: Scope;
      elementId: ElementId;
      key: string;
    }
  | { type: 'clear_element_overrides'; scope: PlacementId; elementId: ElementId }
  | { type: 'clear_placement_overrides'; scope: PlacementId }
  | { type: 'undo' }
  | { type: 'redo' }
  /** 结束当前连续合并段（松手 / 失焦），之后的同键变更另起一条历史 */
  | { type: 'end_coalesce' }
  | { type: 'reset' }
  | { type: 'hydrate'; doc: Doc; restored: boolean }
  | { type: 'select'; selection: Selection };

export function initState(): CampaignState {
  return {
    doc: createInitialDoc(),
    past: [],
    future: [],
    selected: { scope: 'master', elementId: 'title' },
    lastCoalesceKey: null,
    restored: false,
  };
}

function patchBucket(
  doc: Doc,
  scope: Scope,
): Partial<Record<ElementId, ElementPatch>> {
  return scope === 'master'
    ? doc.master
    : doc.placements[scope as PlacementId].overrides;
}

/** 不可变地写入一个字段（master 修改或版位覆盖） */
function withField(
  doc: Doc,
  scope: Scope,
  elementId: ElementId,
  key: string,
  value: unknown,
): Doc {
  const next = structuredClone(doc);
  const bucket = patchBucket(next, scope);
  const existing = (bucket[elementId] ?? {}) as Record<string, unknown>;
  existing[key] = value;
  bucket[elementId] = existing as ElementPatch;
  return next;
}

function withoutKey(doc: Doc, scope: Scope, elementId: ElementId, key: string): Doc {
  const next = structuredClone(doc);
  const bucket = patchBucket(next, scope);
  const patch = bucket[elementId];
  if (patch) {
    delete (patch as Record<string, unknown>)[key];
    if (Object.keys(patch).length === 0) delete bucket[elementId];
  }
  return next;
}

/** 记录一次变更：按 coalesceKey 决定追加历史还是折叠到当前条目 */
function commit(
  state: CampaignState,
  nextDoc: Doc,
  coalesceKey?: string,
): CampaignState {
  if (coalesceKey && coalesceKey === state.lastCoalesceKey) {
    // 折叠：不移动 past，仅替换当前 doc
    return { ...state, doc: nextDoc, future: [] };
  }
  const past = [...state.past, state.doc].slice(-HISTORY_LIMIT);
  return {
    ...state,
    doc: nextDoc,
    past,
    future: [],
    lastCoalesceKey: coalesceKey ?? null,
  };
}

export function campaignReducer(
  state: CampaignState,
  action: CampaignAction,
): CampaignState {
  switch (action.type) {
    case 'set_field':
      return commit(
        state,
        withField(state.doc, action.scope, action.elementId, action.key as string, action.value),
        action.coalesceKey,
      );
    case 'clear_override':
      return commit(
        state,
        withoutKey(state.doc, action.scope, action.elementId, action.key),
      );
    case 'clear_element_overrides': {
      const next = structuredClone(state.doc);
      delete next.placements[action.scope].overrides[action.elementId];
      return commit(state, next);
    }
    case 'clear_placement_overrides': {
      const next = structuredClone(state.doc);
      next.placements[action.scope].overrides = {};
      return commit(state, next);
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future],
        lastCoalesceKey: null,
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const [nextDoc, ...rest] = state.future;
      return {
        ...state,
        doc: nextDoc,
        past: [...state.past, state.doc],
        future: rest,
        lastCoalesceKey: null,
      };
    }
    case 'end_coalesce':
      return state.lastCoalesceKey === null
        ? state
        : { ...state, lastCoalesceKey: null };
    case 'reset':
      // 一键重置回到内置素材：同时取消「已从本地草稿恢复」标记
      return { ...commit(state, createInitialDoc()), restored: false };
    case 'hydrate':
      return { ...initState(), doc: action.doc, restored: action.restored };
    case 'select':
      return { ...state, selected: action.selection };
    default:
      return state;
  }
}

// —— 本地持久化 ——

export function loadDoc(): { doc: Doc; restored: boolean } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Doc;
    if (!isValidDoc(parsed)) return null;
    return { doc: migrate(parsed), restored: true };
  } catch {
    return null;
  }
}

export function saveDoc(doc: Doc): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    // 存储不可用时静默降级（应用仍可完整使用，仅刷新不恢复）
  }
}

export function clearSavedDoc(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function isValidDoc(v: unknown): v is Doc {
  if (!v || typeof v !== 'object') return false;
  const d = v as Doc;
  return (
    d.version === 1 &&
    !!d.placements &&
    !!d.placements.web &&
    !!d.placements.mobile &&
    !!d.placements.social
  );
}

/** 旧版本数据迁移占位；当前 v1 仅补齐 master 桶 */
function migrate(doc: Doc): Doc {
  return { ...createInitialDoc(), ...doc, master: doc.master ?? {} };
}
