import { useEffect, useMemo, useReducer } from 'react';
import { createInitialDoc } from '../data/defaults';
import {
  campaignReducer,
  initState,
  loadDoc,
  saveDoc,
} from '../store';

/** 状态 hook：reducer + localStorage 持久化/恢复 + 快捷键撤销重做 */
export function useCampaign() {
  const [state, dispatch] = useReducer(campaignReducer, undefined, () => {
    const base = initState();
    const loaded = loadDoc();
    // 内容与内置初始素材一致时不显示「已恢复草稿」
    const isPristine =
      loaded && JSON.stringify(loaded.doc) === JSON.stringify(createInitialDoc());
    return loaded && !isPristine
      ? { ...base, doc: loaded.doc, restored: true }
      : base;
  });

  useEffect(() => {
    saveDoc(state.doc);
  }, [state.doc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (typing) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return useMemo(
    () => ({ state, dispatch, canUndo, canRedo }),
    [state, canUndo, canRedo],
  );
}
