import { ELEMENT_LABELS, OVERRIDABLE_KEYS } from '../data/defaults';
import { resolveElement } from '../engine/resolve';
import type { CampaignAction } from '../store';
import type {
  Doc,
  ElementDef,
  ElementId,
  Scope,
  VAnchorKind,
  XPin,
} from '../types';

interface InspectorProps {
  doc: Doc;
  scope: Scope;
  elementId: ElementId;
  dispatch: React.Dispatch<CampaignAction>;
}

const TARGET_OPTIONS: ElementId[] = ['logo', 'title', 'cta', 'disclaimer'];

const ANCHOR_OPTIONS: { value: VAnchorKind; label: string }[] = [
  { value: 'top', label: '贴安全区顶边' },
  { value: 'below', label: '在目标下方' },
  { value: 'above', label: '在目标上方' },
  { value: 'bottom', label: '贴安全区底边' },
];

const PIN_OPTIONS: { value: XPin; label: string }[] = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '右对齐' },
];

const SCOPE_LABEL: Record<Scope, string> = {
  master: '主创意',
  web: '官网横幅',
  mobile: '移动开屏',
  social: '社媒方图',
};

export function Inspector({ doc, scope, elementId, dispatch }: InspectorProps) {
  const def = resolveElement(elementId, doc, scope);
  // 主创意层（内置默认 + 主创意修改）= 版位字段的「继承来源」
  const inherited = resolveElement(elementId, doc, 'master');
  const isMaster = scope === 'master';

  /** 该字段在当前作用域是否可编辑（版位层受白名单约束） */
  const can = (key: string) =>
    isMaster || OVERRIDABLE_KEYS[elementId].includes(key);

  /** 写字段；连续输入（拖动/键入）共享 coalesceKey，折叠成一条历史 */
  const set = (key: keyof ElementDef, value: unknown, coalesce = false) => {
    if (!can(String(key))) return;
    dispatch({
      type: 'set_field',
      scope,
      elementId,
      key: key as never,
      value,
      coalesceKey: coalesce ? `input:${scope}:${elementId}:${String(key)}` : undefined,
    });
  };
  const endCoalesce = () => dispatch({ type: 'end_coalesce' });

  const restore = (key: string) =>
    dispatch({ type: 'clear_override', scope, elementId, key });

  const isOverridden = (key: string) =>
    isMaster
      ? (doc.master[elementId] as Record<string, unknown> | undefined)?.[key] !==
        undefined
      : def.overriddenKeys.includes(key);

  return (
    <div className="inspector">
      <div className="inspector__head">
        <span className="inspector__element">{ELEMENT_LABELS[elementId]}</span>
        <span className={`scope-tag scope-tag--${scope}`}>{SCOPE_LABEL[scope]}</span>
      </div>

      {!isMaster && (
        <p className="inspector__hint">
          实线字段为<span className="dot-override">人工覆盖</span>，虚线字段继承自主创意；
          点 ↺ 可随时恢复继承。
        </p>
      )}

      {elementId === 'bg' && (
        <div className="inspector__group">
          <p className="inspector__hint">
            背景焦点为全局共享参数（同时作用于三个版位），也可以直接拖动画板中的十字准星。
          </p>
          <NumberRow label="焦点 X（0–1）" value={def.fx ?? 0.5} step={0.01} min={0} max={1}
            overridden={isOverridden('fx')} master={isMaster}
            onChange={(v) => set('fx', v, true)} onCommit={endCoalesce} onRestore={() => restore('fx')} />
          <NumberRow label="焦点 Y（0–1）" value={def.fy ?? 0.5} step={0.01} min={0} max={1}
            overridden={isOverridden('fy')} master={isMaster}
            onChange={(v) => set('fy', v, true)} onCommit={endCoalesce} onRestore={() => restore('fy')} />
        </div>
      )}

      {(elementId === 'title' || elementId === 'cta' || elementId === 'disclaimer') && (
        <div className="inspector__group">
          <Locked locked={!can('text')} note="文案只能在主创意修改，自动同步全部版位">
            <TextRow label="文案" value={def.text ?? ''} overridden={isOverridden('text')} master={isMaster}
              onChange={(v) => set('text', v, true)} onCommit={endCoalesce} onRestore={() => restore('text')} />
          </Locked>
        </div>
      )}

      {def.kind === 'text' && (
        <div className="inspector__group">
          <GroupTitle>文字规格</GroupTitle>
          <NumberRow label="字号 px" value={def.fontSize ?? 14} min={8} max={200}
            overridden={isOverridden('fontSize')} master={isMaster}
            onChange={(v) => set('fontSize', v, true)} onCommit={endCoalesce} onRestore={() => restore('fontSize')} />
          {!isMaster && <InheritedNote value={`继承值 ${inherited.fontSize}px`} />}
          <NumberRow label="最小字号 px" value={def.minFontSize ?? 0} min={0} max={200}
            overridden={isOverridden('minFontSize')} master={isMaster}
            onChange={(v) => set('minFontSize', v, true)} onCommit={endCoalesce} onRestore={() => restore('minFontSize')} />
          <NumberRow label="最大行宽 px" value={def.maxWidth ?? 0} min={0} max={2000}
            overridden={isOverridden('maxWidth')} master={isMaster}
            onChange={(v) => set('maxWidth', v, true)} onCommit={endCoalesce} onRestore={() => restore('maxWidth')} />
          <NumberRow label="字重" value={def.fontWeight ?? 400} step={100} min={100} max={900}
            overridden={isOverridden('fontWeight')} master={isMaster}
            onChange={(v) => set('fontWeight', v, true)} onCommit={endCoalesce} onRestore={() => restore('fontWeight')} />
          <Locked locked={!can('color')} note="颜色只能在主创意修改">
            <ColorRow label="文字颜色" value={def.color ?? '#ffffff'} overridden={isOverridden('color')} master={isMaster}
              onChange={(v) => set('color', v, true)} onCommit={endCoalesce} onRestore={() => restore('color')} />
          </Locked>
        </div>
      )}

      {elementId === 'cta' && (
        <div className="inspector__group">
          <GroupTitle>按钮规格</GroupTitle>
          <NumberRow label="字号 px" value={def.fontSize ?? 18} min={8} max={120}
            overridden={isOverridden('fontSize')} master={isMaster}
            onChange={(v) => set('fontSize', v, true)} onCommit={endCoalesce} onRestore={() => restore('fontSize')} />
          {!isMaster && <InheritedNote value={`继承值 ${inherited.fontSize}px`} />}
          <NumberRow label="最小字号 px" value={def.minFontSize ?? 0} min={0} max={120}
            overridden={isOverridden('minFontSize')} master={isMaster}
            onChange={(v) => set('minFontSize', v, true)} onCommit={endCoalesce} onRestore={() => restore('minFontSize')} />
          <NumberRow label="按钮高度 px" value={def.height ?? 44} min={20} max={200}
            overridden={isOverridden('height')} master={isMaster}
            onChange={(v) => set('height', v, true)} onCommit={endCoalesce} onRestore={() => restore('height')} />
          <NumberRow label="最小宽度 px" value={def.minWidth ?? 0} min={0} max={600}
            overridden={isOverridden('minWidth')} master={isMaster}
            onChange={(v) => set('minWidth', v, true)} onCommit={endCoalesce} onRestore={() => restore('minWidth')} />
          <NumberRow label="左右内边距 px" value={def.padX ?? 24} min={0} max={120}
            overridden={isOverridden('padX')} master={isMaster}
            onChange={(v) => set('padX', v, true)} onCommit={endCoalesce} onRestore={() => restore('padX')} />
          <Locked locked={!can('bgColor')} note="按钮底色只能在主创意修改">
            <ColorRow label="按钮底色" value={def.bgColor ?? '#ffb347'} overridden={isOverridden('bgColor')} master={isMaster}
              onChange={(v) => set('bgColor', v, true)} onCommit={endCoalesce} onRestore={() => restore('bgColor')} />
          </Locked>
        </div>
      )}

      {elementId === 'logo' && (
        <div className="inspector__group">
          <GroupTitle>Logo 规格</GroupTitle>
          <NumberRow label="高度 px" value={def.height ?? 48} min={16} max={200}
            overridden={isOverridden('height')} master={isMaster}
            onChange={(v) => set('height', v, true)} onCommit={endCoalesce} onRestore={() => restore('height')} />
          {!isMaster && <InheritedNote value={`继承高度 ${inherited.height}px`} />}
          <NumberRow label="最小宽度 px" value={def.minWidth ?? 0} min={0} max={600}
            overridden={isOverridden('minWidth')} master={isMaster}
            onChange={(v) => set('minWidth', v, true)} onCommit={endCoalesce} onRestore={() => restore('minWidth')} />
        </div>
      )}

      <div className="inspector__group">
        <GroupTitle>纵向约束</GroupTitle>
        <SelectRow label="锚定方式" value={def.vAnchor ?? 'top'} options={ANCHOR_OPTIONS}
          overridden={isOverridden('vAnchor')} master={isMaster}
          onChange={(v) => set('vAnchor', v)} onRestore={() => restore('vAnchor')} />
        {(def.vAnchor === 'top' || def.vAnchor === 'bottom') && (
          <NumberRow label={def.vAnchor === 'top' ? '距顶边 px' : '距底边 px'}
            value={def.vMargin ?? 0} min={0} max={400}
            overridden={isOverridden('vMargin')} master={isMaster}
            onChange={(v) => set('vMargin', v, true)} onCommit={endCoalesce} onRestore={() => restore('vMargin')} />
        )}
        {(def.vAnchor === 'below' || def.vAnchor === 'above') && (
          <>
            <SelectRow label="锚定目标"
              value={def.vTarget ?? 'logo'}
              options={TARGET_OPTIONS.filter((t) => t !== elementId).map((t) => ({ value: t, label: ELEMENT_LABELS[t] }))}
              overridden={isOverridden('vTarget')} master={isMaster}
              onChange={(v) => set('vTarget', v)} onRestore={() => restore('vTarget')} />
            <NumberRow label="与目标间距 px" value={def.vGap ?? 0} min={0} max={400}
              overridden={isOverridden('vGap')} master={isMaster}
              onChange={(v) => set('vGap', v, true)} onCommit={endCoalesce} onRestore={() => restore('vGap')} />
          </>
        )}
      </div>

      <div className="inspector__group">
        <GroupTitle>横向约束</GroupTitle>
        <SelectRow label="水平对齐" value={def.xPin ?? 'left'} options={PIN_OPTIONS}
          overridden={isOverridden('xPin')} master={isMaster}
          onChange={(v) => set('xPin', v)} onRestore={() => restore('xPin')} />
        {def.xPin !== 'center' && (
          <NumberRow label={def.xPin === 'right' ? '距右边 px' : '距左边 px'}
            value={def.marginX ?? 0} min={0} max={800}
            overridden={isOverridden('marginX')} master={isMaster}
            onChange={(v) => set('marginX', v, true)} onCommit={endCoalesce} onRestore={() => restore('marginX')} />
        )}
      </div>

      {!isMaster && (
        <button
          className="btn btn--ghost inspector__restore-all"
          onClick={() =>
            dispatch({ type: 'clear_element_overrides', scope: scope as never, elementId })
          }
        >
          ↺ 恢复该元素全部继承
        </button>
      )}
      {isMaster && Object.keys(doc.master[elementId] ?? {}).length > 0 && (
        <button
          className="btn btn--ghost inspector__restore-all"
          onClick={() => {
            for (const key of Object.keys(doc.master[elementId] ?? {})) restore(key);
            endCoalesce();
          }}
        >
          ↺ 恢复内置默认
        </button>
      )}
    </div>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <div className="inspector__group-title">{children}</div>;
}

/** 锁定字段：版位层不允许覆盖的主创意字段（fieldset 禁用全部内部控件） */
function Locked({ locked, note, children }: { locked: boolean; note: string; children: React.ReactNode }) {
  if (!locked) return <>{children}</>;
  return (
    <fieldset className="locked-field" disabled title={note}>
      {children}
      <span className="locked-note">🔒 {note}</span>
    </fieldset>
  );
}

function InheritedNote({ value }: { value: string }) {
  return (
    <div className="inherited-note">
      <span className="inherited-note__val">{value}</span>
    </div>
  );
}

interface BaseRow {
  label: string;
  overridden: boolean;
  master: boolean;
  onRestore: () => void;
}

function rowClass(overridden: boolean, master: boolean): string {
  if (!overridden) return 'field';
  return master ? 'field field--master-changed' : 'field field--override';
}

function RestoreButton({ overridden, onRestore, master }: { overridden: boolean; master: boolean; onRestore: () => void }) {
  if (!overridden) return null;
  return (
    <button type="button" className="restore-btn" title={master ? '恢复内置默认' : '恢复继承'} onClick={onRestore}>
      ↺
    </button>
  );
}

function NumberRow({
  label, value, step = 1, min, max, overridden, master, onChange, onCommit, onRestore,
}: BaseRow & {
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className={rowClass(overridden, master)}>
      <span className="field__label">{label}</span>
      <span className="field__control">
        <input
          type="number"
          value={Math.round(value * 100) / 100}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
          onBlur={onCommit}
        />
        <RestoreButton overridden={overridden} master={master} onRestore={onRestore} />
      </span>
    </label>
  );
}

function TextRow({
  label, value, overridden, master, onChange, onCommit, onRestore,
}: BaseRow & {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className={rowClass(overridden, master)}>
      <span className="field__label">{label}</span>
      <span className="field__control">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
        />
        <RestoreButton overridden={overridden} master={master} onRestore={onRestore} />
      </span>
    </label>
  );
}

function ColorRow({
  label, value, overridden, master, onChange, onCommit, onRestore,
}: BaseRow & {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className={rowClass(overridden, master)}>
      <span className="field__label">{label}</span>
      <span className="field__control">
        <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} onBlur={onCommit} />
        <span className="color-code">{value}</span>
        <RestoreButton overridden={overridden} master={master} onRestore={onRestore} />
      </span>
    </label>
  );
}

function SelectRow({
  label, value, options, overridden, master, onChange, onRestore,
}: BaseRow & {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className={rowClass(overridden, master)}>
      <span className="field__label">{label}</span>
      <span className="field__control">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <RestoreButton overridden={overridden} master={master} onRestore={onRestore} />
      </span>
    </label>
  );
}

/** rgba() 无法赋给 color input，退化为白色，仅影响取色器色块（文本框仍显示原值） */
function toHex(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff';
}
