import { BG_IMAGE_SIZE, LOGO_IMAGE_SIZE } from '../data/defaults';
import type {
  BackgroundLayout,
  ElementDef,
  ElementId,
  Insets,
  LayoutResult,
  PlacementConfig,
  Rect,
  ResolvedElement,
  Size,
  Violation,
  ViolationCode,
} from '../types';
import { coverCrop, insetRect, intersects, overflowOf } from './crop';
import { measureText, wrapText } from './textMeasure';

const CONTENT_IDS: ElementId[] = ['logo', 'title', 'cta', 'disclaimer'];

interface Measured {
  id: ElementId;
  def: ResolvedElement;
  w: number;
  h: number;
  lines?: string[];
  lineHeightPx?: number;
  codes: ViolationCode[];
}

export interface MeasuredSize {
  width: number;
  height: number;
  lines?: string[];
  codes: ViolationCode[];
}

/**
 * 计算元素在给定安全区宽度下的内容尺寸。
 * 关键原则：引擎永不自动缩小字号/尺寸；不满足最小约束时记录 code，
 * 并按「撑到下限」的尺寸继续布局，让冲突后果（溢出/重叠）可见。
 */
export function measureElement(def: ResolvedElement, safeWidth: number): MeasuredSize {
  const codes: ViolationCode[] = [];
  switch (def.id) {
    case 'logo': {
      const ratio = LOGO_IMAGE_SIZE.width / LOGO_IMAGE_SIZE.height;
      const height = def.height ?? 48;
      let w = height * ratio;
      let h = height;
      const minWidth = def.minWidth ?? 0;
      if (w < minWidth) {
        // 不满足最小宽度：撑到下限（高度同比），并标记 min-size
        const factor = minWidth / w;
        w = minWidth;
        h = height * factor;
        codes.push('min-size');
      }
      return { width: w, height: h, codes };
    }
    case 'title':
    case 'disclaimer': {
      const fontSize = def.fontSize ?? 14;
      if (fontSize < (def.minFontSize ?? 0)) codes.push('font-floor');
      const boxWidth = Math.min(def.maxWidth ?? safeWidth, safeWidth);
      const lines = wrapText(def.text ?? '', fontSize, boxWidth);
      const lineH = Math.round(fontSize * (def.lineHeight ?? 1.2));
      const widest = lines.reduce((m, l) => Math.max(m, measureText(l, fontSize)), 0);
      return {
        width: lines.length ? widest : 0,
        height: lines.length * lineH,
        lines,
        codes,
      };
    }
    case 'cta': {
      const fontSize = def.fontSize ?? 18;
      if (fontSize < (def.minFontSize ?? 0)) codes.push('font-floor');
      const textW = measureText(def.text ?? '', fontSize);
      const contentH = Math.ceil(fontSize * 1.5);
      let w = (def.padX ?? 24) * 2 + textW;
      let h = def.height ?? 44;
      const minWidth = def.minWidth ?? 0;
      if (w < minWidth) w = minWidth; // 按钮允许长大到最小宽度
      if (h < contentH) {
        // 高度连一行文字都装不下：撑到内容高并标记 min-size
        codes.push('min-size');
        h = contentH;
      }
      if (!(def.text ?? '') && w < minWidth) w = minWidth;
      return { width: w, height: h, codes };
    }
    default:
      return { width: 0, height: 0, codes: [] };
  }
}

function xPosition(def: ElementDef, w: number, safe: Rect): number {
  const marginX = def.marginX ?? 0;
  switch (def.xPin) {
    case 'right':
      return safe.x + safe.width - marginX - w;
    case 'center':
      return safe.x + (safe.width - w) / 2;
    case 'left':
    default:
      return safe.x + marginX;
  }
}

const ANCHOR_LABEL: Record<string, string> = {
  logo: 'Logo',
  title: '标题',
  cta: '行动按钮',
  disclaimer: '免责声明',
};

/**
 * 主求解入口：给定生效规格与版位配置，输出全部元素位置与冲突列表。
 * 位置永远按「不缩放、不避让」的字面约束计算，冲突只报告不掩盖。
 */
export function solveLayout(
  resolved: Record<ElementId, ResolvedElement>,
  placement: PlacementConfig,
): LayoutResult {
  const canvas: Size = placement.canvas;
  const safe = insetRect({ x: 0, y: 0, ...canvas }, placement.safe);

  // 1) 测量
  const measured = new Map<ElementId, Measured>();
  for (const id of CONTENT_IDS) {
    const def = resolved[id];
    const m = measureElement(def, safe.width);
    measured.set(id, {
      id,
      def,
      w: m.width,
      h: m.height,
      lines: m.lines,
      lineHeightPx:
        def.kind === 'text'
          ? Math.round((def.fontSize ?? 14) * (def.lineHeight ?? 1.2))
          : undefined,
      codes: [...m.codes],
    });
  }

  // 2) 横向位置（水平安全区检查在最终位置确定后统一进行）
  const rects = new Map<ElementId, Rect>();
  for (const id of CONTENT_IDS) {
    const m = measured.get(id)!;
    rects.set(id, { x: xPosition(m.def, m.w, safe), y: 0, width: m.w, height: m.h });
  }

  // 3) 纵向锚链求解（支持 top/bottom/above/below，多趟解析依赖）
  const yOf = new Map<ElementId, number>();
  const pending = new Set(CONTENT_IDS);
  let guard = 0;
  while (pending.size > 0 && guard++ <= CONTENT_IDS.length) {
    for (const id of [...pending]) {
      const m = measured.get(id)!;
      const a = m.def.vAnchor ?? 'top';
      if (a === 'top') {
        yOf.set(id, safe.y + (m.def.vMargin ?? 0));
        pending.delete(id);
      } else if (a === 'bottom') {
        yOf.set(id, safe.y + safe.height - (m.def.vMargin ?? 0) - m.h);
        pending.delete(id);
      } else if (a === 'below' || a === 'above') {
        const target = m.def.vTarget;
        if (target && yOf.has(target)) {
          const tRect = rects.get(target)!;
          const ty = yOf.get(target)!;
          const gap = m.def.vGap ?? 0;
          yOf.set(
            id,
            a === 'below' ? ty + tRect.height + gap : ty - gap - m.h,
          );
          pending.delete(id);
        }
      }
    }
  }
  // 锚环 / 目标缺失：兜底放在安全区顶部并报空间冲突
  for (const id of pending) {
    const m = measured.get(id)!;
    yOf.set(id, safe.y);
    if (!m.codes.includes('space')) m.codes.push('space');
  }
  for (const [id, y] of yOf) {
    const r = rects.get(id)!;
    r.y = y;
  }

  const violations: Violation[] = [];

  // 4) 纵向空间检查
  // 顶链（top 及其 below 后继）
  const topChain = chainFrom('top', measured);
  const bottomChain = chainFrom('bottom', measured);
  const topUsed = chainSpan(topChain, yOf, rects);
  const bottomUsed = chainSpan(bottomChain, yOf, rects);

  if (topChain.length && bottomChain.length) {
    const topBottom = topUsed.end;
    const bottomTop = bottomUsed.start;
    if (topBottom > bottomTop + 0.01) {
      const overlapPx = Math.round(topBottom - bottomTop);
      for (const id of topChain) measured.get(id)!.codes.push('space', 'overlap');
      for (const id of bottomChain) measured.get(id)!.codes.push('space', 'overlap');
      violations.push({
        code: 'space',
        elementIds: [...topChain, ...bottomChain],
        title: '纵向空间不足：顶链与贴底元素相撞',
        message:
          `顶链（${topChain.map((i) => ANCHOR_LABEL[i]).join(' → ')}）` +
          `需到 ${Math.round(topBottom)}px，贴底的 ${bottomChain
            .map((i) => ANCHOR_LABEL[i])
            .join('、')} 从 ${Math.round(bottomTop)}px 开始，互相侵入 ${overlapPx}px。` +
          `字号、行距与间距约束无法同时满足，请减少文案、放宽间距或为该版位覆盖更小字号。`,
      });
    }
  }
  // 单链溢出安全区
  for (const chain of [topChain, bottomChain]) {
    if (!chain.length) continue;
    const span = chainSpan(chain, yOf, rects);
    if (span.end > safe.y + safe.height + 0.01) {
      const by = Math.round(span.end - (safe.y + safe.height));
      for (const id of chain) {
        const codes = measured.get(id)!.codes;
        if (!codes.includes('space')) codes.push('space');
      }
      violations.push({
        code: 'space',
        elementIds: chain,
        title: `纵向空间不足：${ANCHOR_LABEL[chain[chain.length - 1]]}超出安全区底部`,
        message:
          `锚链 ${chain.map((i) => ANCHOR_LABEL[i]).join(' → ')} 总高 ` +
          `${Math.round(span.end - span.start)}px，超出安全区底部 ${by}px。` +
          `无法同时满足各元素字号、最小尺寸与间距约束（引擎未做任何自动缩小）。`,
      });
    }
    if (span.start < safe.y - 0.01) {
      const by = Math.round(safe.y - span.start);
      for (const id of chain) {
        const codes = measured.get(id)!.codes;
        if (!codes.includes('space')) codes.push('space');
      }
      violations.push({
        code: 'space',
        elementIds: chain,
        title: `纵向空间不足：${ANCHOR_LABEL[chain[0]]}顶出安全区顶部`,
        message: `锚链起点超出安全区顶部 ${by}px，贴边/间距约束无法同时满足。`,
      });
    }
  }

  // 5) 两两重叠（兜底：锚链定义之外的意外重叠）
  for (let i = 0; i < CONTENT_IDS.length; i++) {
    for (let j = i + 1; j < CONTENT_IDS.length; j++) {
      const a = CONTENT_IDS[i];
      const b = CONTENT_IDS[j];
      const ra = rects.get(a)!;
      const rb = rects.get(b)!;
      const alreadyReported =
        measured.get(a)!.codes.includes('overlap') &&
        measured.get(b)!.codes.includes('overlap');
      if (intersects(ra, rb) && !alreadyReported) {
        measured.get(a)!.codes.push('overlap');
        measured.get(b)!.codes.push('overlap');
        const ay = Math.max(ra.y, rb.y);
        const by2 = Math.min(ra.y + ra.height, rb.y + rb.height);
        violations.push({
          code: 'overlap',
          elementIds: [a, b],
          title: `${ANCHOR_LABEL[a]} 与 ${ANCHOR_LABEL[b]} 发生重叠`,
          message: `两元素在纵向上重叠 ${Math.round(by2 - ay)}px，约束求解未发现可同时满足的位置。`,
        });
      }
    }
  }

  // 6) 水平溢出 / 其他单元素冲突说明
  for (const id of CONTENT_IDS) {
    const m = measured.get(id)!;
    const r = rects.get(id)!;
    const over = overflowOf(r, safe);
    if (over.left > 0.01 || over.right > 0.01) {
      if (!m.codes.includes('safe-overflow')) m.codes.push('safe-overflow');
      const by = Math.round(Math.max(over.left, over.right));
      violations.push({
        code: 'safe-overflow',
        elementIds: [id],
        title: `${ANCHOR_LABEL[id]} 溢出安全区`,
        message:
          `${ANCHOR_LABEL[id]} 超出安全区 ${by}px（内容宽 ${Math.round(
            r.width,
          )}px，安全区可用宽 ${Math.round(safe.width)}px${
            r.x + r.width > canvas.width + 0.01 || r.x < -0.01
              ? '，且已越过画板边缘将被裁切'
              : ''
          }）。请收窄内容、减小边距或覆盖更小字号/内边距。`,
      });
    }
    if (m.codes.includes('font-floor')) {
      violations.push({
        code: 'font-floor',
        elementIds: [id],
        title: `${ANCHOR_LABEL[id]} 字号低于最小字号`,
        message:
          `当前字号 ${m.def.fontSize}px < 最小字号 ${m.def.minFontSize}px。` +
          `引擎不会偷偷缩小——该覆盖违反最小字号约束，请恢复字号或显式下调最小字号。`,
      });
    }
    if (m.codes.includes('min-size')) {
      violations.push({
        code: 'min-size',
        elementIds: [id],
        title: `${ANCHOR_LABEL[id]} 不满足最小尺寸`,
        message:
          id === 'logo'
            ? `Logo 按高度 ${m.def.height}px 等比缩放后宽 ${Math.round(
                r.width,
              )}px（渲染已撑到下限），低于最小宽度 ${m.def.minWidth}px。`
            : `${ANCHOR_LABEL[id]} 高度 ${m.def.height}px 容纳不下 ${
                m.def.fontSize
              }px 文字，已违反最小尺寸约束。`,
      });
    }
  }

  // 7) 组装结果
  const elements = {} as LayoutResult['elements'];
  for (const id of CONTENT_IDS) {
    const m = measured.get(id)!;
    elements[id] = {
      def: m.def,
      rect: rects.get(id)!,
      lines: m.lines,
      lineHeightPx: m.lineHeightPx,
      violationCodes: Array.from(new Set(m.codes)),
    };
  }
  // 背景占位（结果读取方不会直接用其 rect）
  elements.bg = {
    def: resolved.bg,
    rect: { x: 0, y: 0, width: 0, height: 0 },
    violationCodes: [],
  };

  const bgDef = resolved.bg;
  const crop = coverCrop(BG_IMAGE_SIZE, canvas, bgDef.fx ?? 0.5, bgDef.fy ?? 0.5);
  const background: BackgroundLayout = {
    fx: bgDef.fx ?? 0.5,
    fy: bgDef.fy ?? 0.5,
    imageRect: crop.imageRect,
    crop: crop.crop,
    focalPoint: crop.focalPoint,
    clampedX: crop.clampedX,
    clampedY: crop.clampedY,
  };

  return {
    scope: placement.id,
    canvas,
    safe,
    elements,
    background,
    violations,
    hasOverrides: CONTENT_IDS.some(
      (id) => (resolved[id].overriddenKeys?.length ?? 0) > 0,
    ),
  };
}

/** 从指定贴边锚点出发，沿 below/above 依赖取出整条链 */
function chainFrom(
  edge: 'top' | 'bottom',
  measured: Map<ElementId, Measured>,
): ElementId[] {
  const roots = CONTENT_IDS.filter((id) => measured.get(id)!.def.vAnchor === edge);
  const chain: ElementId[] = [];
  const walk = (id: ElementId) => {
    if (chain.includes(id)) return;
    chain.push(id);
    for (const other of CONTENT_IDS) {
      const a = measured.get(other)!.def.vAnchor;
      const target = measured.get(other)!.def.vTarget;
      if (
        target === id &&
        ((edge === 'top' && a === 'below') || (edge === 'bottom' && a === 'above'))
      ) {
        walk(other);
      }
    }
  };
  roots.forEach(walk);
  return chain;
}

function chainSpan(
  chain: ElementId[],
  yOf: Map<ElementId, number>,
  rects: Map<ElementId, Rect>,
): { start: number; end: number } {
  let start = Infinity;
  let end = -Infinity;
  for (const id of chain) {
    const y = yOf.get(id) ?? 0;
    start = Math.min(start, y);
    end = Math.max(end, y + rects.get(id)!.height);
  }
  if (!isFinite(start)) return { start: 0, end: 0 };
  return { start, end };
}

export function safeRect(canvas: Size, s: Insets): Rect {
  return insetRect({ x: 0, y: 0, ...canvas }, s);
}
