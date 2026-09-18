/**
 * 确定性文本测量与折行。
 *
 * 浏览器中优先使用 Canvas 2D measureText（字体不可用时自然回退到内置字宽表）；
 * jsdom / 无 Canvas 环境使用内置近似字宽表，保证测试结果确定、跨环境一致。
 */

const ASCII_RATIO = 0.56; // 西文字符平均占字号的比例（含词间空隙的近似）

/** 测量单个渲染字符的宽度 */
export function charWidth(ch: string, fontSize: number): number {
  if (ch === ' ') return fontSize * 0.32;
  // CJK 及全角字符按全角字宽
  const code = ch.codePointAt(0) ?? 0;
  const isFullWidth =
    code >= 0x2e80 && // CJK 部首起
    (code <= 0x9fff ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0x3000 && code <= 0x30ff));
  return isFullWidth ? fontSize : fontSize * ASCII_RATIO;
}

export function measureText(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch, fontSize);
  return w;
}

/**
 * 按最大宽度折行。CJK 字符可在行内任意断行；西文以词为单位整体移动。
 * 超长的单个西文词做强制折断。返回行数组（不含空行；空文本返回 []）。
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
): string[] {
  if (!text) return [];
  const lines: string[] = [];
  // 先按显式换行分段
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    let line = '';
    let lineWidth = 0;
    const tokens = tokenize(paragraph);
    for (const token of tokens) {
      const tokenWidth = measureText(token.text, fontSize);
      if (token.type === 'space') {
        // 行首空格折叠丢弃
        if (line === '') continue;
        if (lineWidth + tokenWidth <= maxWidth) {
          line += token.text;
          lineWidth += tokenWidth;
        }
        continue;
      }
      if (token.type === 'word' && tokenWidth > maxWidth) {
        // 超长词（即使是行首第一个 token）也要强制折断
        if (line !== '') {
          lines.push(line);
          line = '';
          lineWidth = 0;
        }
        let rest = token.text;
        while (rest.length > 0) {
          let cut = 0;
          let w = 0;
          for (const ch of rest) {
            const cw = charWidth(ch, fontSize);
            if (cut > 0 && w + cw > maxWidth) break;
            w += cw;
            cut += 1;
          }
          const piece = rest.slice(0, cut);
          rest = rest.slice(cut);
          if (rest.length > 0) {
            lines.push(piece);
          } else {
            line = piece;
            lineWidth = w;
          }
        }
      } else if (line !== '' && lineWidth + tokenWidth > maxWidth) {
        // 普通词放不下：整体移到下一行
        lines.push(line);
        line = token.text;
        lineWidth = tokenWidth;
      } else {
        line += token.text;
        lineWidth += tokenWidth;
      }
    }
    lines.push(line);
  }
  return lines;
}

type Token = { type: 'word' | 'space'; text: string };

/** 将段落切成「西文词 / CJK 单字 / 空白」token，便于分别处理断行规则 */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\s+|[A-Za-z0-9]+(?:[.'’-][A-Za-z0-9]+)*|.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const part = m[0];
    if (/^\s+$/.test(part)) tokens.push({ type: 'space', text: ' ' });
    else if (/^[A-Za-z0-9]/.test(part)) tokens.push({ type: 'word', text: part });
    else {
      // 每个 CJK / 全角字符独立成 token，允许任意断行
      for (const ch of part) tokens.push({ type: 'word', text: ch });
    }
  }
  return tokens;
}
