import type { CreativeDoc, SlotDef, SlotId } from './types';
import bgUrl from './assets/autumn-bg.svg';
import logoUrl from './assets/logo.svg';

/** 三个投放版位（设计像素） */
export const SLOTS: SlotDef[] = [
  {
    id: 'web-banner',
    name: '官网横幅',
    hint: '1200 × 400',
    width: 1200,
    height: 400,
    safeArea: { top: 56, right: 56, bottom: 56, left: 56 },
  },
  {
    id: 'mobile-splash',
    name: '移动开屏',
    hint: '750 × 1334',
    width: 750,
    height: 1334,
    safeArea: { top: 72, right: 72, bottom: 128, left: 72 },
  },
  {
    id: 'social-square',
    name: '社媒方图',
    hint: '1080 × 1080',
    width: 1080,
    height: 1080,
    safeArea: { top: 96, right: 96, bottom: 96, left: 96 },
  },
];

export const SLOT_MAP: Record<SlotId, SlotDef> = Object.fromEntries(
  SLOTS.map((s) => [s.id, s]),
) as Record<SlotId, SlotDef>;

/**
 * 主创意编辑画布。规则（贴安全区 / 相对定位 / 间距）以该坐标系表达，
 * 求解时在每个版位上独立成立，因此主画布只负责编辑，不参与投放。
 */
export const MASTER_CANVAS = {
  width: 1200,
  height: 628,
  safeArea: { top: 64, right: 64, bottom: 64, left: 64 },
};

export const DEMO_SHORT_TITLE = '秋季发布会 · 11 月 3 日线上见';
/** 90 秒演示用长标题：移动开屏放不下，求解器必须报 min-font 冲突而不是偷偷缩到更小 */
export const DEMO_LONG_TITLE =
  '秋季发布会定档 11 月 3 日：全新智能终端系列线上揭晓，立即预约';

export const DEFAULT_DOC: CreativeDoc = {
  schemaVersion: 1,
  elements: {
    background: {
      id: 'background',
      visible: true,
      image: bgUrl,
      focus: { x: 0.5, y: 0.47 },
      intrinsicWidth: 1600,
      intrinsicHeight: 1000,
      rules: {
        x: { type: 'pin', edge: 'left', gap: 0 },
        y: { type: 'pin', edge: 'top', gap: 0 },
      },
    },
    logo: {
      id: 'logo',
      visible: true,
      image: logoUrl,
      intrinsicWidth: 320,
      intrinsicHeight: 96,
      width: 220,
      rules: {
        x: { type: 'pin', edge: 'left', gap: 64 },
        y: { type: 'pin', edge: 'top', gap: 64 },
      },
    },
    title: {
      id: 'title',
      visible: true,
      text: DEMO_SHORT_TITLE,
      fontSize: 48,
      minFontSize: 28,
      lineHeight: 1.2,
      maxWidth: 900,
      allowWrap: false,
      color: '#ffffff',
      weight: 800,
      align: 'left',
      rules: {
        x: { type: 'pin', edge: 'left', gap: 64 },
        y: { type: 'relative', target: 'logo', relation: 'below', gap: 28 },
      },
    },
    cta: {
      id: 'cta',
      visible: true,
      text: '立即预约',
      fontSize: 32,
      minFontSize: 22,
      paddingX: 38,
      paddingY: 15,
      minWidth: 190,
      bg: '#f08a3c',
      color: '#ffffff',
      radius: 999,
      weight: 700,
      rules: {
        x: { type: 'pin', edge: 'left', gap: 64 },
        y: { type: 'relative', target: 'title', relation: 'below', gap: 32 },
      },
    },
    disclaimer: {
      id: 'disclaimer',
      visible: true,
      text: '活动最终解释权归 NOVA 所有 · 图片仅供参考，请以实际发布为准',
      fontSize: 18,
      minFontSize: 14,
      lineHeight: 1.5,
      maxWidth: 560,
      color: 'rgba(255,255,255,0.82)',
      align: 'right',
      rules: {
        x: { type: 'pin', edge: 'right', gap: 64 },
        y: { type: 'pin', edge: 'bottom', gap: 64 },
      },
    },
  },
  overrides: {},
};
