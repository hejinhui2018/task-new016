import { useMemo, useState } from 'react';
import { DemoGuide } from './components/DemoGuide';
import { Inspector } from './components/Inspector';
import { PlacementCard } from './components/PlacementCard';
import { Toolbar } from './components/Toolbar';
import { ELEMENT_LABELS, ELEMENT_ORDER, PLACEMENT_ORDER, PLACEMENTS } from './data/defaults';
import { computeLayout } from './engine';
import { useCampaign } from './hooks/useCampaign';
import type { ElementId, PlacementId, Scope } from './types';

const SCOPE_TABS: { id: Scope; label: string }[] = [
  { id: 'master', label: '主创意' },
  ...PLACEMENT_ORDER.map((id) => ({ id: id as Scope, label: PLACEMENTS[id].label })),
];

export default function App() {
  const { state, dispatch, canUndo, canRedo } = useCampaign();
  const [showSafe, setShowSafe] = useState(true);
  const [guideOpen, setGuideOpen] = useState(true);

  const { doc, selected } = state;

  const layouts = useMemo(() => {
    const all: Record<Scope, ReturnType<typeof computeLayout>> = {
      master: computeLayout(doc, 'master'),
      web: computeLayout(doc, 'web'),
      mobile: computeLayout(doc, 'mobile'),
      social: computeLayout(doc, 'social'),
    };
    return all;
  }, [doc]);

  const activeLayout = layouts[selected.scope];
  const totalConflicts = PLACEMENT_ORDER.reduce(
    (n, id) => n + layouts[id].violations.length,
    0,
  );

  const select = (scope: Scope, elementId: ElementId) =>
    dispatch({ type: 'select', selection: { scope, elementId } });

  const onReset = () => {
    const ok = window.confirm('确定要一键重置吗？全部修改、覆盖与历史将清空，回到「秋季发布会」初始素材。');
    if (ok) dispatch({ type: 'reset' });
  };

  return (
    <div className="app">
      <Toolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onReset={onReset}
        showSafe={showSafe}
        onToggleSafe={() => setShowSafe((v) => !v)}
        restored={state.restored}
        guideOpen={guideOpen}
        onToggleGuide={() => setGuideOpen((v) => !v)}
      />

      <div className="status-strip">
        <span>
          主创意修改一处，三版位自动重排；空间不足时<strong>报告具体冲突，绝不自动缩小或重叠</strong>。
        </span>
        <span className={`status-strip__count ${totalConflicts ? 'is-bad' : 'is-ok'}`}>
          {totalConflicts ? `⚠ ${totalConflicts} 项版位冲突待处理` : '✓ 三个版位均满足约束'}
        </span>
      </div>

      <main className="workspace">
        <div className="boards">
          <PlacementCard
            scope="master"
            doc={doc}
            selected={selected}
            dispatch={dispatch}
            onSelect={select}
            showSafe={showSafe}
          />
          <div className="placement-grid">
            {PLACEMENT_ORDER.map((id: PlacementId) => (
              <PlacementCard
                key={id}
                scope={id}
                doc={doc}
                selected={selected}
                dispatch={dispatch}
                onSelect={select}
                showSafe={showSafe}
              />
            ))}
          </div>
        </div>

        <aside className="panel">
          <DemoGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

          <div className="panel__pinned">
            <div className="scope-tabs" role="tablist" aria-label="检查器作用域">
              {SCOPE_TABS.map((t) => {
                const conflict = t.id !== 'master' && layouts[t.id as PlacementId].violations.length > 0;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={selected.scope === t.id}
                    className={`scope-tab ${selected.scope === t.id ? 'scope-tab--active' : ''} ${conflict ? 'scope-tab--conflict' : ''}`}
                    onClick={() => dispatch({ type: 'select', selection: { scope: t.id, elementId: selected.elementId } })}
                  >
                    {t.label}
                    {conflict && <em className="scope-tab__dot" />}
                  </button>
                );
              })}
            </div>

            <div className="element-tabs">
              {ELEMENT_ORDER.map((id) => {
                const codes = activeLayout.elements[id]?.violationCodes ?? [];
                const overridden =
                  selected.scope !== 'master' &&
                  (activeLayout.elements[id]?.def.overriddenKeys.length ?? 0) > 0;
                return (
                  <button
                    key={id}
                    className={`element-tab ${selected.elementId === id ? 'element-tab--active' : ''}`}
                    onClick={() => select(selected.scope, id)}
                  >
                    {ELEMENT_LABELS[id]}
                    {codes.length > 0 && <em className="element-tab__dot element-tab__dot--bad" title="该元素存在冲突" />}
                    {overridden && <em className="element-tab__dot element-tab__dot--ovr" title="人工覆盖" />}
                  </button>
                );
              })}
            </div>

            <Inspector
              doc={doc}
              scope={selected.scope}
              elementId={selected.elementId}
              dispatch={dispatch}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
