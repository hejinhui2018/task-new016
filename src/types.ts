/**
 * CampaignFit 核心类型定义
 *
 * 模型约定：
 * - 主创意(master)是每个元素的「默认规格」；版位(placement)只存覆盖字段(override)。
 * - 所有尺寸单位均为画板像素(px)，跨版位按字面值继承——空间不足时报冲突，
 *   引擎绝不自动缩放或重叠；需要缩小只能由设计师显式覆盖。
 */

export type PlacementId = 'web' | 'mobile' | 'social';
export type Scope = 'master' | PlacementId;

export type ElementId = 'bg' | 'logo' | 'title' | 'cta' | 'disclaimer';
export type ElementKind = 'background' | 'logo' | 'text' | 'button';

export type XPin = 'left' | 'center' | 'right';
/** 纵向锚定方式：贴安全区顶边 / 底边，或位于目标元素下方(间距) / 上方(间距) */
export type VAnchorKind = 'top' | 'bottom' | 'above' | 'below';

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 元素完整可编辑规格；所有字段可选，引擎按元素种类给默认值 */
export interface ElementDef {
  id: ElementId;
  kind: ElementKind;
  // —— 文案 / 内容 ——
  text?: string;
  /** 背景焦点（相对素材图的归一化坐标 0..1） */
  fx?: number;
  fy?: number;
  // —— 文字规格 ——
  fontSize?: number;
  minFontSize?: number;
  /** 最大行宽（折行盒宽度上限，px） */
  maxWidth?: number;
  fontWeight?: number;
  lineHeight?: number;
  color?: string;
  // —— 按钮 / 尺寸 ——
  bgColor?: string;
  borderRadius?: number;
  height?: number;
  minWidth?: number;
  padX?: number;
  // —— 纵向约束 ——
  vAnchor?: VAnchorKind;
  vTarget?: ElementId;
  /** 锚到安全区边缘时的边距 */
  vMargin?: number;
  /** 锚到其他元素时的间距 */
  vGap?: number;
  // —— 横向约束 ——
  xPin?: XPin;
  marginX?: number;
}

/** 覆盖补丁：只含被覆盖的字段（扁平结构，删除即恢复继承） */
export type ElementPatch = Partial<Omit<ElementDef, 'id' | 'kind'>>;

export interface PlacementConfig {
  id: PlacementId;
  label: string;
  description: string;
  canvas: Size;
  /** 安全区相对画板四边的内边距 */
  safe: Insets;
}

export interface PlacementState {
  overrides: Partial<Record<ElementId, ElementPatch>>;
}

export interface Doc {
  version: 1;
  /** 主创意相对内置默认规格的修改（与版位覆盖同构，作用于全部版位） */
  master: Partial<Record<ElementId, ElementPatch>>;
  placements: Record<PlacementId, PlacementState>;
}

export interface ResolvedElement extends ElementDef {
  id: ElementId;
  kind: ElementKind;
  /** 该版位下被人工覆盖的字段名 */
  overriddenKeys: string[];
}

export type ViolationCode =
  | 'space' // 纵向链冲突（空间不足，无法同时满足锚定与间距）
  | 'overlap' // 元素两两重叠
  | 'safe-overflow' // 超出安全区
  | 'font-floor' // 字号低于最小字号
  | 'min-size'; // 不满足最小尺寸

export interface Violation {
  code: ViolationCode;
  elementIds: ElementId[];
  /** 简短标题 */
  title: string;
  /** 完整说明：明确指出哪条约束无法满足、差多少 px */
  message: string;
}

export interface LaidOutElement {
  def: ResolvedElement;
  rect: Rect;
  /** 文本元素折行结果 */
  lines?: string[];
  /** 每行像素高（已在测量时取整，渲染与碰撞判定共用） */
  lineHeightPx?: number;
  /** 违反该元素的冲突 code */
  violationCodes: ViolationCode[];
}

export interface BackgroundLayout {
  fx: number;
  fy: number;
  /** 素材图在画板上的绘制矩形 */
  imageRect: Rect;
  /** 素材图中可见裁切窗（素材像素坐标） */
  crop: { sx: number; sy: number; sw: number; sh: number; scale: number };
  /** 焦点在画板上的位置 */
  focalPoint: { x: number; y: number };
  /** 焦点是否因贴边被夹回（说明焦点无法按比例完全满足） */
  clampedX: boolean;
  clampedY: boolean;
}

export interface LayoutResult {
  scope: Scope;
  canvas: Size;
  safe: Rect;
  elements: Record<ElementId, LaidOutElement>;
  background: BackgroundLayout;
  violations: Violation[];
  /** 是否存在任意人工覆盖 */
  hasOverrides: boolean;
}
