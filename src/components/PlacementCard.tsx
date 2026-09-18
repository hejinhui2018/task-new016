import { useMemo } from 'react';
import { PLACEMENTS } from '../data/defaults';
import { computeLayout } from '../engine';
import type { CampaignAction } from '../store';
import type { Doc, ElementId, PlacementId, Scope } from '../types';
import { Artboard, type DragBaseline, type FocalMove, type DragMove } from './Artboard';

interface PlacementCardProps {
  scope: PlacementId | 'master';
  doc: Doc;
  selected: { scope: Scope; elementId: ElementId };
  dispatch: React.Dispatch<CampaignAction>;
  onSelect: (scope: Scope, elementId: ElementId) => void;
  showSafe: boolean;
}

export function PlacementCard({
  scope,
  doc,
  selected,
  dispatch,
  onSelect,
  showSafe,
}: PlacementCardProps) {
  const layout = useMemo(() => computeLayout(doc, scope), [doc, scope]);
  const config = PLACEMENTS[scope === 'master' ? 'web' : scope];
  const isMaster = scope === 'master';
  const selectedId = selected.scope === scope ? selected.elementId : null;
  const conflictCount = layout.violations.length;

  const elementDrag: DragMove = (id, dx, dy, phase, baseline: DragBaseline) => {
    const def = layout.elements[id].def;
    const key = `drag:${scope}:${id}`;
    if (phase === 'end') {
      dispatch({ type: 'end_coalesce' });
      return;
    }
    // 横向：左对齐改左距，右对齐改右距；居中不响应水平拖动
    if (def.xPin !== 'center') {
      const sign = def.xPin === 'right' ? -1 : 1;
      const next = clampNum(baseline.marginX + sign * dx, 0, layout.safe.width);
      dispatch({ type: 'set_field', scope, elementId: id, key: 'marginX', value: Math.round(next), coalesceKey: key });
    }
    // 纵向：按锚定方式翻译成对应约束字段
    const anchor = def.vAnchor ?? 'top';
    if (anchor === 'top') {
      const next = clampNum(baseline.vMargin + dy, 0, layout.safe.height);
      dispatch({ type: 'set_field', scope, elementId: id, key: 'vMargin', value: Math.round(next), coalesceKey: key });
    } else if (anchor === 'bottom') {
      const next = clampNum(baseline.vMargin - dy, 0, layout.safe.height);
      dispatch({ type: 'set_field', scope, elementId: id, key: 'vMargin', value: Math.round(next), coalesceKey: key });
    } else if (anchor === 'below') {
      const next = clampNum(baseline.vGap + dy, 0, layout.safe.height);
      dispatch({ type: 'set_field', scope, elementId: id, key: 'vGap', value: Math.round(next), coalesceKey: key });
    } else if (anchor === 'above') {
      const next = clampNum(baseline.vGap - dy, 0, layout.safe.height);
      dispatch({ type: 'set_field', scope, elementId: id, key: 'vGap', value: Math.round(next), coalesceKey: key });
    }
  };

  const focalDrag: FocalMove = (fx, fy, phase) => {
    if (phase === 'end') {
      dispatch({ type: 'end_coalesce' });
      return;
    }
    dispatch({
      type: 'set_field',
      scope: 'master',
      elementId: 'bg',
      key: phase === 'start' ? 'fx' : 'fx',
      value: round2(fx),
      coalesceKey: 'drag:bg:fx',
    });
    dispatch({
      type: 'set_field',
      scope: 'master',
      elementId: 'bg',
      key: 'fy',
      value: round2(fy),
      coalesceKey: 'drag:bg:fx', // 同一手势同一合并键
    });
  };

  return (
    <section
      className={`pcard ${isMaster ? 'pcard--master' : ''} ${
        conflictCount > 0 ? 'pcard--conflict' : ''
      } ${layout.hasOverrides ? 'pcard--overridden' : ''}`}
    >
      <header className="pcard__head">
        <div className="pcard__titles">
          <span className="pcard__label">{isMaster ? '主创意画布' : config.label}</span>
          <span className="pcard__meta">
            {config.canvas.width}×{config.canvas.height}
            {isMaster ? ' · 以官网横幅为编辑画布' : ` · ${config.description.split('·')[1]?.trim() ?? ''}`}
          </span>
        </div>
        <div className="pcard__badges">
          {layout.hasOverrides && (
            <span className="badge badge--override" title="该版位含人工覆盖">
              人工覆盖
            </span>
          )}
          {conflictCount > 0 && (
            <span className="badge badge--conflict">{conflictCount} 项冲突</span>
          )}
          {conflictCount === 0 && !layout.hasOverrides && (
            <span className="badge badge--auto">自动版式</span>
          )}
          {!isMaster && layout.hasOverrides && (
            <button
              className="btn btn--mini"
              title="清除该版位全部覆盖，恢复继承主创意"
              onClick={() => dispatch({ type: 'clear_placement_overrides', scope: scope as PlacementId })}
            >
              全部恢复继承
            </button>
          )}
        </div>
      </header>

      <div className={`pcard__stage pcard__stage--${scope}`}>
        <Artboard
          layout={layout}
          scope={scope}
          selectedId={selectedId}
          onSelect={(id) => onSelect(scope, id)}
          onElementDrag={elementDrag}
          onFocalDrag={focalDrag}
          showSafe={showSafe}
          compact={!isMaster}
        />
      </div>

      {conflictCount > 0 && (
        <ul className="violations">
          {layout.violations.map((v, i) => (
            <li
              key={`${v.code}-${i}`}
              className={`violation violation--${v.code}`}
              onClick={() => onSelect(scope, v.elementIds[0])}
            >
              <span className="violation__title">{v.title}</span>
              <span className="violation__msg">{v.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function clampNum(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
