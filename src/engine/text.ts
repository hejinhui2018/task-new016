// 确定性文本测量与换行：不依赖浏览器 canvas/字体，
// 按「全角字符 1em + ASCII 字符宽度表」估算，求解器与测试共用同一套数字，
// 保证测试、求解结果、渲染三者一致。

const UPPER_WIDTH: Record<string, number> = {
  A: 0.68, B: 0.67, C: 0.72, D: 0.73, E: 0.61, F: 0.58, G: 0.76, H: 0.74,
  I: 0.29, J: 0.29, K: 0.67, L: 0.56, M: 0.88, N: 0.75, O: 0.77, P: 0.6,
  Q: 0.77, R: 0.7, S: 0.64, T: 0.61, U: 0.74, V: 0.67, W: 0.92, X: 0.67,
  Y: 0.64, Z: 0.62,
};

const LOWER_WIDTH: Record<string, number> = {
  a: 0.55, b: 0.56, c: 0.51, d: 0.56, e: 0.56, f: 0.3, g: 0.55, h: 0.56,
  i: 0.27, j: 0.27, k: 0.53, l: 0.27, m: 0.83, n: 0.56, o: 0.56, p: 0.56,
  q: 0.56, r: 0.36, s: 0.51, t: 0.33, u: 0.56, v: 0.52, w: 0.74, x: 0.52,
  y: 0.52, z: 0.5,
};

const PUNCT_WIDTH: Record<string, number> = {
  '.': 0.28, ',': 0.28, ':': 0.28, ';': 0.28, '!': 0.32, '?': 0.52,
  '(': 0.33, ')': 0.33, '[': 0.33, ']': 0.33, '{': 0.33, '}': 0.33,
  '·': 0.5, '-': 0.33, '–': 0.55, '—': 1, '/': 0.3, '\\': 0.3, '#': 0.55,
  '%': 0.6, '+': 0.5, '=': 0.5, '&': 0.6, '@': 0.8, '*': 0.5, '"': 0.45,
  "'": 0.27, '`': 0.33, '~': 0.55, '<': 0.55, '>': 0.55, '|': 0.27, '_': 0.5,
  '^': 0.5, '$': 0.5,
};

function isCjk(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x2e80 && code <= 0x9fff) || // CJK 部首/假名/统一表意文字
    (code >= 0xf900 && code <= 0xfaff) || // 兼容表意文字
    (code >= 0xff00 && code <= 0xffef) || // 全角字符
    (code >= 0x3000 && code <= 0x303f) || // CJK 符号和标点
    code === 0x2026 || // …
    code === 0x2014 // —
  );
}

function isSpace(ch: string): boolean {
  return /\s/.test(ch) && ch !== '\n';
}

/** 单字符相对字号的宽度（em） */
export function charEm(ch: string): number {
  if (isCjk(ch)) return 1;
  if (ch === ' ' || isSpace(ch)) return 0.3;
  if (ch >= '0' && ch <= '9') return 0.56;
  if (ch in UPPER_WIDTH) return UPPER_WIDTH[ch];
  if (ch in LOWER_WIDTH) return LOWER_WIDTH[ch];
  if (ch in PUNCT_WIDTH) return PUNCT_WIDTH[ch];
  return 0.55;
}

function weightFactor(weight: number): number {
  if (weight >= 800) return 1.07;
  if (weight >= 700) return 1.04;
  if (weight >= 600) return 1.02;
  return 1;
}

/** 测量整段文本单行宽度（px） */
export function measureText(text: string, fontSize: number, weight = 400): number {
  let em = 0;
  for (const ch of text) {
    if (ch === '\n') continue;
    em += charEm(ch);
  }
  return em * fontSize * weightFactor(weight);
}

export interface WrappedText {
  lines: string[];
  /** 最宽行的宽度 */
  width: number;
  height: number;
}

type Token =
  | { kind: 'char'; ch: string; width: number } // CJK 字符：其后可断行
  | { kind: 'word'; text: string; width: number } // 拉丁/数字词：整体不拆
  | { kind: 'space'; width: number };

function tokenize(text: string, fontSize: number, weight: number): Token[] {
  const f = weightFactor(weight);
  const tokens: Token[] = [];
  let word = '';
  let wordEm = 0;
  const flush = () => {
    if (word) {
      tokens.push({ kind: 'word', text: word, width: wordEm * fontSize * f });
      word = '';
      wordEm = 0;
    }
  };
  for (const ch of text) {
    if (ch === '\n') {
      flush();
      tokens.push({ kind: 'space', width: -1 }); // 换行哨兵
      continue;
    }
    if (isCjk(ch)) {
      flush();
      tokens.push({ kind: 'char', ch, width: charEm(ch) * fontSize * f });
    } else if (isSpace(ch)) {
      flush();
      tokens.push({ kind: 'space', width: charEm(' ') * fontSize * f });
    } else {
      word += ch;
      wordEm += charEm(ch);
    }
  }
  flush();
  return tokens;
}

function lineWidth(line: { text: string; width: number }[]): number {
  let width = 0;
  for (const seg of line) width += seg.width;
  return width;
}

function assemble(line: { text: string; width: number }[]): { text: string; width: number } {
  // 去掉行首行尾空白段
  let start = 0;
  let end = line.length;
  while (start < end && line[start].text === ' ') start++;
  while (end > start && line[end - 1].text === ' ') end--;
  const segs = line.slice(start, end);
  return { text: segs.map((s) => s.text).join(''), width: lineWidth(segs) };
}

/**
 * 贪心换行。CJK 字符后可断行，拉丁词整体不拆。
 * 单个拉丁词超过 maxWidth 时仍独占一行（宽度溢出交由求解器判定为冲突）。
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  lineHeightEm: number,
  weight = 400,
): WrappedText {
  const tokens = tokenize(text, fontSize, weight);
  const lines: { text: string; width: number }[] = [];
  let current: { text: string; width: number }[] = [];
  let currentWidth = 0;

  const pushLine = () => {
    if (current.length) {
      lines.push(assemble(current));
    } else {
      lines.push({ text: '', width: 0 });
    }
    current = [];
    currentWidth = 0;
  };

  for (const token of tokens) {
    if (token.kind === 'space' && token.width === -1) {
      pushLine();
      continue;
    }
    const segText = token.kind === 'char' ? token.ch : token.kind === 'word' ? token.text : ' ';
    const segWidth = token.width;
    if (currentWidth + segWidth <= maxWidth || current.length === 0) {
      current.push({ text: segText, width: segWidth });
      currentWidth += segWidth;
    } else {
      pushLine();
      if (token.kind === 'space') continue; // 不在行首留空白
      current.push({ text: segText, width: segWidth });
      currentWidth += segWidth;
    }
  }
  pushLine();

  const width = lines.reduce((m, l) => Math.max(m, l.width), 0);
  return {
    lines: lines.map((l) => l.text),
    width,
    height: lines.length * fontSize * lineHeightEm,
  };
}

/** 不换行：按显式 \n 分行，宽度取最宽行 */
export function measureMultiline(
  text: string,
  fontSize: number,
  lineHeightEm: number,
  weight = 400,
): WrappedText {
  const lines = text.split('\n');
  const widths = lines.map((l) => measureText(l, fontSize, weight));
  return {
    lines,
    width: Math.max(...widths, 0),
    height: lines.length * fontSize * lineHeightEm,
  };
}
