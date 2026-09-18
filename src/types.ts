// —— CampaignFit 领域模型 ——

/** 三个投放版位 */
export type SlotId = 'web-banner' | 'mobile-splash' | 'social-square';

export interface SafeArea {
  /** 距画布各边缘的内缩（设计像素） */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SlotDef {
  id: SlotId;
  name: string;
  /** 版位用途说明 */
  hint: string;
  width: number;
  height: number;
  safeArea: SafeArea;
}

export type ElementId = 'background' | 'title' | 'logo' | 'cta' | 'disclaimer';

export const ELEMENT_IDS: ElementId[] = ['background', 'title', 'logo', 'cta', 'disclaimer'];

export const ELEMENT_NAMES: Record<ElementId, string> = {
  background: '背景',
  title: '标题',
  logo: 'Logo',
  cta: '行动按钮',
  disclaimer: '免责声明',
};

// —— 定位约束：每个元素在 X / Y 轴上各有一条确定性规则 ——

export type PinEdge = 'top' | 'right' | 'bottom' | 'left';

/** 贴安全区边缘（或居中） */
export interface PinRule {
  type: 'pin';
  edge: PinEdge;
  /** 与安全区边缘的间距（px） */
  gap: number;
}

/** 在安全区内沿该轴居中 */
export interface CenterRule {
  type: 'center';
}

/** 相对另一个元素定位 */
export interface RelativeRule {
  type: 'relative';
  target: Exclude<ElementId, 'background'>;
  /** below: 位于目标下方；above: 上方；rightOf/leftOf: 右侧/左侧 */
  relation: 'below' | 'above' | 'rightOf' | 'leftOf';
  /** 与目标元素的间距（px） */
  gap: number;
}

export type XRule = PinRule | CenterRule | RelativeRule;
export type YRule = PinRule | CenterRule | RelativeRule;

export interface LayoutRules {
  x: XRule;
  y: YRule;
}

interface ElementBase {
  id: ElementId;
  visible: boolean;
  rules: LayoutRules;
}

export interface BackgroundElement extends ElementBase {
  id: 'background';
  image: string;
  /** 归一化焦点 0..1（源图坐标系），cover 裁切时优先保证该点可见 */
  focus: { x: number; y: number };
  /** 源图固有尺寸 */
  intrinsicWidth: number;
  intrinsicHeight: number;
}

export type TextAlign = 'left' | 'center' | 'right';

export interface TitleElement extends ElementBase {
  id: 'title';
  text: string;
  /** 主创意基准字号；自动版式只会在 [minFontSize, fontSize] 之间下调 */
  fontSize: number;
  /** 最小字号：低于此值仍放不下即报冲突，绝不再缩 */
  minFontSize: number;
  /** 行高倍数 */
  lineHeight: number;
  /** 文字块最大宽度（px），同时受安全区宽度限制 */
  maxWidth: number;
  /** 是否允许换行；false 时标题必须单行排布 */
  allowWrap: boolean;
  color: string;
  weight: number;
  align: TextAlign;
}

export interface LogoElement extends ElementBase {
  id: 'logo';
  image: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  /** 渲染宽度（px），高度按固有比例推导 */
  width: number;
}

export interface CtaElement extends ElementBase {
  id: 'cta';
  text: string;
  fontSize: number;
  minFontSize: number;
  paddingX: number;
  paddingY: number;
  minWidth: number;
  bg: string;
  color: string;
  radius: number;
  weight: number;
}

export interface DisclaimerElement extends ElementBase {
  id: 'disclaimer';
  text: string;
  fontSize: number;
  minFontSize: number;
  lineHeight: number;
  maxWidth: number;
  color: string;
  align: TextAlign;
}

export interface ElementsMap {
  background: BackgroundElement;
  title: TitleElement;
  logo: LogoElement;
  cta: CtaElement;
  disclaimer: DisclaimerElement;
}

/** 版位覆盖：每个字段都可缺省，缺省即继承主创意 */
export type SlotOverride = DeepPartial<Omit<ElementsMap, 'background'>> & {
  background?: DeepPartial<Pick<BackgroundElement, 'focus' | 'visible' | 'rules'>>;
};

export type OverridesMap = Partial<Record<SlotId, SlotOverride>>;

export interface CreativeDoc {
  schemaVersion: 1;
  elements: ElementsMap;
  overrides: OverridesMap;
}

// —— 求解器输出 ——

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CoverResult {
  /** 图片在画布中的铺满矩形 */
  rect: Rect;
  scale: number;
  /** 各边裁掉的源图比例 0..1 */
  crop: { left: number; right: number; top: number; bottom: number };
  /** 焦点在画布上的实际位置 */
  focusScreen: { x: number; y: number };
  /** 焦点是否因铺满约束被推离画布中心 */
  focusClamped: boolean;
  /** 焦点本身是否被裁出画布 */
  focusCropped: boolean;
}

export interface PlacedBox extends Rect {
  id: Exclude<ElementId, 'background'>;
  /** 实际采用字号（文本元素） */
  fontSize?: number;
  /** 字号是否由求解器从基准值自动下调（自动结果，非人工） */
  autoFit: boolean;
  lines?: string[];
  /** 是否有任何部分越出画布（被裁切） */
  clipped: boolean;
  clipEdges: PinEdge[];
  /** 是否越出安全区 */
  unsafe: boolean;
  unsafeEdges: PinEdge[];
}

export type ConflictCode =
  | 'min-font'
  | 'overflow'
  | 'clipped'
  | 'overlap'
  | 'unsatisfied-rule';

export interface ConstraintConflict {
  elementId: ElementId;
  axis: 'x' | 'y';
  code: ConflictCode;
  /** 人话说明：哪条约束无法满足 */
  message: string;
  /** 需要的空间 / 实际可用空间（px），用于 UI 展示 */
  required?: number;
  available?: number;
}

export interface LayoutResult {
  slotId: SlotId;
  width: number;
  height: number;
  safe: Rect;
  background: CoverResult;
  boxes: PlacedBox[];
  conflicts: ConstraintConflict[];
  fits: boolean;
}

// —— 工具类型 ——

type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: T[P] extends (infer _U)[]
        ? T[P]
        : T[P] extends object | undefined
          ? DeepPartial<T[P]>
          : T[P];
    }
  : T;
