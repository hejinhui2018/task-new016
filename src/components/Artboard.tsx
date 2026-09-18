import { useRef } from 'react';
import { ASSETS } from '../data/defaults';
import type {
  ElementId,
  LayoutResult,
  Scope,
  ViolationCode,
} from '../types';

/** 拖动语义：父级把画板像素增量翻译成字段变更 */
export interface DragMove {
  (
    id: ElementId,
    dx: number,
    dy: number,
    phase: 'start' | 'move' | 'end',
    baseline: DragBaseline,
  ): void;
}

export interface FocalMove {
  (fx: number, fy: number, phase: 'start' | 'move' | 'end'): void;
}

/** 拖动起步时的生效值（可能本身已是覆盖值） */
export interface DragBaseline {
  vMargin: number;
  vGap: number;
  marginX: number;
  fx: number;
  fy: number;
}

interface ArtboardProps {
  layout: LayoutResult;
  scope: Scope;
  selectedId: ElementId | null;
  onSelect: (id: ElementId) => void;
  onElementDrag?: DragMove;
  onFocalDrag?: FocalMove;
  showSafe: boolean;
  compact?: boolean;
}

const CODE_COLOR: Record<ViolationCode, string> = {
  space: '#ff5a4e',
  overlap: '#ff5a4e',
  'safe-overflow': '#ff8a3c',
  'font-floor': '#ffd166',
  'min-size': '#ffd166',
};

export function Artboard({
  layout,
  scope,
  selectedId,
  onSelect,
  onElementDrag,
  onFocalDrag,
  showSafe,
  compact,
}: ArtboardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{
    id: ElementId | 'bg';
    startClientX: number;
    startClientY: number;
    scale: number;
    baseline: DragBaseline;
    moved: boolean;
  } | null>(null);

  const { canvas, safe, elements, background } = layout;
  const uid = `cf-${scope}`;

  const beginDrag = (e: React.PointerEvent, id: ElementId | 'bg') => {
    if (!onElementDrag && id !== 'bg') return;
    if (id === 'bg' && !onFocalDrag) return;
    e.stopPropagation();
    onSelect(id === 'bg' ? 'bg' : id);
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const baseEl = id === 'bg' ? null : elements[id as ElementId];
    dragState.current = {
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      scale,
      moved: false,
      baseline: {
        vMargin: baseEl?.def.vMargin ?? 0,
        vGap: baseEl?.def.vGap ?? 0,
        marginX: baseEl?.def.marginX ?? 0,
        fx: background.fx,
        fy: background.fy,
      },
    };
    svg.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / d.scale;
    const dy = (e.clientY - d.startClientY) / d.scale;
    if (Math.abs(dx) + Math.abs(dy) < 0.5 && d.moved) return;
    d.moved = true;
    if (d.id === 'bg') {
      const nfx = d.baseline.fx + dx / canvas.width;
      const nfy = d.baseline.fy + dy / canvas.height;
      onFocalDrag?.(clamp01(nfx), clamp01(nfy), 'move');
    } else {
      onElementDrag?.(d.id, dx, dy, 'move', d.baseline);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d) return;
    if (d.id === 'bg') {
      const nfx = d.baseline.fx + (e.clientX - d.startClientX) / d.scale / canvas.width;
      const nfy = d.baseline.fy + (e.clientY - d.startClientY) / d.scale / canvas.height;
      onFocalDrag?.(clamp01(nfx), clamp01(nfy), 'end');
    } else if (d.moved) {
      onElementDrag?.(d.id, 0, 0, 'end', d.baseline);
    }
    dragState.current = null;
  };

  return (
    <svg
      ref={svgRef}
      className={`artboard ${compact ? 'artboard--compact' : ''}`}
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerDown={() => onSelect(selectedId ?? 'title')}
      role="img"
      aria-label={`${scope} 版位画板`}
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect x={0} y={0} width={canvas.width} height={canvas.height} />
        </clipPath>
        <linearGradient id={`${uid}-scrim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {/* 背景（cover 裁切：源窗口 crop 经 scale 放大铺满画板） */}
      <g clipPath={`url(#${uid}-clip)`}>
        <g transform={`scale(${background.crop.scale})`}>
          <image
            href={ASSETS.background}
            x={-background.crop.sx}
            y={-background.crop.sy}
            width={1000}
            height={1000}
          />
        </g>
        <rect x={0} y={0} width={canvas.width} height={canvas.height} fill={`url(#${uid}-scrim)`} />

        {/* 内容元素（超出画板会真实裁掉） */}
        {(['logo', 'title', 'cta', 'disclaimer'] as ElementId[]).map((id) => (
          <ContentNode key={id} id={id} layout={layout} />
        ))}
      </g>

      {/* 安全区 */}
      {showSafe && (
        <rect
          className="safe-frame"
          x={safe.x}
          y={safe.y}
          width={safe.width}
          height={safe.height}
        />
      )}

      {/* 拖动热区（置于裁切块之外，元素溢出时仍可抓住） */}
      {onElementDrag &&
        (['logo', 'title', 'cta', 'disclaimer'] as ElementId[]).map((id) => {
          const r = elements[id].rect;
          return (
            <rect
              key={`hit-${id}`}
              className="drag-hit"
              x={r.x - 6}
              y={r.y - 6}
              width={r.width + 12}
              height={r.height + 12}
              rx={6}
              onPointerDown={(e) => beginDrag(e, id)}
            />
          );
        })}

      {/* 冲突 / 选中描边（不被画板裁切，保证可见） */}
      {(['logo', 'title', 'cta', 'disclaimer'] as ElementId[]).map((id) => {
        const el = elements[id];
        const codes = el.violationCodes;
        const selected = selectedId === id;
        if (codes.length === 0 && !selected) return null;
        const color = codes.length ? CODE_COLOR[codes[0]] : '#4ea8ff';
        return (
          <rect
            key={`frame-${id}`}
            className={codes.length ? 'violation-frame' : 'selection-frame'}
            x={el.rect.x - 4}
            y={el.rect.y - 4}
            width={el.rect.width + 8}
            height={el.rect.height + 8}
            rx={6}
            stroke={color}
          >
            <title>
              {[...new Set(layout.violations.filter((v) => v.elementIds.includes(id)).map((v) => v.title))].join('；')}
            </title>
          </rect>
        );
      })}

      {/* 人工覆盖角标 */}
      {(['logo', 'title', 'cta', 'disclaimer'] as ElementId[]).map((id) => {
        const el = elements[id];
        if (el.def.overriddenKeys.length === 0) return null;
        return (
          <g
            key={`ovr-${id}`}
            className="override-badge"
            transform={`translate(${el.rect.x + el.rect.width - 6},${el.rect.y - 6})`}
          >
            <circle r="9" />
            <text textAnchor="middle" dy="3.5">
              覆
            </text>
          </g>
        );
      })}
      {/* 焦点标记：置于最顶层，避免与元素拖动热区重叠时被挡住 */}
      <g
        className={`focal-marker ${onFocalDrag ? 'is-draggable' : ''}`}
        transform={`translate(${background.focalPoint.x},${background.focalPoint.y})`}
        onPointerDown={(e) => beginDrag(e, 'bg')}
      >
        <circle r="11" className="focal-ring" />
        <line x1="-16" y1="0" x2="-6" y2="0" className="focal-cross" />
        <line x1="6" y1="0" x2="16" y2="0" className="focal-cross" />
        <line x1="0" y1="-16" x2="0" y2="-6" className="focal-cross" />
        <line x1="0" y1="6" x2="0" y2="16" className="focal-cross" />
      </g>
    </svg>
  );
}

function ContentNode({ id, layout }: { id: ElementId; layout: LayoutResult }) {
  const el = layout.elements[id];
  const { rect, def } = el;

  if (id === 'logo') {
    return (
      <image
        href={ASSETS.logo}
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }

  if (id === 'cta') {
    return (
      <g>
        <rect
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={def.borderRadius ?? 8}
          fill={def.bgColor ?? '#ffb347'}
        />
        <text
          x={rect.x + rect.width / 2}
          y={rect.y + rect.height / 2 + (def.fontSize ?? 18) * 0.36}
          textAnchor="middle"
          fontSize={def.fontSize}
          fontWeight={def.fontWeight ?? 700}
          fill={def.color ?? '#3a1d0c'}
        >
          {def.text}
        </text>
      </g>
    );
  }

  // title / disclaimer
  const fontSize = def.fontSize ?? 14;
  const lineH = el.lineHeightPx ?? Math.round(fontSize * 1.2);
  const anchor =
    def.xPin === 'center' ? 'middle' : def.xPin === 'right' ? 'end' : 'start';
  const textX =
    def.xPin === 'center' ? rect.x + rect.width / 2 : def.xPin === 'right' ? rect.x + rect.width : rect.x;
  const firstBaseline = rect.y + fontSize * 0.82;
  return (
    <text
      x={textX}
      y={firstBaseline}
      textAnchor={anchor}
      fontSize={fontSize}
      fontWeight={def.fontWeight ?? 400}
      fill={def.color ?? '#fff'}
    >
      {(el.lines ?? []).map((line, i) => (
        <tspan key={i} x={textX} dy={i === 0 ? 0 : lineH}>
          {line || ' '}
        </tspan>
      ))}
    </text>
  );
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
