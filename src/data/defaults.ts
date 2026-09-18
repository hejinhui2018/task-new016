import type {
  Doc,
  ElementDef,
  ElementId,
  PlacementConfig,
  PlacementId,
} from '../types';

/** 三个版位定义（官网横幅 / 移动开屏 / 社媒方图） */
export const PLACEMENTS: Record<PlacementId, PlacementConfig> = {
  web: {
    id: 'web',
    label: '官网横幅',
    description: '1200 × 400 · 宽幅横版',
    canvas: { width: 1200, height: 400 },
    // 宽幅两侧留白更多
    safe: { top: 28, right: 72, bottom: 28, left: 72 },
  },
  mobile: {
    id: 'mobile',
    label: '移动开屏',
    description: '360 × 640 · 竖版窄屏',
    canvas: { width: 360, height: 640 },
    safe: { top: 40, right: 20, bottom: 40, left: 20 },
  },
  social: {
    id: 'social',
    label: '社媒方图',
    description: '600 × 600 · 正方形',
    canvas: { width: 600, height: 600 },
    safe: { top: 36, right: 36, bottom: 36, left: 36 },
  },
};

export const PLACEMENT_ORDER: PlacementId[] = ['web', 'mobile', 'social'];

/** 内置素材（本地文件，public/） */
export const ASSETS = {
  background: '/assets/autumn-bg.svg',
  logo: '/assets/logo.svg',
} as const;

/** 素材图固有尺寸（裁切计算的源尺寸） */
export const BG_IMAGE_SIZE = { width: 1000, height: 1000 };
export const LOGO_IMAGE_SIZE = { width: 240, height: 64 };

/**
 * 「秋季发布会」主创意默认规格。
 * 纵向锚链：logo(贴顶) → title(在 logo 下) → cta(在 title 下)；disclaimer 贴底。
 * 字号/尺寸是跨版位继承的硬约束，移动竖版放不下时长标题会直接报冲突。
 */
export const MASTER_ELEMENTS: ElementDef[] = [
  {
    id: 'bg',
    kind: 'background',
    fx: 0.62,
    fy: 0.42,
  },
  {
    id: 'logo',
    kind: 'logo',
    height: 48,
    minWidth: 96,
    xPin: 'left',
    marginX: 0,
    vAnchor: 'top',
    vMargin: 0,
  },
  {
    id: 'title',
    kind: 'text',
    text: '秋季发布会',
    fontSize: 64,
    minFontSize: 64,
    // 主创意给足行宽：横幅上长标题只折两行，而移动安全区 320px 强制折成 5 行，
    // 从而在不改任何字号的前提下，长标题只会撑爆移动版。
    maxWidth: 900,
    fontWeight: 800,
    lineHeight: 1.18,
    color: '#fff7ec',
    xPin: 'left',
    marginX: 0,
    vAnchor: 'below',
    vTarget: 'logo',
    vGap: 28,
  },
  {
    id: 'cta',
    kind: 'button',
    text: '立即预约',
    fontSize: 22,
    minFontSize: 18,
    fontWeight: 700,
    color: '#3a1d0c',
    bgColor: '#ffb347',
    borderRadius: 999,
    height: 52,
    minWidth: 148,
    padX: 34,
    xPin: 'left',
    marginX: 0,
    vAnchor: 'below',
    vTarget: 'title',
    vGap: 26,
  },
  {
    id: 'disclaimer',
    kind: 'text',
    text: '*活动详情以官网为准，礼品数量有限，赠完即止。',
    fontSize: 14,
    minFontSize: 12,
    maxWidth: 560,
    fontWeight: 400,
    lineHeight: 1.4,
    color: 'rgba(255,247,236,0.82)',
    xPin: 'left',
    marginX: 0,
    vAnchor: 'bottom',
    vMargin: 0,
  },
];

export const MASTER_MAP: Record<ElementId, ElementDef> = MASTER_ELEMENTS.reduce(
  (acc, el) => {
    acc[el.id] = el;
    return acc;
  },
  {} as Record<ElementId, ElementDef>,
);

export const ELEMENT_LABELS: Record<ElementId, string> = {
  bg: '背景焦点',
  logo: 'Logo',
  title: '标题',
  cta: '行动按钮',
  disclaimer: '免责声明',
};

export const ELEMENT_ORDER: ElementId[] = [
  'bg',
  'logo',
  'title',
  'cta',
  'disclaimer',
];

/** 各元素哪些字段允许在版位上覆盖（背景焦点为全局共享，不可单版位覆盖） */
export const OVERRIDABLE_KEYS: Record<ElementId, string[]> = {
  bg: [],
  logo: ['height', 'minWidth', 'vAnchor', 'vMargin', 'vGap', 'vTarget', 'xPin', 'marginX'],
  title: [
    'fontSize',
    'minFontSize',
    'maxWidth',
    'vAnchor',
    'vMargin',
    'vGap',
    'vTarget',
    'xPin',
    'marginX',
  ],
  cta: [
    'fontSize',
    'minFontSize',
    'height',
    'minWidth',
    'padX',
    'vAnchor',
    'vMargin',
    'vGap',
    'vTarget',
    'xPin',
    'marginX',
  ],
  disclaimer: [
    'fontSize',
    'minFontSize',
    'maxWidth',
    'vAnchor',
    'vMargin',
    'vGap',
    'vTarget',
    'xPin',
    'marginX',
  ],
};

export function createInitialDoc(): Doc {
  return {
    version: 1,
    master: {},
    placements: {
      web: { overrides: {} },
      mobile: { overrides: {} },
      social: { overrides: {} },
    },
  };
}
